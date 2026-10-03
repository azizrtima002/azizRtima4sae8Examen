import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { BellIcon, ColumnsIcon, LayersIcon } from "./icons";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { LogoutButton } from "./LogoutButton";
import { NavLink } from "./NavLink";

export async function Header() {
  const { t } = getI18n();
  const user = await getCurrentUser().catch(() => null);

  const links = [
    { href: "/offers", label: t.nav.offers, icon: <LayersIcon /> },
    { href: "/board", label: t.nav.board, icon: <ColumnsIcon /> },
    { href: "/alerts", label: t.nav.alerts, icon: <BellIcon /> },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="container-page flex h-14 items-center gap-4">
        <Logo />
        <nav aria-label={t.nav.mainNav} className="ms-4 hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink key={link.href} href={link.href}>
              {link.icon}
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher />
          {user ? (
            <>
              <span className="hidden max-w-[180px] truncate text-sm text-slate-500 lg:inline" title={user.email}>
                {user.email}
              </span>
              <LogoutButton label={t.nav.logout} />
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost px-3">
                {t.nav.login}
              </Link>
              <Link href="/register" className="btn-primary hidden px-3 sm:inline-flex">
                {t.nav.register}
              </Link>
            </>
          )}
        </div>
      </div>
      {/* Mobile navigation: always visible, thumb friendly */}
      <nav aria-label={t.nav.mainNav} className="border-t border-slate-100 md:hidden">
        <div className="container-page grid grid-cols-3">
          {links.map((link) => (
            <NavLink key={link.href} href={link.href} mobile>
              {link.icon}
              {link.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
}
