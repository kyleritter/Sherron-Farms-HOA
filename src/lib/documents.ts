// Shared list of source governing documents. `name` must exactly match
// both the storage object name in the private 'hoa-documents' Supabase
// Storage bucket (see scripts/upload_source_pdfs.py) and the
// `document_name` column in hoa_document_chunks, since chat citations
// use this to link back to the right file.
export const HOA_DOCUMENTS = [
  { name: "CCRs.pdf", label: "Covenants, Conditions & Restrictions (CC&Rs)" },
  { name: "Bylaws.pdf", label: "Bylaws" },
  { name: "ARC Guidelines.pdf", label: "ARC Guidelines" },
  {
    name: "Articles of Incorporation.pdf",
    label: "Articles of Incorporation",
  },
  { name: "Pool Rules - 2026.pdf", label: "2026 Pool Rules" },
] as const;

export type HoaDocumentName = (typeof HOA_DOCUMENTS)[number]["name"];

export const HOA_DOCUMENT_NAMES: readonly string[] = HOA_DOCUMENTS.map(
  (d) => d.name
);

// Financial documents (monthly statements + annual budget), shown in the
// document repository at the bottom of the Financials page. Same
// 'hoa-documents' Supabase Storage bucket, uploaded via
// scripts/upload_financial_pdfs.py. These aren't used as chat citation
// targets, just direct downloads/views.
export const FINANCIAL_DOCUMENTS = [
  { name: "Financials - 2026 Annual Budget.pdf", label: "2026 Annual Budget" },
  { name: "Financials - January 2026.pdf", label: "January 2026 Statement" },
  { name: "Financials - February 2026.pdf", label: "February 2026 Statement" },
  { name: "Financials - March 2026.pdf", label: "March 2026 Statement" },
  { name: "Financials - April 2026.pdf", label: "April 2026 Statement" },
  { name: "Financials - May 2026.pdf", label: "May 2026 Statement" },
  { name: "Financials - June 2026.pdf", label: "June 2026 Statement" },
  { name: "Financials - July 2026.pdf", label: "July 2026 Statement" },
] as const;

export type FinancialDocumentName =
  (typeof FINANCIAL_DOCUMENTS)[number]["name"];

export const FINANCIAL_DOCUMENT_NAMES: readonly string[] =
  FINANCIAL_DOCUMENTS.map((d) => d.name);

// Meeting minutes, shown as "Recent Meeting Minutes" on /hoa-docs and
// queryable by the AI chat (ingested into hoa_document_chunks via
// scripts/ingest_from_unstructured.py, document_type "Minutes"). `date`
// drives the most-recent-first sort; uploaded via
// scripts/upload_minutes_pdfs.py.
export const MINUTES_DOCUMENTS = [
  { name: "Minutes - June 11, 2026.pdf", label: "June 11, 2026", date: "2026-06-11" },
  { name: "Minutes - May 14, 2026.pdf", label: "May 14, 2026", date: "2026-05-14" },
  { name: "Minutes - March 12, 2026.pdf", label: "March 12, 2026", date: "2026-03-12" },
] as const;

export type MinutesDocumentName = (typeof MINUTES_DOCUMENTS)[number]["name"];

export const MINUTES_DOCUMENT_NAMES: readonly string[] = MINUTES_DOCUMENTS.map(
  (d) => d.name
);

export async function fetchDocumentSignedUrl(
  documentName: string
): Promise<string> {
  const res = await fetch(`/api/documents/${encodeURIComponent(documentName)}`);
  if (!res.ok) {
    throw new Error(`Could not open ${documentName}`);
  }
  const body = (await res.json()) as { url: string };
  return body.url;
}

// Opens a source PDF in a new tab, jumped to the given page via the
// browser's native #page= anchor. The tab is opened synchronously (on
// the click gesture) so popup blockers don't catch it while the signed
// URL is fetched, then redirected once the URL is known -- works for
// both the chat's inline citations and the cheat sheet's header links,
// and (unlike an in-page side panel) behaves the same on mobile/tablet.
export function openDocumentInNewTab(documentName: string, page = 1) {
  const win = window.open("", "_blank");
  fetchDocumentSignedUrl(documentName)
    .then((url) => {
      const target = `${url}#page=${page}`;
      if (win) {
        win.location.href = target;
      } else {
        window.open(target, "_blank");
      }
    })
    .catch(() => {
      win?.close();
    });
}
