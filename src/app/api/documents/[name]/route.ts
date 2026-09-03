import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { HOA_DOCUMENT_NAMES } from "@/lib/documents";

// A fixed allowlist instead of trusting the URL param directly, since
// this becomes a storage path.
const KNOWN_DOCUMENTS = new Set(HOA_DOCUMENT_NAMES);

const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes -- plenty for one open/view

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .single();
  if (profile?.status !== "approved") {
    return NextResponse.json(
      { error: "Account approval required" },
      { status: 403 }
    );
  }

  const { name } = await params;
  const documentName = decodeURIComponent(name);
  if (!KNOWN_DOCUMENTS.has(documentName)) {
    return NextResponse.json({ error: "Unknown document" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("hoa-documents")
    .createSignedUrl(documentName, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    return NextResponse.json(
      { error: "Could not generate a link for this document" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: data.signedUrl });
}
