"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { relativeTime } from "@/lib/format";
import { format } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { CITIES, cityLabel, DOMAINS, domainLabel, OFFER_TYPES, typeLabel } from "@/lib/taxonomy";
import { BellIcon } from "./icons";

export interface AlertItem {
  id: string;
  keywords: string;
  city: string | null;
  domain: string | null;
  type: string | null;
  lastNotifiedAt: string | null;
  matching: number;
  query: string;
}

export function AlertsManager({ alerts, email }: { alerts: AlertItem[]; email: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState({ keywords: "", city: "", domain: "", type: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!form.keywords.trim() && !form.city && !form.domain && !form.type) {
      setError(t.alerts.atLeastOne);
      return;
    }
    setSaving(true);
    setError(null);
    const response = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, keywords: form.keywords.trim() }),
    }).catch(() => null);
    setSaving(false);
    if (!response?.ok) {
      setError(response?.status === 409 ? t.alerts.limitReached : t.alerts.error);
      return;
    }
    setForm({ keywords: "", city: "", domain: "", type: "" });
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm(t.alerts.deleteConfirm)) return;
    setDeleting(id);
    await fetch(`/api/alerts/${id}`, { method: "DELETE" }).catch(() => null);
    setDeleting(null);
    router.refresh();
  }

  const options = (table: Record<string, { fr: string; ar: string }>) =>
    Object.entries(table)
      .map(([value, label]) => ({ value, label: label[locale] }))
      .sort((a, b) => a.label.localeCompare(b.label, locale));

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form onSubmit={create} className="card space-y-4 self-start p-5" noValidate>
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <BellIcon /> {t.alerts.newAlert}
        </h2>
        <div>
          <label htmlFor="alert-keywords" className="label">
            {t.alerts.keywords}
          </label>
          <input
            id="alert-keywords"
            className="input"
            maxLength={100}
            value={form.keywords}
            placeholder={t.alerts.keywordsPlaceholder}
            onChange={(e) => setForm({ ...form, keywords: e.target.value })}
          />
        </div>
        {(
          [
            ["city", t.offers.city, t.offers.allCities, options(CITIES)],
            ["domain", t.offers.domain, t.offers.allDomains, options(DOMAINS)],
            ["type", t.offers.type, t.offers.allTypes, Object.entries(OFFER_TYPES).map(([value, l]) => ({ value, label: l[locale] }))],
          ] as const
        ).map(([key, label, all, list]) => (
          <div key={key}>
            <label htmlFor={`alert-${key}`} className="label">
              {label}
            </label>
            <select
              id={`alert-${key}`}
              className="input"
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            >
              <option value="">{all}</option>
              {list.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={saving}>
          {t.alerts.create}
        </button>
        <p className="text-xs text-slate-500">{format(t.alerts.sentTo, { email })}</p>
      </form>

      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="card px-6 py-12 text-center">
            <p className="font-medium text-slate-900">{t.alerts.empty}</p>
            <p className="mt-1 text-sm text-slate-500">{t.alerts.emptyHint}</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const criteria = [
              alert.keywords ? `« ${alert.keywords} »` : null,
              cityLabel(alert.city, locale),
              domainLabel(alert.domain, locale),
              typeLabel(alert.type, locale),
            ].filter(Boolean);
            return (
              <article key={alert.id} className="card flex flex-wrap items-center gap-4 p-4 sm:p-5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900" dir="auto">
                    {criteria.join(" · ")}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {format(t.alerts.matching, { count: alert.matching })} ·{" "}
                    {alert.lastNotifiedAt
                      ? format(t.alerts.lastNotified, { when: relativeTime(alert.lastNotifiedAt, locale) })
                      : t.alerts.neverNotified}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/offers${alert.query}`} className="btn-secondary px-3">
                    {t.alerts.seeResults}
                  </Link>
                  <button
                    type="button"
                    className="btn-ghost px-3 text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={() => remove(alert.id)}
                    disabled={deleting === alert.id}
                  >
                    {t.alerts.delete}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
