import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-slate-900" dir="ltr">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-700 text-white">
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4-4" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-[17px]">
        StageFinder<span className="ms-1 rounded bg-red-600 px-1 py-0.5 text-[11px] font-bold text-white">TN</span>
      </span>
    </Link>
  );
}
