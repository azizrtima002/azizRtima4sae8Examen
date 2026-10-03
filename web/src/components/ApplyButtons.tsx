"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { format } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { APPLICATION_STATUSES, type ApplicationStatusKey } from "@/lib/taxonomy";
import { ColumnsIcon } from "./icons";

export function ApplyButtons({
  offerId,
  loggedIn,
  currentStatus,
}: {
  offerId: string;
  loggedIn: boolean;
  currentStatus: ApplicationStatusKey | null;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [pending, setPending] = useState<ApplicationStatusKey | null>(null);
  const [error, setError] = useState(false);

  if (!loggedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(`/offers/${offerId}`)}`} className="btn-primary w-full">
        {t.offer.loginToTrack}
      </Link>
    );
  }

  if (status) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
          {format(t.offer.inBoard, { status: APPLICATION_STATUSES[status][locale] })}
        </p>
        <Link href="/board" className="btn-secondary w-full">
          <ColumnsIcon />
          {t.offer.openBoard}
        </Link>
      </div>
    );
  }

  async function add(next: ApplicationStatusKey) {
    setPending(next);
    setError(false);
    const response = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId, status: next }),
    }).catch(() => null);
    setPending(null);
    if (!response?.ok) {
      if (response?.status === 401) router.push(`/login?next=${encodeURIComponent(`/offers/${offerId}`)}`);
      else setError(true);
      return;
    }
    const data = (await response.json()) as { application: { status: ApplicationStatusKey } };
    setStatus(data.application.status);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button type="button" className="btn-primary w-full" disabled={pending !== null} onClick={() => add("APPLIED")}>
        {t.offer.apply}
      </button>
      <p className="text-xs leading-relaxed text-slate-500">{t.offer.applyHint}</p>
      <button type="button" className="btn-secondary w-full" disabled={pending !== null} onClick={() => add("INTERESTED")}>
        {t.offer.save}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {t.board.error}
        </p>
      )}
    </div>
  );
}
