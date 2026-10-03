import { getI18n } from "@/lib/i18n/server";
import { getSyncStatusSafe } from "@/lib/sync";
import { SOURCES } from "@/lib/taxonomy";
import { Logo } from "./Logo";
import { SyncBadge } from "./SyncBadge";

const REPOSITORY_URL = "https://github.com/azizrtima002/azizRtima4sae8Examen";

export async function Footer() {
  const { locale, t } = getI18n();
  const status = await getSyncStatusSafe();
  const realSources = Object.entries(SOURCES).filter(([name]) => name !== "demo");

  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="container-page grid gap-8 py-10 md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-md text-sm leading-relaxed text-slate-500">{t.footer.about}</p>
          <SyncBadge status={status} locale={locale} t={t} />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">{t.footer.sources}</h2>
          <ul className="space-y-2 text-sm text-slate-500">
            {realSources.map(([name, source]) => (
              <li key={name}>
                <a href={source.homepage} target="_blank" rel="noopener noreferrer" className="hover:text-slate-900">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">{t.footer.project}</h2>
          <ul className="space-y-2 text-sm text-slate-500">
            <li>
              <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className="hover:text-slate-900">
                {t.footer.github}
              </a>
            </li>
            <li>{t.footer.madeFor}</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
