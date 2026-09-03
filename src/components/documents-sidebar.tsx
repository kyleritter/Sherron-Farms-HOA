"use client";

import { FileText } from "lucide-react";
import { HOA_DOCUMENTS } from "@/lib/documents";
import type { DocumentTarget } from "./document-panel";

export default function DocumentsSidebar({
  onSelect,
}: {
  onSelect: (target: DocumentTarget) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-200 px-3 py-2">
        <p className="text-sm font-medium text-neutral-900">
          Source Documents
        </p>
        <p className="text-xs text-neutral-500">
          The governing documents behind the cheat sheet and chat.
        </p>
      </div>
      <ul className="divide-y divide-neutral-100 overflow-y-auto">
        {HOA_DOCUMENTS.map((doc) => (
          <li key={doc.name}>
            <button
              type="button"
              onClick={() => onSelect({ name: doc.name, page: 1 })}
              className="flex w-full items-center gap-2.5 px-3 py-3 text-left text-sm hover:bg-neutral-50"
            >
              <FileText size={16} className="shrink-0 text-neutral-400" />
              <span className="font-medium text-neutral-900">
                {doc.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
