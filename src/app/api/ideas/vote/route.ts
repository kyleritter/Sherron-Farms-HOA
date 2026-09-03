import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .single();
  if (profile?.status !== "approved") {
    return NextResponse.json({ error: "Account approval required" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const topicId = typeof body?.topicId === "string" ? body.topicId : null;
  const value = body?.value;

  if (!topicId || ![1, -1, 0].includes(value)) {
    return NextResponse.json({ error: "Invalid vote." }, { status: 400 });
  }

  const admin = createAdminClient();

  if (value === 0) {
    await admin.from("idea_votes").delete().eq("topic_id", topicId).eq("voter_id", user.id);
  } else {
    await admin
      .from("idea_votes")
      .upsert(
        { topic_id: topicId, voter_id: user.id, vote_value: value },
        { onConflict: "topic_id,voter_id" }
      );
  }

  const { data: counts } = await admin.rpc("get_idea_vote_counts");
  const row = counts?.find((c: { topic_id: string }) => c.topic_id === topicId);

  return NextResponse.json({
    myVote: value === 0 ? null : value,
    upvotes: row?.upvotes ?? 0,
    downvotes: row?.downvotes ?? 0,
  });
}
