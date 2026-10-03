import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { buildOfferWhere, PAGE_SIZE, type OfferFilters } from "./search";

export const offerSummarySelect = {
  id: true,
  title: true,
  company: true,
  city: true,
  domain: true,
  type: true,
  sourceName: true,
  publishedAt: true,
  descriptionExcerpt: true,
} satisfies Prisma.OfferSelect;

export type OfferSummary = Prisma.OfferGetPayload<{ select: typeof offerSummarySelect }>;

export interface OfferPage {
  items: OfferSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listOffers(filters: OfferFilters, now: Date = new Date()): Promise<OfferPage> {
  const where = buildOfferWhere(filters, now);
  const [total, items] = await prisma.$transaction([
    prisma.offer.count({ where }),
    prisma.offer.findMany({
      where,
      select: offerSummarySelect,
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return { items, total, page: filters.page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export function getOffer(id: string) {
  if (!isUuid(id)) return Promise.resolve(null);
  return prisma.offer.findUnique({
    where: { id },
    select: { ...offerSummarySelect, sourceUrl: true, isActive: true },
  });
}

export function getSimilarOffers(offer: { id: string; domain: string | null; city: string | null }, take = 4) {
  if (!offer.domain) return Promise.resolve([]);
  return prisma.offer.findMany({
    where: { isActive: true, domain: offer.domain, id: { not: offer.id } },
    select: offerSummarySelect,
    // Same city first, then most recent.
    orderBy: [{ publishedAt: "desc" }],
    take: 20,
  }).then((items) =>
    items.sort((a, b) => Number(b.city === offer.city) - Number(a.city === offer.city)).slice(0, take),
  );
}

export async function getHomeStats(now: Date = new Date()) {
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
  const [active, last24h, latest] = await prisma.$transaction([
    prisma.offer.count({ where: { isActive: true } }),
    prisma.offer.count({ where: { isActive: true, createdAt: { gte: dayAgo } } }),
    prisma.offer.findMany({
      where: { isActive: true },
      select: offerSummarySelect,
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: 6,
    }),
  ]);
  return { active, last24h, latest };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);
