"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { value: "amendment", label: "Bylaw / CC&R amendment" },
  { value: "arc", label: "ARC / architectural" },
  { value: "event", label: "Event idea" },
  { value: "question", label: "Question for the board" },
  { value: "other", label: "Other" },
];

export default function IdeaSubmitForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("other");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [displayName, setDisplayName] = useState(defaultName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    const res = await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, category, isAnonymous, displayName }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Try again.");
      return;
    }

    setTitle("");
    setBody("");
    setCategory("other");
    setOpen(false);
    setNotice(
      data.merged
        ? "Added to an existing similar idea below."
        : "Idea submitted."
    );
    router.refresh();
  }

  if (!open) {
    return (
      <div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          + Submit an idea
        </button>
        {notice && <p className="mt-2 text-sm text-green-700">{notice}</p>}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-white p-4"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Short title"
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        required
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Describe the idea, amendment, question, or request..."
        rows={4}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        required
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
      >
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={isAnonymous}
          onChange={(e) => setIsAnonymous(e.target.checked)}
        />
        Submit anonymously
      </label>

      {!isAnonymous && (
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Name shown with your submission"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit idea"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
