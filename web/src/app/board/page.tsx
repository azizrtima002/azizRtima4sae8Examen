import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { KanbanBoard } from "@/components/KanbanBoard";
import { applicationInclude, toBoardCard } from "@/lib/applications";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { format } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.board.title, robots: { index: false } };
}

export default async function BoardPage() {
  const { t } = getI18n();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/board");

  const applications = await prisma.application.findMany({
    where: { userId: user.id },
    include: applicationInclude,
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="container-page py-6 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{t.board.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          {applications.length > 0 ? `${format(t.board.total, { count: applications.length })} · ` : ""}
          {t.board.subtitle}
        </p>
      </div>
      {applications.length === 0 ? (
        <EmptyState
          title={t.board.empty}
          hint={t.board.emptyHint}
          action={
            <Link href="/offers" className="btn-primary">
              {t.board.browse}
            </Link>
          }
        />
      ) : (
        <KanbanBoard initialCards={applications.map(toBoardCard)} />
      )}
    </div>
  );
}
