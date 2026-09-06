import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ai, GEMINI_MODEL, embedText } from "@/lib/gemini";

const CATEGORIES = ["amendment", "arc", "event", "question", "other"] as const;
type Category = (typeof CATEGORIES)[number];

// Categorizes a new idea with the model instead of asking the resident
// to pick from a dropdown -- only called when a submission doesn't
// match an existing open topic (a merged submission inherits its
// topic's existing category). Falls back to "other" on any failure.
async function classifyCategory(
  title: string,
  ideaBody: string
): Promise<Category> {
  const prompt = `Classify this HOA resident submission into exactly one category. Respond with ONLY the single category word below, nothing else -- no punctuation, no explanation.

Categories:
- amendment: proposes changing or adding a bylaw, CC&R, or other governing rule
- arc: architectural/design topics (fences, paint, sheds, landscaping, ARC approvals)
- event: a social event, gathering, or community activity idea
- question: a question for the board that isn't proposing a change
- other: anything that doesn't clearly fit the above

Title: ${title}
Description: ${ideaBody}`;

  try {
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    const raw = (result.text ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");
    return (CATEGORIES as readonly string[]).includes(raw)
      ? (raw as Category)
      : "other";
  } catch {
    return "other";
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, full_name, email")
    .eq("id", user.id)
    .single();
  if (profile?.status !== "approved") {
    return NextResponse.json({ error: "Account approval required" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const ideaBody = typeof body?.body === "string" ? body.body.trim() : "";
  const isAnonymous = Boolean(body?.isAnonymous);
  const displayNameInput = typeof body?.displayName === "string" ? body.displayName.trim() : "";

  if (!title || !ideaBody) {
    return NextResponse.json(
      { error: "Title and description are required." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // 1. Embed the new idea and see if it matches an existing open topic.
  const embedding = await embedText(`${title}\n${ideaBody}`);

  const { data: match } = await admin.rpc("match_idea_topic", {
    query_embedding: embedding,
    match_threshold: 0.83,
  });

  let topicId: string;
  const merged = Boolean(match && match.length > 0);

  if (merged) {
    topicId = match![0].topic_id;
  } else {
    const category = await classifyCategory(title, ideaBody);
    const { data: newTopic, error: topicError } = await admin
      .from("idea_topics")
      .insert({ title, category, summary: ideaBody })
      .select("id")
      .single();
    if (topicError || !newTopic) {
      return NextResponse.json({ error: "Couldn't create the idea." }, { status: 500 });
    }
    topicId = newTopic.id;
  }

  // 2. Record the individual submission.
  const authorDisplayName = isAnonymous
    ? null
    : displayNameInput || profile.full_name || profile.email || "Resident";

  const { error: ideaError } = await admin.from("ideas").insert({
    topic_id: topicId,
    author_id: user.id,
    author_display_name: authorDisplayName,
    is_anonymous: isAnonymous,
    title,
    body: ideaBody,
    embedding,
  });
  if (ideaError) {
    return NextResponse.json({ error: "Couldn't save the idea." }, { status: 500 });
  }

  // 3. Regenerate the topic's AI summary from every idea now under it.
  const { data: topicIdeas } = await admin
    .from("ideas")
    .select("title, body")
    .eq("topic_id", topicId);

  if (topicIdeas && topicIdeas.length > 0) {
    const combined = topicIdeas
      .map((i, idx) => `Submission ${idx + 1}: ${i.title}\n${i.body}`)
      .join("\n\n");

    const prompt = `These are resident-submitted ideas for an HOA meeting agenda, grouped together because they're about the same underlying topic.

${combined}

Write a JSON object with exactly two fields:
- "title": a short (under 10 words) neutral label for this topic
- "summary": 2-4 sentences stating the shared main point, then noting any meaningfully different variations residents raised (specific numbers, conditions, or alternative approaches). Be concrete and neutral -- don't advocate for any side.

Respond with ONLY the JSON object, no markdown fences.`;

    try {
      const result = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      const raw = (result.text ?? "").trim().replace(/^```json\s*|\s*```$/g, "");
      const parsed = JSON.parse(raw);
      if (parsed.title && parsed.summary) {
        await admin
          .from("idea_topics")
          .update({
            title: parsed.title,
            summary: parsed.summary,
            updated_at: new Date().toISOString(),
          })
          .eq("id", topicId);
      }
    } catch {
      // AI summary is a nice-to-have -- if it fails, the topic still
      // exists with its original title/summary from the first idea.
    }
  }

  return NextResponse.json({ topicId, merged });
}
