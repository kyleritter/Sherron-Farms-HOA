"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowBigUp, ArrowBigDown, ChevronDown, ChevronUp } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  amendment: "Bylaw / CC&R amendment",
  arc: "ARC / architectural",
  event: "Event idea",
  question: "Question for the board",
  other: "Other",
};

type IdeaSubmission = {
  id: string;
  title: string;
  body: string;
  author_display_name: string | null;
  is_anonymous: boolean;
  created_at: string;
};

type Topic = {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  status: "open" | "addressed";
  addressed_at: string | null;
  decision_summary: string | null;
  addressed_notes: string | null;
};

export default function TopicCard({
  topic,
  ideas,
  upvotes,
  downvotes,
  myVote,
  isAdmin,
}: {
  topic: Topic;
  ideas: IdeaSubmission[];
  upvotes: number;
  downvotes: number;
  myVote: 1 | -1 | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [addressing, setAddressing] = useState(false);
  const [decisionSummary, setDecisionSummary] = useState("");
  const [addressedNotes, setAddressedNotes] = useState("");
  const [localUp, setLocalUp] = useState(upvotes);
  const [localDown, setLocalDown] = useState(downvotes);
  const [localVote, setLocalVote] = useState(myVote);
  const [busy, setBusy] = useState(false);

  async function vote(value: 1 | -1) {
    if (busy) return;
    const next = localVote === value ? 0 : value;
    setBusy(true);
    const res = await fetch("/api/ideas/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId: topic.id, value: next }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && data) {
      setLocalUp(data.upvotes);
      setLocalDown(data.downvotes);
      setLocalVote(data.myVote);
    }
  }

  async function markAddressed() {
    if (!decisionSummary.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/ideas/topic/${topic.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "addressed",
        decisionSummary,
        addressedNotes,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setAddressing(false);
      router.refresh();
    }
  }

  async function reopen() {
    setBusy(true);
    await fetch(`/api/ideas/topic/${topic.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "open" }),
    });
    setBusy(false);
    router.refresh();
  }

  const net = localUp - localDown;

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex gap-4">
        <div className="flex flex-col items-center gap-0.5 pt-0.5">
          <button
            onClick={() => vote(1)}
            disabled={busy || topic.status === "addressed"}
            className={`rounded p-1 ${localVote === 1 ? "text-green-600" : "text-neutral-400 hover:text-neutral-700"} disabled:opacity-40`}
          >
            <ArrowBigUp size={22} fill={localVote === 1 ? "currentColor" : "none"} />
          </button>
          <span className="text-sm font-semibold text-neutral-900">{net}</span>
          <button
            onClick={() => vote(-1)}
            disabled={busy || topic.status === "addressed"}
            className={`rounded p-1 ${localVote === -1 ? "text-red-600" : "text-neutral-400 hover:text-neutral-700"} disabled:opacity-40`}
          >
            <ArrowBigDown size={22} fill={localVote === -1 ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900">{topic.title}</h3>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
              {CATEGORY_LABELS[topic.category] ?? topic.category}
            </span>
          </div>

          {topic.summary && (
            <p className="mt-1.5 text-sm text-neutral-700">{topic.summary}</p>
          )}

          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-800"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {ideas.length} submission{ideas.length === 1 ? "" : "s"}
          </button>

          {expanded && (
            <div className="mt-2 flex flex-col gap-2 border-t border-neutral-100 pt-2">
              {ideas.map((idea) => (
                <div key={idea.id} className="rounded bg-neutral-50 p-2.5 text-sm">
                  <p className="font-medium text-neutral-800">{idea.title}</p>
                  <p className="mt-0.5 text-neutral-600">{idea.body}</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {idea.is_anonymous ? "Anonymous" : idea.author_display_name ?? "Resident"}
                  </p>
                </div>
              ))}
            </div>
          )}

          {topic.status === "addressed" && (
            <div className="mt-3 rounded-md bg-green-50 p-3 text-sm">
              <p className="font-medium text-green-900">
                Addressed{topic.addressed_at ? ` — ${new Date(topic.addressed_at).toLocaleDateString()}` : ""}
              </p>
              <p className="mt-1 text-green-800">{topic.decision_summary}</p>
              {topic.addressed_notes && (
                <p className="mt-1 text-green-700">{topic.addressed_notes}</p>
              )}
              {isAdmin && (
                <button
                  onClick={reopen}
                  disabled={busy}
                  className="mt-2 text-xs font-medium text-green-800 underline disabled:opacity-50"
                >
                  Reopen
                </button>
              )}
            </div>
          )}

          {isAdmin && topic.status === "open" && (
            <div className="mt-3">
              {!addressing ? (
                <button
                  onClick={() => setAddressing(true)}
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                >
                  Mark addressed
                </button>
              ) : (
                <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                  <textarea
                    value={decisionSummary}
                    onChange={(e) => setDecisionSummary(e.target.value)}
                    placeholder="What was decided / the action taken"
                    rows={2}
                    className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <textarea
                    value={addressedNotes}
                    onChange={(e) => setAddressedNotes(e.target.value)}
                    placeholder="Any other notes (optional)"
                    rows={2}
                    className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={markAddressed}
                      disabled={busy || !decisionSummary.trim()}
                      className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setAddressing(false)}
                      className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
