/**
 * Query-string helpers for offer filters. Kept free of zod/Prisma so that
 * client components can import them without bloating the bundle.
 */
export interface QueryFilters {
  q?: string;
  city?: string;
  domain?: string;
  type?: string;
  freshness?: string;
  page?: number;
}

/** Serialize filters back to a query string (empty values omitted). */
export function filtersToQuery(filters: QueryFilters, overrides: QueryFilters = {}): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  for (const key of ["q", "city", "domain", "type", "freshness"] as const) {
    const value = merged[key];
    if (value) params.set(key, value);
  }
  if (merged.page && merged.page > 1) params.set("page", String(merged.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function hasActiveFilters(filters: QueryFilters): boolean {
  return Boolean(filters.q || filters.city || filters.domain || filters.type || filters.freshness);
}
