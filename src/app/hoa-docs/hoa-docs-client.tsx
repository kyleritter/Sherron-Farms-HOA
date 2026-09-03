"use client";

import { useState } from "react";
import AppNav from "@/components/app-nav";
import ChatPanel from "@/components/chat-panel";
import DocumentPanel, { type DocumentTarget } from "@/components/document-panel";
import DocumentsSidebar from "@/components/documents-sidebar";
import CheatSheet from "./cheat-sheet";

export default function HoaDocsClient({ isAdmin }: { isAdmin: boolean }) {
  const [docTarget, setDocTarget] = useState<DocumentTarget | null>(null);

  return (
    <div className="flex h-screen flex-col bg-neutral-50">
      <AppNav isAdmin={isAdmin} />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-4 py-6">
            <h1 className="text-xl font-semibold text-neutral-900">
              HOA Documents Cheat Sheet
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Where to find things across the Articles of Incorporation,
              CC&amp;Rs, Bylaws, and ARC Guidelines. Unofficial — always
              confirm against the actual documents (in the sidebar) for
              anything binding.
            </p>
            <div className="mt-6">
              <CheatSheet />
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-4">
            <div className="flex min-h-[480px] flex-1 flex-col overflow-hidden rounded-md border border-neutral-200 bg-white">
              <div className="border-b border-neutral-200 px-3 py-2">
                <p className="text-sm font-medium text-neutral-900">
                  Ask a question
                </p>
              </div>
              <div className="min-h-0 flex-1">
                <ChatPanel onOpenCitation={setDocTarget} />
              </div>
            </div>
          </div>
        </div>

        <div className="hidden w-[340px] shrink-0 border-l border-neutral-200 bg-white lg:block">
          {docTarget ? (
            <DocumentPanel target={docTarget} onClose={() => setDocTarget(null)} />
          ) : (
            <DocumentsSidebar onSelect={setDocTarget} />
          )}
        </div>
      </div>
    </div>
  );
}
