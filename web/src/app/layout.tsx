import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { directionOf } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = getI18n();
  return {
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
    title: { default: t.meta.title, template: "%s · StageFinder TN" },
    description: t.meta.description,
    openGraph: { title: t.meta.title, description: t.meta.description, type: "website", siteName: "StageFinder TN" },
  };
}

export const viewport: Viewport = { themeColor: "#1d40d8", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  const { locale } = getI18n();
  return (
    <html lang={locale} dir={directionOf(locale)}>
      <body className="flex min-h-screen flex-col">
        <I18nProvider locale={locale}>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </I18nProvider>
      </body>
    </html>
  );
}
