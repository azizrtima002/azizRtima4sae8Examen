import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export default function NotFound() {
  const { t } = getI18n();
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <p className="text-sm font-semibold text-brand-700">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">{t.errors.notFoundTitle}</h1>
      <p className="mt-2 text-slate-500">{t.errors.notFoundText}</p>
      <Link href="/" className="btn-primary mt-6">
        {t.errors.backHome}
      </Link>
    </div>
  );
}
