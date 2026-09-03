"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-50 px-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">
          Sherron Farms HOA Document Assistant
        </h1>
        <p className="mt-2 max-w-md text-sm text-neutral-600">
          Sign in with the Google account associated with your resident
          email to ask questions about the CC&amp;Rs, Bylaws, ARC
          Guidelines, and meeting minutes.
        </p>
      </div>
      <button
        onClick={signInWithGoogle}
        className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
      >
        Sign in with Google
      </button>
      <p className="max-w-sm text-xs text-neutral-500">
        New accounts require one-time approval from an HOA administrator
        before they can access the assistant.
      </p>
    </div>
  );
}
