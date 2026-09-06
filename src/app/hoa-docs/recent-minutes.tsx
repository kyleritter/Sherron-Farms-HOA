"use client";

import { FileText } from "lucide-react";
import { MINUTES_DOCUMENTS, openDocumentInNewTab } from "@/lib/documents";

export default function RecentMinutes() {
  return (
    <section className="overflow-hidden rounded-md border border-neutral-200 bg-white">
      <div className="px-4 py-3">
        <h2 className="text-base font-semibold text-neutral-900">
          Recent Meeting Minutes
        </h2>
        <p className="mt-0.5 text-xs text-neutral-600">
          Opens in a new tab. Also searchable in the chat above.
        </p>
      </div>
      <ul className="divide-y divide-neutral-100 border-t border-neutral-200">
        {MINUTES_DOCUMENTS.map((doc) => (
          <li key={doc.name}>
            <button
              type="button"
              onClick={() => openDocumentInNewTab(doc.name, 1)}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50"
              title={`Open minutes from ${doc.label} (PDF, opens in a new tab)`}
            >
              <FileText size={15} className="shrink-0 text-neutral-400" />
              <span>{doc.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
