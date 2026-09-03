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
