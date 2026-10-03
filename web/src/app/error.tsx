"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => console.error(error), [error]);
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">{t.errors.errorTitle}</h1>
      <p className="mt-2 text-slate-500">{t.errors.errorText}</p>
      <button type="button" onClick={reset} className="btn-primary mt-6">
        {t.errors.retry}
      </button>
    </div>
  );
}
