import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { normalizeAddress } from "@/lib/address";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const streetAddress = typeof body?.streetAddress === "string" ? body.streetAddress.trim() : "";
  const communityPassword = typeof body?.communityPassword === "string" ? body.communityPassword : "";

  if (!streetAddress || !communityPassword) {
    return NextResponse.json(
      { error: "Street address and community password are both required." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: settings, error: settingsError } = await admin
    .from("community_settings")
    .select("password_hash, admin_address_normalized")
    .eq("id", true)
    .single();

  if (settingsError || !settings) {
    return NextResponse.json(
      {
        error: "Community settings aren't configured yet. Contact an admin.",
        debug: settingsError ? { message: settingsError.message, code: settingsError.code, details: settingsError.details, hint: settingsError.hint } : "no settings row",
      },
      { status: 500 }
    );
  }

  const passwordMatches = await bcrypt.compare(communityPassword, settings.password_hash);
  if (!passwordMatches) {
    return NextResponse.json({ error: "Incorrect community password." }, { status: 400 });
  }

  const addressNormalized = normalizeAddress(streetAddress);
  const isAdmin = addressNormalized === settings.admin_address_normalized;

  const { error: updateError } = await admin
    .from("profiles")
    .update({
      street_address: streetAddress,
      address_normalized: addressNormalized,
      status: "approved",
      role: isAdmin ? "admin" : "resident",
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "Couldn't save your verification. Try again." }, { status: 500 });
  }

  return NextResponse.json({ isAdmin });
}
