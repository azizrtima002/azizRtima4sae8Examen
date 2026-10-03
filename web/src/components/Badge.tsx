import type { ReactNode } from "react";

const TONES = {
  neutral: "bg-slate-100 text-slate-700",
  brand: "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100",
  PFE: "bg-indigo-50 text-indigo-800 ring-1 ring-inset ring-indigo-100",
  SUMMER: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-100",
  WORKER: "bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-100",
  OTHER: "bg-slate-100 text-slate-700",
} as const;

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}
