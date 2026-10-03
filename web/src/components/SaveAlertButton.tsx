"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import type { OfferFilters } from "@/lib/search";
import { BellIcon } from "./icons";

export function SaveAlertButton({ filters, loggedIn }: { filters: OfferFilters; loggedIn: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error" | "limit">("idle");

  async function save() {
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname + window.location.search)}`);
      return;
    }
    setState("saving");
    const response = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords: filters.q ?? "",
        city: filters.city ?? null,
        domain: filters.domain ?? null,
        type: filters.type ?? null,
      }),
    }).catch(() => null);
    if (response?.ok) setState("saved");
    else setState(response?.status === 409 ? "limit" : "error");
  }

  if (state === "saved") {
    return (
      <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        {t.offers.alertCreated}{" "}
        <Link href="/alerts" className="font-medium underline">
          {t.offers.manageAlerts}
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="btn-secondary" onClick={save} disabled={state === "saving"} title={t.offers.saveAlertHint}>
        <BellIcon />
        {t.offers.saveAlert}
      </button>
      {state === "error" && <span role="alert" className="text-sm text-red-700">{t.alerts.error}</span>}
      {state === "limit" && <span role="alert" className="text-sm text-red-700">{t.alerts.limitReached}</span>}
    </div>
  );
}
