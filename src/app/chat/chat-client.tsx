"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { Send } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

export default function ChatClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    const nextMessages: Message[] = [
      ...messages,
      { role: "user", content: question },
    ];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => null);
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              errBody?.error === "Account approval required"
                ? "Your account is not yet approved."
                : "Something went wrong. Please try again.",
          },
        ]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages((m) => [
          ...m.slice(0, -1),
          { role: "assistant", content: assistantText },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-4 py-3">
        <h1 className="text-base font-semibold text-neutral-900">
          Sherron Farms HOA Document Assistant
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.length === 0 && (
            <p className="text-sm text-neutral-500">
              Ask about the CC&amp;Rs, Bylaws, ARC Guidelines, budget, or
              meeting minutes — e.g. &ldquo;Are sheds allowed, and what size
              limit applies?&rdquo;
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "ml-auto bg-neutral-900 text-white"
                  : "mr-auto bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200"
              }`}
            >
              {m.content || "…"}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-neutral-200 bg-white px-4 py-3"
      >
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about the HOA documents…"
            disabled={loading}
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-2xl text-center text-xs text-neutral-400">
          Informational only — not a substitute for the signed governing
          documents or a formal ruling from the Board.
        </p>
      </form>
    </div>
  );
}
