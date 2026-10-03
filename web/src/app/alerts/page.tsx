import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertsManager } from "@/components/AlertsManager";
import { criteriaToQuery, criteriaWhere } from "@/lib/alerts";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.alerts.title, robots: { index: false } };
}

export default async function AlertsPage() {
  const { t } = getI18n();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/alerts");

  const searches = await prisma.savedSearch.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  const counts = await Promise.all(searches.map((s) => prisma.offer.count({ where: criteriaWhere(s) })));
  const alerts = searches.map((s, i) => ({
    id: s.id,
    keywords: s.keywords,
    city: s.city,
    domain: s.domain,
    type: s.type,
    lastNotifiedAt: s.lastNotifiedAt?.toISOString() ?? null,
    matching: counts[i] ?? 0,
    query: criteriaToQuery(s),
  }));

  return (
    <div className="container-page py-6 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{t.alerts.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">{t.alerts.subtitle}</p>
      </div>
      <AlertsManager alerts={alerts} email={user.email} />
    </div>
  );
}
