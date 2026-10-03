"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n/client";
import { filtersToQuery, hasActiveFilters } from "@/lib/query";
import type { OfferFilters as Filters } from "@/lib/search";
import { CITIES, DOMAINS, FRESHNESS, OFFER_TYPES } from "@/lib/taxonomy";
import { FilterIcon, SearchIcon } from "./icons";

type SelectKey = "city" | "domain" | "type" | "freshness";

export function OfferFilters({ filters }: { filters: Filters }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");
  const [open, setOpen] = useState(false);

  // Keep the input in sync when navigating (back button, reset link).
  useEffect(() => setQ(filters.q ?? ""), [filters.q]);

  function navigate(next: Partial<Filters>) {
    // Any filter change goes back to page 1.
    const query = filtersToQuery({ ...filters, ...next, page: 1 });
    startTransition(() => router.push(`${pathname}${query}`, { scroll: false }));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    navigate({ q: q.trim() || undefined });
  }

  const selects: { key: SelectKey; label: string; all: string; options: [string, string][] }[] = [
    { key: "city", label: t.offers.city, all: t.offers.allCities, options: entries(CITIES, locale, true) },
    { key: "domain", label: t.offers.domain, all: t.offers.allDomains, options: entries(DOMAINS, locale, true) },
    { key: "type", label: t.offers.type, all: t.offers.allTypes, options: entries(OFFER_TYPES, locale) },
    { key: "freshness", label: t.offers.freshness, all: t.offers.anyTime, options: entries(FRESHNESS, locale) },
  ];
  const activeCount = selects.filter((s) => filters[s.key]).length;

  return (
    <div className="space-y-3" aria-busy={pending}>
      <form onSubmit={onSubmit} role="search" className="flex gap-2">
        <label htmlFor="offer-search" className="sr-only">
          {t.offers.searchLabel}
        </label>
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="offer-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.offers.searchPlaceholder}
            className="input ps-9"
            maxLength={100}
            enterKeyHint="search"
          />
        </div>
        <button type="submit" className="btn-primary" disabled={pending}>
          <span className="hidden sm:inline">{t.home.searchButton}</span>
          <SearchIcon className="sm:hidden" />
        </button>
        <button
          type="button"
          className="btn-secondary px-3 lg:hidden"
          aria-expanded={open}
          aria-controls="offer-filters"
          onClick={() => setOpen((v) => !v)}
        >
          <FilterIcon />
          <span className="sr-only sm:not-sr-only">{t.offers.filters}</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-brand-700 px-1.5 text-[11px] font-semibold text-white">{activeCount}</span>
          )}
        </button>
      </form>

      <div id="offer-filters" className={`${open ? "grid" : "hidden"} gap-3 sm:grid-cols-2 lg:grid lg:grid-cols-4`}>
        {selects.map((select) => (
          <div key={select.key}>
            <label htmlFor={`filter-${select.key}`} className="label">
              {select.label}
            </label>
            <select
              id={`filter-${select.key}`}
              className="input"
              value={filters[select.key] ?? ""}
              onChange={(e) => navigate({ [select.key]: e.target.value || undefined })}
            >
              <option value="">{select.all}</option>
              {select.options.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {hasActiveFilters(filters) && (
        <button
          type="button"
          className="text-sm font-medium text-brand-700 hover:underline"
          onClick={() => {
            setQ("");
            startTransition(() => router.push(pathname, { scroll: false }));
          }}
        >
          {t.offers.reset}
        </button>
      )}
    </div>
  );
}

function entries(table: Record<string, { fr: string; ar: string }>, locale: "fr" | "ar", sort = false) {
  const list = Object.entries(table).map(([key, label]) => [key, label[locale]] as [string, string]);
  return sort ? list.sort((a, b) => a[1].localeCompare(b[1], locale)) : list;
}
