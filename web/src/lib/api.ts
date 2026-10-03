import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { getCurrentUser, type CurrentUser } from "./auth";

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "too_many_requests"
  | "unsupported_media_type"
  | "internal";

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  too_many_requests: 429,
  unsupported_media_type: 415,
  internal: 500,
};

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: STATUS[error.code] },
    );
  }
  console.error("[api] unexpected error", error);
  return NextResponse.json({ error: { code: "internal", message: "Erreur interne" } }, { status: 500 });
}

/** Wrap a route handler so thrown `ApiError`s become JSON responses. */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError("unauthorized", "Connexion requise");
  return user;
}

/**
 * Parse and validate a JSON body. Requiring `application/json` (which a
 * cross-site HTML form cannot send) plus a same-origin check protects the
 * cookie-authenticated endpoints against CSRF.
 */
export async function readJson<T extends z.ZodTypeAny>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (!host || new URL(origin).host !== host) throw new ApiError("forbidden", "Origine non autorisée");
  }
  if (!req.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError("unsupported_media_type", "Content-Type application/json attendu");
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError("bad_request", "JSON invalide");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError("bad_request", "Données invalides", parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.ip || "unknown";
}
