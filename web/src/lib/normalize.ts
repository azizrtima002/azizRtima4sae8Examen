/**
 * Text normalization for search. Must produce exactly the same output as
 * `normalize_text` in scrapers/stagefinder/normalize.py, which fills the
 * `offers.search_text` column (see shared/normalize-cases.json).
 */
export function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Split a user query into normalized search terms (max 8). */
export function searchTerms(query: string | null | undefined): string[] {
  return normalizeText(query)
    .split(" ")
    .filter((term) => term.length > 1 || /\d/.test(term))
    .slice(0, 8);
}
