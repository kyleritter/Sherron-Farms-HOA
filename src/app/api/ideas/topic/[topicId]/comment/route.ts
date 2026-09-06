import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { regenerateTopicSummary } from "@/lib/ideas";

// Free-text follow-up comments on an idea topic -- open to any approved
// resident (unlike marking a topic addressed, which is admin-only).
// Comments are folded into the topic's AI summary so the overview
// reflects the full discussion, not just the original submissions.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  const { topicId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, full_name, email, street_address")
    .eq("id", user.id)
    .single();
  if (profile?.status !== "approved") {
    return NextResponse.json({ error: "Account approval required" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const commentBody = typeof body?.body === "string" ? body.body.trim() : "";
  const isAnonymous = Boolean(body?.isAnonymous);
  const displayNameInput = typeof body?.displayName === "string" ? body.displayName.trim() : "";

  if (!commentBody) {
    return NextResponse.json({ error: "Comment can't be empty." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Confirm the topic exists before attaching a comment to it.
  const { data: topic } = await admin
    .from("idea_topics")
    .select("id")
    .eq("id", topicId)
    .single();
  if (!topic) {
    return NextResponse.json({ error: "Topic not found." }, { status: 404 });
  }

  const authorDisplayName = isAnonymous
    ? null
    : displayNameInput || profile.full_name || profile.street_address || profile.email || "Resident";

  const { data: comment, error } = await admin
    .from("idea_comments")
    .insert({
      topic_id: topicId,
      author_id: user.id,
      author_display_name: authorDisplayName,
      is_anonymous: isAnonymous,
      body: commentBody,
    })
    .select("id, body, author_display_name, is_anonymous, created_at")
    .single();

  if (error || !comment) {
    return NextResponse.json({ error: "Couldn't save the comment." }, { status: 500 });
  }

  await regenerateTopicSummary(admin, topicId);

  return NextResponse.json({ comment });
}
