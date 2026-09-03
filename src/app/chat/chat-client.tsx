"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { Send } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import AppNav from "@/components/app-nav";
import DocumentPanel, { type DocumentTarget } from "./document-panel";
import { HOA_DOCUMENT_NAMES } from "@/lib/documents";

type Message = { role: "user" | "assistant"; content: string };

function TypingIndicator() {
  return (
    <div className="mr-auto flex max-w-[85%] items-center gap-1 rounded-lg bg-white px-4 py-3 text-sm text-neutral-400 shadow-sm ring-1 ring-neutral-200">
      <span className="sr-only">Thinking…</span>
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-300 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-300 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-300" />
    </div>
  );
}

// Matches the citation format the chat is instructed to use, e.g.
// "(Bylaws.pdf, Section 3, p. 5)" -- captures the document name and the
// final page number in the parenthetical. Only recognizes documents we
// actually have in storage.
const DOC_NAME_PATTERN = HOA_DOCUMENT_NAMES.map((n) =>
  n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
).join("|");
const CITATION_REGEX = new RegExp(
  `\\((${DOC_NAME_PATTERN})[^()]*?p\\.\\s*(\\d+)\\)`,
  "g"
);

// Rewrites plain-text citations into markdown links using a fake
// `citation://` scheme *before* markdown parsing, so ReactMarkdown does
// the hard work of handling citations that land inside bold/list/etc
// nesting -- we just intercept the `a` tag afterward and render a
// button instead of a real link.
function linkifyCitations(markdown: string): string {
  return markdown.replace(CITATION_REGEX, (full, docName, page) => {
    const href = `citation://${encodeURIComponent(docName)}/${page}`;
    return `[${full}](${href})`;
  });
}

function makeMarkdownComponents(
  onOpenCitation: (target: DocumentTarget) => void
): Components {
  return {
    a: ({ href, children }) => {
      if (href?.startsWith("citation://")) {
        const rest = href.slice("citation://".length);
        const lastSlash = rest.lastIndexOf("/");
        const docName = decodeURIComponent(rest.slice(0, lastSlash));
        const page = parseInt(rest.slice(lastSlash + 1), 10) || 1;
        return (
          <button
            type="button"
            onClick={() => onOpenCitation({ name: docName, page })}
            className="font-medium text-blue-700 underline decoration-dotted underline-offset-2 hover:text-blue-900"
          >
            {children}
          </button>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {children}
        </a>
      );
    },
  };
}

export default function ChatClient({ isAdmin }: { isAdmin: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // True from submit until the first token (or a one-shot reply) has
  // actually landed in `messages` -- drives the typing indicator, kept
  // separate from `loading` (which also disables the input/button).
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [docTarget, setDocTarget] = useState<DocumentTarget | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const markdownComponents = makeMarkdownComponents(setDocTarget);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, awaitingReply]);

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
    setAwaitingReply(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => null);
        setAwaitingReply(false);
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

      // The route returns a plain-text token stream when it has an
      // answer, but a one-shot JSON object (e.g. "no matching
      // documents") when it doesn't -- render that message directly
      // instead of dumping the raw JSON into the chat.
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await res.json().catch(() => null);
        setAwaitingReply(false);
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              body?.content ?? "Something went wrong. Please try again.",
          },
        ]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      let started = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        if (!started) {
          // Swap the typing indicator out for the real bubble the
          // moment the first token arrives.
          started = true;
          setAwaitingReply(false);
          setMessages((m) => [
            ...m,
            { role: "assistant", content: assistantText },
          ]);
        } else {
          setMessages((m) => [
            ...m.slice(0, -1),
            { role: "assistant", content: assistantText },
          ]);
        }
      }
    } finally {
      setLoading(false);
      setAwaitingReply(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-neutral-50">
      <AppNav isAdmin={isAdmin} />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
              {messages.length === 0 && (
                <p className="text-sm text-neutral-500">
                  Ask about the CC&amp;Rs, Bylaws, ARC Guidelines, budget, or
                  meeting minutes — e.g. &ldquo;Are sheds allowed, and what
                  size limit applies?&rdquo; Citations you can click will
                  open the exact page on the right.
                </p>
              )}
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div
                    key={i}
                    className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-lg bg-neutral-900 px-4 py-2.5 text-sm text-white"
                  >
                    {m.content}
                  </div>
                ) : (
                  <div
                    key={i}
                    className="mr-auto max-w-[85%] rounded-lg bg-white px-4 py-2.5 text-sm text-neutral-900 shadow-sm ring-1 ring-neutral-200 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {linkifyCitations(m.content) || "…"}
                    </ReactMarkdown>
                  </div>
                )
              )}
              {awaitingReply && <TypingIndicator />}
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
              This response is for informational convenience. Refer to the
              signed documents or contact the board for formal
              interpretations.
            </p>
          </form>
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
