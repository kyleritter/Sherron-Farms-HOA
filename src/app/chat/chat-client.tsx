"use client";

import { useState } from "react";
import AppNav from "@/components/app-nav";
import ChatPanel from "@/components/chat-panel";
import DocumentPanel, { type DocumentTarget } from "@/components/document-panel";

export default function ChatClient({ isAdmin }: { isAdmin: boolean }) {
  const [docTarget, setDocTarget] = useState<DocumentTarget | null>(null);

  return (
    <div className="flex h-screen flex-col bg-neutral-50">
      <AppNav isAdmin={isAdmin} />

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <ChatPanel onOpenCitation={setDocTarget} />
        </div>

        {docTarget && (
          <div className="hidden w-[42%] min-w-[360px] max-w-[560px] md:block">
            <DocumentPanel target={docTarget} onClose={() => setDocTarget(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
