import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

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
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const status = body?.status === "addressed" || body?.status === "open" ? body.status : null;
  if (!status) return NextResponse.json({ error: "Invalid status." }, { status: 400 });

  const admin = createAdminClient();

  if (status === "addressed") {
    const decisionSummary = typeof body?.decisionSummary === "string" ? body.decisionSummary.trim() : "";
    if (!decisionSummary) {
      return NextResponse.json({ error: "Decision/action taken is required." }, { status: 400 });
    }
    const addressedNotes = typeof body?.addressedNotes === "string" ? body.addressedNotes.trim() : null;
    const addressedAt = typeof body?.addressedAt === "string" && body.addressedAt
      ? new Date(body.addressedAt).toISOString()
      : new Date().toISOString();

    const { error } = await admin
      .from("idea_topics")
      .update({
        status: "addressed",
        addressed_at: addressedAt,
        addressed_by: user.id,
        decision_summary: decisionSummary,
        addressed_notes: addressedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", topicId);
    if (error) return NextResponse.json({ error: "Couldn't update the topic." }, { status: 500 });
  } else {
    const { error } = await admin
      .from("idea_topics")
      .update({
        status: "open",
        addressed_at: null,
        addressed_by: null,
        decision_summary: null,
        addressed_notes: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", topicId);
    if (error) return NextResponse.json({ error: "Couldn't update the topic." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
