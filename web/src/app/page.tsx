import Link from "next/link";
import { OfferCard } from "@/components/OfferCard";
import { ColumnsIcon, LayersIcon, SearchIcon } from "@/components/icons";
import { formatNumber, relativeTime } from "@/lib/format";
import { format } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { getHomeStats } from "@/lib/offers";
import { getSyncStatusSafe } from "@/lib/sync";
import { CITIES, OFFER_TYPES, sourceLabel } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

const POPULAR_CITIES = ["tunis", "ariana", "sfax", "sousse", "ben-arous", "monastir", "nabeul", "bizerte"] as const;

export default async function HomePage() {
  const { locale, t } = getI18n();
  const [stats, sync] = await Promise.all([getHomeStats(), getSyncStatusSafe()]);
  const sources = (sync?.sources ?? []).filter((s) => s.source !== "demo" || sync?.sources.length === 1);

  const kpis = [
    { value: formatNumber(stats.active, locale), label: t.home.statsActive },
    { value: formatNumber(stats.last24h, locale), label: t.home.statsToday },
    { value: formatNumber(sources.length, locale), label: t.home.statsSources },
    {
      value: sync?.lastSuccessAt ? relativeTime(sync.lastSuccessAt, locale) : t.home.neverSynced,
      label: t.home.statsSync,
    },
  ];

  return (
    <>
      <section className="border-b border-slate-200 bg-white">
        <div className="container-page py-12 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">{t.home.eyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            {t.home.heroTitle}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">{t.home.heroSubtitle}</p>

          <form action="/offers" method="get" role="search" className="mt-8 flex max-w-2xl gap-2">
            <label htmlFor="hero-search" className="sr-only">
              {t.offers.searchLabel}
            </label>
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute start-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                id="hero-search"
                name="q"
                type="search"
                placeholder={t.home.searchPlaceholder}
                className="input h-12 ps-11 text-base"
                maxLength={100}
                enterKeyHint="search"
              />
            </div>
            <button type="submit" className="btn-primary h-12 px-5 text-base">
              {t.home.searchButton}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-2">
            {Object.entries(OFFER_TYPES)
              .filter(([key]) => key !== "OTHER")
              .map(([key, label]) => (
                <Link
                  key={key}
                  href={`/offers?type=${key}`}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:border-brand-300 hover:text-brand-800"
                >
                  {label[locale]}
                </Link>
              ))}
          </div>

          <dl className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <dt className="text-xs text-slate-500">{kpi.label}</dt>
                <dd className="mt-1 text-xl font-semibold text-slate-900">{kpi.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="container-page py-12">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-900">{t.home.latest}</h2>
          <Link href="/offers" className="text-sm font-medium text-brand-700 hover:underline">
            {t.home.seeAll} <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span>
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stats.latest.map((offer) => (
            <OfferCard key={offer.id} offer={offer} locale={locale} t={t} showExcerpt={false} />
          ))}
        </div>
      </section>

      <section className="container-page pb-4">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">{t.home.browseByCity}</h2>
        <div className="flex flex-wrap gap-2">
          {POPULAR_CITIES.map((slug) => (
            <Link
              key={slug}
              href={`/offers?city=${slug}`}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-300 hover:text-brand-800"
            >
              {CITIES[slug][locale]}
            </Link>
          ))}
        </div>
      </section>

      <section className="container-page py-12">
        <h2 className="mb-6 text-xl font-semibold text-slate-900">{t.home.howTitle}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: <LayersIcon width={20} height={20} />, title: t.home.how1Title, text: t.home.how1Text },
            { icon: <SearchIcon width={20} height={20} />, title: t.home.how2Title, text: t.home.how2Text },
            { icon: <ColumnsIcon width={20} height={20} />, title: t.home.how3Title, text: t.home.how3Text },
          ].map((step, i) => (
            <div key={step.title} className="card p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700">{step.icon}</span>
                <h3 className="font-semibold text-slate-900">
                  {i + 1}. {step.title}
                </h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {sources.length > 0 && (
        <section className="container-page pb-4">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">{t.home.sourcesTitle}</h2>
          <ul className="card divide-y divide-slate-100">
            {sources.map((source) => (
              <li key={source.source} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-800">
                  <span className={`h-2 w-2 rounded-full ${source.ok ? "bg-emerald-500" : "bg-red-500"}`} />
                  {sourceLabel(source.source)}
                </span>
                <span className="text-slate-500">
                  {source.ok ? t.sync.ok : t.sync.failed} · {relativeTime(source.lastRunAt, locale)}
                  {source.ok && <> · {format(t.sync.found, { count: source.offersFound })}</>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
