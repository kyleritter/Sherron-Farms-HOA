"use client";

import AppNav from "@/components/app-nav";
import ChatPanel from "@/components/chat-panel";
import CheatSheet from "./cheat-sheet";

export default function HoaDocsClient({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex h-screen flex-col bg-neutral-50">
      <AppNav isAdmin={isAdmin} />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6">
          <div className="flex min-h-[480px] flex-1 flex-col overflow-hidden rounded-md border border-neutral-200 bg-white">
            <div className="border-b border-neutral-200 px-3 py-2">
              <p className="text-sm font-medium text-neutral-900">
                Ask a question
              </p>
            </div>
            <div className="min-h-0 flex-1">
              <ChatPanel />
            </div>
          </div>

          <div className="mt-6 pb-2">
            <CheatSheet />
          </div>
        </div>
      </div>
    </div>
  );
}
