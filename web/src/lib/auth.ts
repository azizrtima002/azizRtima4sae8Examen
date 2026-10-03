import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

export interface CurrentUser {
  id: string;
  email: string;
}

/** The signed-in user, or null. Checks that the account still exists. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.sub }, select: { id: true, email: true } });
});

const BCRYPT_ROUNDS = 10;
// Compared against when the email is unknown, so that response time does not
// reveal whether an account exists.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", BCRYPT_ROUNDS);

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return Boolean(hash) && ok;
}
