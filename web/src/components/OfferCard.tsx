import Link from "next/link";
import { relativeTime } from "@/lib/format";
import { format, type Dictionary } from "@/lib/i18n";
import type { OfferSummary } from "@/lib/offers";
import { cityLabel, domainLabel, sourceLabel, typeLabel, type Locale } from "@/lib/taxonomy";
import { Badge } from "./Badge";
import { BuildingIcon, ClockIcon, MapPinIcon } from "./icons";

export function OfferCard({
  offer,
  locale,
  t,
  showExcerpt = true,
}: {
  offer: OfferSummary;
  locale: Locale;
  t: Dictionary;
  showExcerpt?: boolean;
}) {
  return (
    <article className="card group relative flex flex-col gap-3 p-4 transition hover:border-brand-200 hover:shadow-md sm:p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={offer.type}>{typeLabel(offer.type, locale)}</Badge>
        {offer.domain && <Badge>{domainLabel(offer.domain, locale)}</Badge>}
      </div>
      <h3 className="text-[15px] font-semibold leading-snug text-slate-900" dir="auto">
        <Link href={`/offers/${offer.id}`} className="after:absolute after:inset-0 group-hover:text-brand-800">
          {offer.title}
        </Link>
      </h3>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        <span className="inline-flex items-center gap-1.5" dir="auto">
          <BuildingIcon className="shrink-0 text-slate-400" />
          {offer.company}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPinIcon className="shrink-0 text-slate-400" />
          {cityLabel(offer.city, locale) ?? t.offers.unknownCity}
        </span>
      </div>
      {showExcerpt && offer.descriptionExcerpt && (
        <p className="line-clamp-2 text-sm leading-relaxed text-slate-500" dir="auto">
          {offer.descriptionExcerpt}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <ClockIcon className="text-slate-400" />
          <time dateTime={new Date(offer.publishedAt).toISOString()}>
            {format(t.offers.published, { when: relativeTime(offer.publishedAt, locale) })}
          </time>
        </span>
        <span>{format(t.offers.via, { source: sourceLabel(offer.sourceName) })}</span>
      </div>
    </article>
  );
}
