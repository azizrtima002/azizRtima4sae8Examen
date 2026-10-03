import { format, type Dictionary } from "@/lib/i18n";
import { relativeTime } from "@/lib/format";
import type { SyncStatus } from "@/lib/sync";
import type { Locale } from "@/lib/taxonomy";

const DOT = {
  fresh: "bg-emerald-500",
  late: "bg-amber-500",
  stale: "bg-red-500",
  never: "bg-slate-400",
} as const;

export function SyncBadge({ status, locale, t }: { status: SyncStatus | null; locale: Locale; t: Dictionary }) {
  const health = status?.health ?? "never";
  const label = status?.lastSuccessAt
    ? format(t.sync.label, { when: relativeTime(status.lastSuccessAt, locale) })
    : t.sync.never;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
      <span className="relative flex h-2 w-2">
        {health === "fresh" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${DOT[health]}`} />
      </span>
      {label}
    </span>
  );
}
