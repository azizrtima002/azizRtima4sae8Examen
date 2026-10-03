"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children, mobile = false }: { href: string; children: ReactNode; mobile?: boolean }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const base = mobile
    ? "flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-medium border-b-2"
    : "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium";
  const state = mobile
    ? active
      ? "border-brand-700 text-brand-700"
      : "border-transparent text-slate-600"
    : active
      ? "bg-brand-50 text-brand-800"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900";
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`${base} ${state}`}>
      {children}
    </Link>
  );
}
