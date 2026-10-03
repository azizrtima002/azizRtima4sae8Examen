import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { safeNext } from "@/lib/redirect";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.auth.registerTitle };
}

export default async function RegisterPage({ searchParams }: { searchParams: { next?: string } }) {
  if (await getCurrentUser()) redirect(safeNext(searchParams.next));
  return <AuthForm mode="register" next={searchParams.next} />;
}
