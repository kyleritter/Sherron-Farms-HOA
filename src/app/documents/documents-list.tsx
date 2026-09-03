"use client";

import { useState } from "react";
import { FileText, ExternalLink, Loader2 } from "lucide-react";
import { HOA_DOCUMENTS, fetchDocumentSignedUrl } from "@/lib/documents";

export default function DocumentsList() {
  const [openingName, setOpeningName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen(name: string) {
    setError(null);
    setOpeningName(name);
    try {
      const url = await fetchDocumentSignedUrl(name);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setError(`Could not open ${name}. Try again in a moment.`);
    } finally {
      setOpeningName(null);
    }
  }

  return (
    <div className="mt-6">
      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-md border border-neutral-200 bg-white">
        {HOA_DOCUMENTS.map((doc) => (
          <li key={doc.name}>
            <button
              onClick={() => handleOpen(doc.name)}
              disabled={openingName === doc.name}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-neutral-50 disabled:opacity-60"
            >
              <FileText size={18} className="shrink-0 text-neutral-400" />
              <span className="flex-1 font-medium text-neutral-900">
                {doc.label}
              </span>
              {openingName === doc.name ? (
                <Loader2 size={16} className="animate-spin text-neutral-400" />
              ) : (
                <ExternalLink size={16} className="text-neutral-400" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
