import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase OAuth redirect target. Exchanges the auth code for a session,
 * then hands off to the middleware to route the user to /chat, /pending,
 * or /access-denied based on their profile status.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/chat`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
