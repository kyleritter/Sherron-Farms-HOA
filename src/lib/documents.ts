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
] as const;

export type HoaDocumentName = (typeof HOA_DOCUMENTS)[number]["name"];

export const HOA_DOCUMENT_NAMES: readonly string[] = HOA_DOCUMENTS.map(
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
