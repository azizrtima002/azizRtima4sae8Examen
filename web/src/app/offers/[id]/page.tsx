import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplyButtons } from "@/components/ApplyButtons";
import { Badge } from "@/components/Badge";
import { ExternalIcon } from "@/components/icons";
import { OfferCard } from "@/components/OfferCard";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, relativeTime } from "@/lib/format";
import { format } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { getOffer, getSimilarOffers } from "@/lib/offers";
import { cityLabel, domainLabel, sourceLabel, typeLabel } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const offer = await getOffer(params.id);
  if (!offer) return {};
  return {
    title: `${offer.title} — ${offer.company}`,
    description: offer.descriptionExcerpt?.slice(0, 160) ?? undefined,
  };
}

export default async function OfferPage({ params }: Props) {
  const { locale, t } = getI18n();
  const offer = await getOffer(params.id);
  if (!offer) notFound();

  const user = await getCurrentUser();
  const [application, similar] = await Promise.all([
    user
      ? prisma.application.findUnique({
          where: { userId_offerId: { userId: user.id, offerId: offer.id } },
          select: { status: true },
        })
      : null,
    getSimilarOffers(offer),
  ]);
  const source = sourceLabel(offer.sourceName);

  const facts: [string, string][] = [
    [t.offer.company, offer.company],
    [t.offer.location, cityLabel(offer.city, locale) ?? t.offer.notSpecified],
    [t.offer.type, typeLabel(offer.type, locale) ?? t.offer.notSpecified],
    [t.offer.domain, domainLabel(offer.domain, locale) ?? t.offer.notSpecified],
    [t.offer.publishedOn, `${formatDate(offer.publishedAt, locale)} (${relativeTime(offer.publishedAt, locale)})`],
    [t.offer.source, source],
  ];

  return (
    <div className="container-page py-6 sm:py-10">
      <Link href="/offers" className="text-sm font-medium text-brand-700 hover:underline">
        <span aria-hidden="true" className="inline-block rtl:rotate-180">←</span> {t.offer.back}
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <article className="card p-5 sm:p-8">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={offer.type}>{typeLabel(offer.type, locale)}</Badge>
            {offer.domain && <Badge>{domainLabel(offer.domain, locale)}</Badge>}
          </div>
          <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-3xl" dir="auto">
            {offer.title}
          </h1>
          <p className="mt-2 text-slate-600" dir="auto">
            {offer.company}
            {offer.city && <> · {cityLabel(offer.city, locale)}</>}
          </p>

          {!offer.isActive && (
            <p className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">{t.offer.inactive}</p>
          )}

          <div className="mt-6 border-t border-slate-100 pt-6">
            {offer.descriptionExcerpt ? (
              <blockquote
                cite={offer.sourceUrl}
                className="whitespace-pre-line border-s-4 border-slate-200 ps-4 leading-relaxed text-slate-700"
                dir="auto"
              >
                {offer.descriptionExcerpt}
              </blockquote>
            ) : (
              <p className="text-slate-500">{t.offer.noExcerpt}</p>
            )}
            <p className="mt-4 text-xs text-slate-500">{format(t.offer.excerptNotice, { source })}</p>
          </div>

          <a
            href={offer.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="btn-secondary mt-6 w-full sm:w-auto"
          >
            {t.offer.viewOriginal}
            <ExternalIcon />
          </a>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="card p-5">
            <ApplyButtons offerId={offer.id} loggedIn={Boolean(user)} currentStatus={application?.status ?? null} />
          </div>
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">{t.offer.details}</h2>
            <dl className="space-y-2.5 text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-end font-medium text-slate-800" dir="auto">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">{t.offer.similar}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {similar.map((item) => (
              <OfferCard key={item.id} offer={item} locale={locale} t={t} showExcerpt={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
