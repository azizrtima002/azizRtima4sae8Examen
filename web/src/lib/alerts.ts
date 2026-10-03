import type { OfferType, PrismaClient, SavedSearch } from "@prisma/client";
import { offerSummarySelect, type OfferSummary } from "./offers";
import { buildOfferWhere } from "./search";
import { cityLabel, domainLabel, sourceLabel, typeLabel } from "./taxonomy";

export const MAX_ALERTS_PER_USER = 10;
const MAX_OFFERS_PER_ALERT = 10;

export interface AlertCriteria {
  keywords: string;
  city: string | null;
  domain: string | null;
  type: OfferType | string | null;
}

export interface AlertMatch {
  search: SavedSearch;
  offers: OfferSummary[];
  total: number;
}

export interface UserDigest {
  userId: string;
  email: string;
  searchIds: string[]; // every search of the user, matched or not
  matches: AlertMatch[]; // only searches with new offers
}

export const criteriaWhere = (c: AlertCriteria) =>
  buildOfferWhere({ q: c.keywords, city: c.city, domain: c.domain, type: c.type });

/** Human summary of a saved search: "react · Tunis · PFE". */
export function describeCriteria(c: AlertCriteria): string {
  return (
    [c.keywords.trim(), cityLabel(c.city, "fr"), domainLabel(c.domain, "fr"), typeLabel(c.type, "fr")]
      .filter(Boolean)
      .join(" · ") || "Toutes les offres"
  );
}

export function criteriaToQuery(c: AlertCriteria): string {
  const params = new URLSearchParams();
  if (c.keywords) params.set("q", c.keywords);
  if (c.city) params.set("city", c.city);
  if (c.domain) params.set("domain", c.domain);
  if (c.type) params.set("type", c.type);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * For every saved search, find offers first seen in (lastNotifiedAt, runStart].
 * The window upper bound makes runs idempotent: offers inserted while the job
 * runs are picked up by the next run instead of being skipped.
 */
export async function collectDigests(prisma: PrismaClient, runStart: Date): Promise<UserDigest[]> {
  const searches = await prisma.savedSearch.findMany({
    include: { user: { select: { id: true, email: true } } },
    orderBy: [{ userId: "asc" }, { createdAt: "asc" }],
  });

  const digests = new Map<string, UserDigest>();
  for (const search of searches) {
    const digest = digests.get(search.userId) ?? {
      userId: search.userId,
      email: search.user.email,
      searchIds: [],
      matches: [],
    };
    digests.set(search.userId, digest);
    digest.searchIds.push(search.id);

    const since = search.lastNotifiedAt ?? search.createdAt;
    const where = { AND: [criteriaWhere(search), { createdAt: { gt: since, lte: runStart } }] };
    const [total, offers] = await Promise.all([
      prisma.offer.count({ where }),
      prisma.offer.findMany({
        where,
        select: offerSummarySelect,
        orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
        take: MAX_OFFERS_PER_ALERT,
      }),
    ]);
    if (total > 0) {
      digest.matches.push({ search, offers, total });
    }
  }
  return [...digests.values()];
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderDigestEmail(digest: UserDigest, appUrl: string) {
  const base = appUrl.replace(/\/$/, "");
  const count = digest.matches.reduce((sum, m) => sum + m.total, 0);
  const subject =
    count === 1 ? "1 nouvelle offre de stage pour vos alertes" : `${count} nouvelles offres de stage pour vos alertes`;

  const sections = digest.matches.map((match) => {
    const title = escapeHtml(describeCriteria(match.search));
    const more =
      match.total > match.offers.length
        ? `<p style="margin:8px 0 0"><a href="${base}/offers${escapeHtml(criteriaToQuery(match.search))}" style="color:#1d4ed8">Voir les ${match.total} offres</a></p>`
        : "";
    const items = match.offers
      .map((offer) => {
        const meta = [offer.company, cityLabel(offer.city, "fr"), typeLabel(offer.type, "fr"), sourceLabel(offer.sourceName)]
          .filter(Boolean)
          .map((part) => escapeHtml(String(part)))
          .join(" · ");
        return `<li style="margin:0 0 12px"><a href="${base}/offers/${offer.id}" style="color:#0f172a;font-weight:600;text-decoration:none">${escapeHtml(offer.title)}</a><br><span style="color:#475569;font-size:13px">${meta}</span></li>`;
      })
      .join("");
    return `<h2 style="font-size:15px;margin:24px 0 8px;color:#1e293b">${title}</h2><ul style="padding-left:18px;margin:0">${items}</ul>${more}`;
  });

  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px;background:#ffffff">
<p style="font-weight:700;font-size:18px;margin:0 0 4px;color:#0f172a">StageFinder TN</p>
<p style="color:#475569;margin:0 0 8px">${escapeHtml(subject)}.</p>
${sections.join("")}
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
<p style="font-size:12px;color:#64748b">Vous recevez cet email car vous avez créé des alertes sur StageFinder TN. <a href="${base}/alerts" style="color:#1d4ed8">Gérer ou supprimer mes alertes</a>.</p>
</div></body></html>`;

  const text = [
    `StageFinder TN — ${subject}`,
    ...digest.matches.flatMap((match) => [
      "",
      `## ${describeCriteria(match.search)}`,
      ...match.offers.map((o) => `- ${o.title} — ${o.company}\n  ${base}/offers/${o.id}`),
      ...(match.total > match.offers.length ? [`  … ${base}/offers${criteriaToQuery(match.search)}`] : []),
    ]),
    "",
    `Gérer mes alertes : ${base}/alerts`,
  ].join("\n");

  return { subject, html, text };
}
