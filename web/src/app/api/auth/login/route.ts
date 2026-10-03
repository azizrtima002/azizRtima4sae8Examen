import { NextResponse, type NextRequest } from "next/server";
import { ApiError, clientIp, handler, readJson } from "@/lib/api";
import { verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sessionCookieOptions, SESSION_COOKIE, signSession } from "@/lib/session";
import { credentialsSchema } from "../schema";

export const POST = handler(async (req: NextRequest) => {
  const { email, password } = await readJson(req, credentialsSchema);
  // 10 attempts per 15 minutes per IP + email.
  if (!rateLimit(`login:${clientIp(req)}:${email}`, 10, 15 * 60 * 1000)) {
    throw new ApiError("too_many_requests", "Trop de tentatives");
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!(await verifyPassword(password, user?.passwordHash)) || !user) {
    throw new ApiError("unauthorized", "Email ou mot de passe incorrect");
  }
  const response = NextResponse.json({ user: { id: user.id, email: user.email } });
  response.cookies.set(SESSION_COOKIE, await signSession({ sub: user.id, email: user.email }), sessionCookieOptions);
  return response;
});
