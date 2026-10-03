"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n/client";
import { safeNext } from "@/lib/redirect";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isLogin = mode === "login";
  const destination = safeNext(next);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);

    if (response?.ok) {
      router.replace(destination);
      router.refresh();
      return;
    }
    setPending(false);
    const status = response?.status;
    setError(
      status === 401
        ? t.auth.invalidCredentials
        : status === 409
          ? t.auth.emailTaken
          : status === 429
            ? t.auth.tooMany
            : status === 400
              ? t.auth.invalidData
              : t.auth.genericError,
    );
  }

  const otherHref = `/${isLogin ? "register" : "login"}${next ? `?next=${encodeURIComponent(destination)}` : ""}`;

  return (
    <div className="container-page flex justify-center py-10 sm:py-16">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {isLogin ? t.auth.loginTitle : t.auth.registerTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{isLogin ? t.auth.loginSubtitle : t.auth.registerSubtitle}</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="label">
              {t.auth.email}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              dir="ltr"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="label">
              {t.auth.password}
            </label>
            <input
              id="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              minLength={8}
              maxLength={128}
              dir="ltr"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={isLogin ? undefined : "password-hint"}
            />
            {!isLogin && (
              <p id="password-hint" className="mt-1.5 text-xs text-slate-500">
                {t.auth.passwordHint}
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary w-full" disabled={pending}>
            {isLogin ? t.auth.submitLogin : t.auth.submitRegister}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          {isLogin ? t.auth.noAccount : t.auth.haveAccount}{" "}
          <Link href={otherHref} className="font-medium text-brand-700 hover:underline">
            {isLogin ? t.nav.register : t.nav.login}
          </Link>
        </p>
      </div>
    </div>
  );
}
