/**
 * JWT session helpers. Edge-runtime safe (used by the middleware), so this
 * file must not import Prisma or Node-only modules.
 */
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "sf_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const ISSUER = "stagefinder-tn";

export interface SessionPayload {
  sub: string; // user id
  email: string;
}

let warned = false;

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
      throw new Error("JWT_SECRET must be set to a random string of at least 32 characters");
    }
    if (!warned) {
      console.warn("[auth] JWT_SECRET missing or too short — using an insecure development secret");
      warned = true;
    }
    return new TextEncoder().encode("insecure-development-secret-do-not-use-in-production");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
