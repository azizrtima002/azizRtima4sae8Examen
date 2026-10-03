/** Only allow redirects to local paths (prevents open redirects via ?next=). */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/offers";
}
