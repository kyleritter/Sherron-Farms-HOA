"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { fetchDocumentSignedUrl, HOA_DOCUMENTS } from "@/lib/documents";

export type DocumentTarget = { name: string; page: number };

function labelFor(name: string) {
  return HOA_DOCUMENTS.find((d) => d.name === name)?.label ?? name;
}

export default function DocumentPanel({
  target,
  onClose,
}: {
  target: DocumentTarget;
  onClose: () => void;
}) {
  // Keyed by target so a stale response from a previous citation click
  // can never render as if it belonged to the current one; `url`/`error`
  // below fall back to "still loading" until `result.key` catches up,
  // rather than resetting state synchronously inside the effect body.
  const [result, setResult] = useState<{
    key: string;
    url: string | null;
    error: string | null;
  }>({ key: "", url: null, error: null });

  const targetKey = `${target.name}:${target.page}`;

  useEffect(() => {
    let cancelled = false;
    fetchDocumentSignedUrl(target.name)
      .then((u) => {
        if (!cancelled) setResult({ key: targetKey, url: u, error: null });
      })
      .catch(() => {
        if (!cancelled)
          setResult({
            key: targetKey,
            url: null,
            error: `Could not open ${target.name}.`,
          });
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch whenever a different citation is clicked, including a
    // different page of the same document (the iframe key below jumps
    // to the new page even when the signed URL itself is unchanged).
  }, [target.name, targetKey]);

  const isCurrent = result.key === targetKey;
  const url = isCurrent ? result.url : null;
  const error = isCurrent ? result.error : null;

  return (
    <div className="flex h-full w-full flex-col border-l border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-900">
            {labelFor(target.name)}
          </p>
          <p className="text-xs text-neutral-500">Page {target.page}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
          aria-label="Close document viewer"
        >
          <X size={16} />
        </button>
      </div>
      <div className="relative flex-1">
        {!url && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-red-600">
            {error}
          </div>
        )}
        {url && (
          <iframe
            key={`${target.name}-${target.page}`}
            src={`${url}#page=${target.page}`}
            title={labelFor(target.name)}
            className="h-full w-full"
          />
        )}
      </div>
    </div>
  );
}
