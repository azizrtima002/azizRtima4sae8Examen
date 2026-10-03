import Link from "next/link";
import { format, type Dictionary } from "@/lib/i18n";
import { filtersToQuery, type OfferFilters } from "@/lib/search";

export function Pagination({ filters, totalPages, t }: { filters: OfferFilters; totalPages: number; t: Dictionary }) {
  if (totalPages <= 1) return null;
  const { page } = filters;
  const href = (p: number) => `/offers${filtersToQuery(filters, { page: p })}`;
  const linkClass = "btn-secondary px-3";
  const disabledClass = "btn-secondary px-3 pointer-events-none opacity-40";

  return (
    <nav aria-label={t.offers.pagination} className="mt-8 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} className={linkClass} rel="prev">
          <span aria-hidden="true" className="inline-block rtl:rotate-180">←</span>
          {t.offers.previous}
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          <span aria-hidden="true" className="inline-block rtl:rotate-180">←</span>
          {t.offers.previous}
        </span>
      )}
      <span className="text-sm text-slate-500">{format(t.offers.pageOf, { page, total: totalPages })}</span>
      {page < totalPages ? (
        <Link href={href(page + 1)} className={linkClass} rel="next">
          {t.offers.next}
          <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span>
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          {t.offers.next}
          <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span>
        </span>
      )}
    </nav>
  );
}
