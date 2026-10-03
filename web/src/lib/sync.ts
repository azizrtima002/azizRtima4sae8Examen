import { prisma } from "./db";

export type SyncHealth = "fresh" | "late" | "stale" | "never";

export interface SourceStatus {
  source: string;
  lastRunAt: Date;
  ok: boolean;
  offersFound: number;
  error: string | null;
  lastSuccessAt: Date | null;
}

export interface SyncStatus {
  lastSuccessAt: Date | null;
  health: SyncHealth;
  sources: SourceStatus[];
}

const HOUR = 3600 * 1000;

/** Scrapers run every 12 hours: fresh < 13 h, late < 36 h, stale beyond. */
export function healthOf(lastSuccessAt: Date | null, now: Date = new Date()): SyncHealth {
  if (!lastSuccessAt) return "never";
  const age = now.getTime() - lastSuccessAt.getTime();
  if (age < 13 * HOUR) return "fresh";
  if (age < 36 * HOUR) return "late";
  return "stale";
}

export async function getSyncStatus(now: Date = new Date()): Promise<SyncStatus> {
  const [latestRuns, latestSuccesses] = await prisma.$transaction([
    prisma.scraperRun.findMany({
      distinct: ["source"],
      orderBy: [{ source: "asc" }, { startedAt: "desc" }],
    }),
    prisma.scraperRun.findMany({
      where: { status: "SUCCESS" },
      distinct: ["source"],
      orderBy: [{ source: "asc" }, { startedAt: "desc" }],
      select: { source: true, finishedAt: true, startedAt: true },
    }),
  ]);
  const successBySource = new Map(latestSuccesses.map((r) => [r.source, r.finishedAt ?? r.startedAt]));
  const sources = latestRuns.map((run) => ({
    source: run.source,
    lastRunAt: run.finishedAt ?? run.startedAt,
    ok: run.status === "SUCCESS",
    offersFound: run.offersFound,
    error: run.errorMessage,
    lastSuccessAt: successBySource.get(run.source) ?? null,
  }));
  const lastSuccessAt =
    [...successBySource.values()].sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  return { lastSuccessAt, health: healthOf(lastSuccessAt, now), sources };
}

/** Never let the status badge take a page down with it. */
export async function getSyncStatusSafe(): Promise<SyncStatus | null> {
  try {
    return await getSyncStatus();
  } catch (error) {
    console.error("[sync] status unavailable", error);
    return null;
  }
}
