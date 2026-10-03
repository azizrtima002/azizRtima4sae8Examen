import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { searchTerms } from "./normalize";
import { CITY_SLUGS, DOMAIN_SLUGS, FRESHNESS, FRESHNESS_KEYS, OFFER_TYPE_KEYS } from "./taxonomy";

export const PAGE_SIZE = 20;

/** Invalid values are dropped rather than rejected: a stale or hand-edited
 * URL should still show results instead of an error page. */
const lenient = <T extends z.ZodTypeAny>(schema: T) => schema.optional().catch(undefined);

export const offerFiltersSchema = z.object({
  q: lenient(z.string().trim().max(100).transform((v) => v || undefined)),
  city: lenient(z.enum(CITY_SLUGS)),
  domain: lenient(z.enum(DOMAIN_SLUGS)),
  type: lenient(z.enum(OFFER_TYPE_KEYS)),
  freshness: lenient(z.enum(FRESHNESS_KEYS)),
  page: z.coerce.number().int().min(1).max(500).catch(1).default(1),
});

export type OfferFilters = z.infer<typeof offerFiltersSchema>;

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

export function parseOfferFilters(params: RawParams): OfferFilters {
  const get = (key: string) => {
    const value = params instanceof URLSearchParams ? params.get(key) : params[key];
    return (Array.isArray(value) ? value[0] : value) || undefined;
  };
  return offerFiltersSchema.parse({
    q: get("q"),
    city: get("city"),
    domain: get("domain"),
    type: get("type"),
    freshness: get("freshness"),
    page: get("page"),
  });
}

/** Criteria shared by the offers list and the email alerts. */
export interface OfferCriteria {
  q?: string | null;
  city?: string | null;
  domain?: string | null;
  type?: string | null;
  freshness?: string | null;
}

export function buildOfferWhere(criteria: OfferCriteria, now: Date = new Date()): Prisma.OfferWhereInput {
  const and: Prisma.OfferWhereInput[] = [{ isActive: true }];
  // Every term must appear (AND), in any order, accents and case ignored.
  for (const term of searchTerms(criteria.q)) and.push({ searchText: { contains: term } });
  if (criteria.city) and.push({ city: criteria.city });
  if (criteria.domain) and.push({ domain: criteria.domain });
  if (criteria.type) and.push({ type: criteria.type as Prisma.EnumOfferTypeFilter["equals"] });
  if (criteria.freshness && criteria.freshness in FRESHNESS) {
    const { ms } = FRESHNESS[criteria.freshness as keyof typeof FRESHNESS];
    and.push({ publishedAt: { gte: new Date(now.getTime() - ms) } });
  }
  return { AND: and };
}

export { filtersToQuery, hasActiveFilters } from "./query";
