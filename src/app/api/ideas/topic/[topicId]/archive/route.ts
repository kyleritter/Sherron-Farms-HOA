import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Admin-only archive/unarchive. Independent of the open/addressed
// status -- a topic can be archived either before or after it's marked
// addressed, per Kyle's request.
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
  const archived = Boolean(body?.archived);

  const admin = createAdminClient();
  const { error } = await admin
    .from("idea_topics")
    .update({
      archived,
      archived_at: archived ? new Date().toISOString() : null,
      archived_by: archived ? user.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", topicId);

  if (error) return NextResponse.json({ error: "Couldn't update the topic." }, { status: 500 });

  return NextResponse.json({ success: true });
}
