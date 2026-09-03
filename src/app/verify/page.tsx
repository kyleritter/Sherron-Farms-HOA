"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

    router.push(data.isAdmin ? "/admin" : "/chat");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-50 px-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">
          One more step
        </h1>
        <p className="mt-2 max-w-md text-sm text-neutral-600">
          You&apos;re signed in. To confirm you&apos;re a Sherron Farms
          resident, enter your street address and the community password.
        </p>
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
          {submitting ? "Verifying…" : "Verify"}
        </button>
      </form>

      <p className="max-w-sm text-xs text-neutral-500">
        Don&apos;t know the community password? Ask any HOA board member or
        admin.
      </p>
    </div>
  );
}
