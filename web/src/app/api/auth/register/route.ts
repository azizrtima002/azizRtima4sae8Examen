import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { ApiError, clientIp, handler, readJson } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sessionCookieOptions, SESSION_COOKIE, signSession } from "@/lib/session";
import { credentialsSchema } from "../schema";

export const POST = handler(async (req: NextRequest) => {
  if (!rateLimit(`register:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
    throw new ApiError("too_many_requests", "Trop de tentatives");
  }
  const { email, password } = await readJson(req, credentialsSchema);
  let user;
  try {
    user = await prisma.user.create({
      data: { email, passwordHash: await hashPassword(password) },
      select: { id: true, email: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError("conflict", "Un compte existe déjà avec cet email");
    }
    throw error;
  }
  const response = NextResponse.json({ user }, { status: 201 });
  response.cookies.set(SESSION_COOKIE, await signSession({ sub: user.id, email: user.email }), sessionCookieOptions);
  return response;
});
