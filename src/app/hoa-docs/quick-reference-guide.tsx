"use client";

import { useState } from "react";
import { ChevronDown, FileText, Waves } from "lucide-react";
import { openDocumentInNewTab } from "@/lib/documents";

const CHEAT_SHEET = [
  {
    topic: "Document Purpose",
    articles:
      "Legal formation document filed with the State of North Carolina establishing the HOA as a non-profit.",
    ccrs: 'The legal "contract" recorded with the county that ties the rules, restrictions, and obligations to the land.',
    bylaws: "The internal operations manual detailing how the HOA is governed and run.",
    arc: "The design and aesthetic rulebook for the neighborhood.",
  },
  {
    topic: "Meetings & Notices",
    articles: "",
    ccrs: "",
    bylaws:
      "Primary: Dictates frequency of annual/board meetings, advance notice requirements, and quorum math.",
    arc: "",
  },
  {
    topic: "Voting Rights & Elections",
    articles: "",
    ccrs: "Secondary: Defines who is a member (e.g., Class A vs. Class B) and how voting weight is allocated.",
    bylaws:
      "Primary: Explains the mechanics of voting, proxies, and how Board members are elected or removed.",
    arc: "",
  },
  {
    topic: "Board of Directors",
    articles:
      "Secondary: Names initial incorporators and establishes baseline corporate liability.",
    ccrs: "",
    bylaws:
      "Primary: Outlines Board powers, duties, term lengths, and specific officer roles (President, Treasurer, etc.).",
    arc: "",
  },
  {
    topic: "Assessments (Dues)",
    articles: "",
    ccrs: "Primary: Establishes the legal obligation to pay, max allowable increases, late fees, and lien rights.",
    bylaws:
      "Secondary: Details the administrative process for drafting the annual budget and collecting dues.",
    arc: "",
  },
  {
    topic: "Property Use Rules",
    articles: "",
    ccrs: "Primary: Contains the core restrictive covenants (e.g., limits on pets, commercial vehicles, leasing, nuisances, trash).",
    bylaws: "",
    arc: "",
  },
  {
    topic: "Maintenance Duties",
    articles: "",
    ccrs: "Primary: Explicitly divides maintenance responsibilities between the Owner (the lot/home) and the HOA (common areas/amenities).",
    bylaws: "",
    arc: "",
  },
  {
    topic: "Architectural Changes",
    articles: "",
    ccrs: "Secondary: Grants the HOA the legal authority to mandate approvals and establishes the ARC committee.",
    bylaws: "",
    arc: "Primary: Specific design standards (fences, paint colors, sheds, landscaping) and the exact application/approval process.",
  },
  {
    topic: "How to Amend",
    articles: "Outlines statutory process for amending the corporate articles.",
    ccrs: "Requires 67% affirmative vote of total membership (recorded with the county).",
    bylaws: "Requires majority vote of a quorum of members at a meeting.",
    arc: "Requires a simple majority vote of the Board of Directors.",
  },
];

const COLUMNS = [
  {
    key: "articles",
    label: "Articles of Incorporation",
    doc: "Articles of Incorporation.pdf",
  },
  { key: "bylaws", label: "Bylaws", doc: "Bylaws.pdf" },
  { key: "ccrs", label: "CC&Rs (Declaration)", doc: "CCRs.pdf" },
  { key: "arc", label: "ARC Guidelines", doc: "ARC Guidelines.pdf" },
] as const;

function Cell({ text }: { text: string }) {
  if (!text) return <span className="text-neutral-300">—</span>;

  const match = text.match(/^(Primary|Secondary):\s*([\s\S]*)$/);
  if (!match) return <span className="text-neutral-700">{text}</span>;

  const [, kind, rest] = match;
  const isPrimary = kind === "Primary";

  return (
    <>
      <span
        className={`mr-1.5 inline-block rounded px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide ${
          isPrimary
            ? "bg-neutral-900 text-white"
            : "bg-neutral-100 text-neutral-500"
        }`}
      >
        {kind}
      </span>
      <span className="text-neutral-700">{rest}</span>
    </>
  );
}

function DocHeaderLink({ label, doc }: { label: string; doc: string }) {
  return (
    <button
      type="button"
      onClick={() => openDocumentInNewTab(doc, 1)}
      className="inline-flex items-center gap-1 text-left uppercase hover:underline"
      title={`Open ${label} (PDF, opens in a new tab)`}
    >
      <span>{label}</span>
      <FileText size={12} className="shrink-0 opacity-80" />
    </button>
  );
}

export default function QuickReferenceGuide() {
  const [open, setOpen] = useState(false);

  return (
    <section className="overflow-hidden rounded-md border border-neutral-200 bg-white">
      <div className="px-4 py-3">
        <h2 className="text-base font-semibold text-neutral-900">
          HOA Documents Quick Reference Guide
        </h2>
        <p className="mt-0.5 text-xs text-neutral-600">
          Where to find things across the Articles of Incorporation,
          CC&amp;Rs, Bylaws, and ARC Guidelines. Unofficial — always
          confirm against the source PDFs (linked in the table headers)
          for anything binding.
        </p>
      </div>

      <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-2.5">
        <button
          type="button"
          onClick={() => openDocumentInNewTab("Pool Rules - 2026.pdf", 1)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:underline"
          title="Open the 2026 Pool Rules (PDF, opens in a new tab)"
        >
          <Waves size={14} className="shrink-0 opacity-80" />
          <span>2026 Pool Rules</span>
          <FileText size={12} className="shrink-0 opacity-60" />
        </button>
      </div>

      <div className="overflow-x-auto border-t border-neutral-200">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-sm font-bold uppercase tracking-wide">
              <th className="bg-neutral-900 px-3 py-2.5 text-neutral-100">
                <button
                  type="button"
                  onClick={() => setOpen((o) => !o)}
                  aria-expanded={open}
                  aria-label={open ? "Collapse table" : "Expand table"}
                  title={open ? "Collapse table" : "Expand table"}
                  className="flex items-center justify-center rounded p-1 text-neutral-100 hover:bg-neutral-700"
                >
                  <ChevronDown
                    size={20}
                    strokeWidth={2.5}
                    className={`transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="bg-neutral-900 px-3 py-2.5 text-neutral-100"
                >
                  <DocHeaderLink label={col.label} doc={col.doc} />
                </th>
              ))}
            </tr>
          </thead>
          {open && (
            <tbody>
              {CHEAT_SHEET.map((row, i) => (
                <tr
                  key={row.topic}
                  className={`border-b border-neutral-100 align-top last:border-0 ${
                    i % 2 === 1 ? "bg-neutral-50/60" : ""
                  }`}
                >
                  <td className="px-3 py-2.5 font-semibold text-neutral-900">
                    {row.topic}
                  </td>
                  {COLUMNS.map((col) => (
                    <td key={col.key} className="px-3 py-2.5">
                      <Cell text={row[col.key]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
    </section>
  );
}
