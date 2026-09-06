import { ai, GEMINI_MODEL } from "@/lib/gemini";
import type { SupabaseClient } from "@supabase/supabase-js";

// Regenerates a topic's AI-written title/summary from every idea
// submission AND every follow-up comment under it. Shared by
// /api/ideas (a new or merged submission) and
// /api/ideas/topic/[topicId]/comment (a new comment), so the
// AI overview always reflects the current full discussion.
export async function regenerateTopicSummary(
  admin: SupabaseClient,
  topicId: string
): Promise<void> {
  const { data: topicIdeas } = await admin
    .from("ideas")
    .select("title, body")
    .eq("topic_id", topicId);

  if (!topicIdeas || topicIdeas.length === 0) return;

  const { data: topicComments } = await admin
    .from("idea_comments")
    .select("body")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: true });

  const combinedIdeas = (topicIdeas as { title: string; body: string }[])
    .map((i, idx) => `Submission ${idx + 1}: ${i.title}\n${i.body}`)
    .join("\n\n");

  const comments = (topicComments ?? []) as { body: string }[];
  const combinedComments = comments
    .map((c, idx) => `Comment ${idx + 1}: ${c.body}`)
    .join("\n\n");

  const prompt = `These are resident-submitted ideas for an HOA meeting agenda, grouped together because they're about the same underlying topic${
    combinedComments ? ", along with follow-up comments residents added afterward" : ""
  }.

${combinedIdeas}
${combinedComments ? `\n\nFollow-up comments:\n${combinedComments}` : ""}

Write a JSON object with exactly two fields:
- "title": a short (under 10 words) neutral label for this topic
- "summary": 2-4 sentences stating the shared main point${
    combinedComments ? ", incorporating relevant context from the follow-up comments," : ""
  } then noting any meaningfully different variations residents raised (specific numbers, conditions, or alternative approaches). Be concrete and neutral -- don't advocate for any side.

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
    // AI summary is a nice-to-have -- leave the existing title/summary
    // as-is if generation or parsing fails.
  }
}
