export function normalizeAddress(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[.,#]/g, "")
    .replace(/\s+/g, " ");
}
