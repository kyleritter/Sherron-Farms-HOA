"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function VerifyPage() {
  const router = useRouter();
  const [streetAddress, setStreetAddress] = useState("");
  const [communityPassword, setCommunityPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // No separate sign-in step right now -- starting a session here (an
    // anonymous Supabase Auth user) is what gives this browser a
    // `profiles` row for the address/password check below and for the
    // resident-only pages afterward. Skipped if one already exists.
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      const { error: signInError } = await supabase.auth.signInAnonymously();
      if (signInError) {
        setError("Couldn't start your session. Try again.");
        setSubmitting(false);
        return;
      }
    }

    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streetAddress, communityPassword }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Try again.");
      setSubmitting(false);
      return;
    }

    router.push(data.isAdmin ? "/admin" : "/hoa-docs");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-50 px-4 text-center">
      <div className="flex flex-col items-center gap-3">
        <Image src="/logo.png" alt="SF-HOA-Doc-Ref logo" width={56} height={56} priority />
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            SF-HOA-Doc-Ref
          </h1>
          <p className="mt-1 text-xs text-neutral-500">
            An unofficial, resident-run reference site &mdash; not an official
            Sherron Farms HOA site.
          </p>
          <p className="mt-2 max-w-md text-sm text-neutral-600">
            Enter your street address and the community password to get
            started.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-xs flex-col gap-3 text-left"
      >
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Street address
          <input
            type="text"
            value={streetAddress}
            onChange={(e) => setStreetAddress(e.target.value)}
            placeholder="123 Sherron Farms Dr"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Community password
          <input
            type="password"
            value={communityPassword}
            onChange={(e) => setCommunityPassword(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
            required
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {submitting ? "Verifying…" : "Continue"}
        </button>
      </form>

      <p className="max-w-sm text-xs text-neutral-500">
        Don&apos;t know the community password? Ask any HOA board member or
        admin.
      </p>
    </div>
  );
}
