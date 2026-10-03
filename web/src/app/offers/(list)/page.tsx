import type { Metadata } from "next";
import { EmptyState } from "@/components/EmptyState";
import { OfferCard } from "@/components/OfferCard";
import { OfferFilters } from "@/components/OfferFilters";
import { Pagination } from "@/components/Pagination";
import { SaveAlertButton } from "@/components/SaveAlertButton";
import { getCurrentUser } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { format } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { listOffers } from "@/lib/offers";
import { hasActiveFilters, parseOfferFilters } from "@/lib/search";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const { t } = getI18n();
  return { title: t.offers.title, description: t.offers.subtitle };
}

export default async function OffersPage({ searchParams }: { searchParams: Record<string, string | string[]> }) {
  const { locale, t } = getI18n();
  const filters = parseOfferFilters(searchParams);
  const [page, user] = await Promise.all([listOffers(filters), getCurrentUser()]);
  const countLabel =
    page.total === 1 ? t.offers.resultsOne : format(t.offers.results, { count: formatNumber(page.total, locale) });

  return (
    <div className="container-page py-6 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{t.offers.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{t.offers.subtitle}</p>
      </div>

      <section className="card mb-6 p-4 sm:p-5">
        <OfferFilters filters={filters} />
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700" aria-live="polite">
          {countLabel}
        </p>
        {hasActiveFilters(filters) && <SaveAlertButton filters={filters} loggedIn={Boolean(user)} />}
      </div>

      {page.items.length === 0 ? (
        <EmptyState title={t.offers.noResults} hint={t.offers.noResultsHint} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {page.items.map((offer) => (
            <OfferCard key={offer.id} offer={offer} locale={locale} t={t} />
          ))}
        </div>
      )}

      <Pagination filters={filters} totalPages={page.totalPages} t={t} />
    </div>
  );
}
