import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/redirect";
import { rateLimit } from "@/lib/rate-limit";
import { signSession, verifySession } from "@/lib/session";

process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123";

describe("session JWT", () => {
  it("round-trips a session", async () => {
    const token = await signSession({ sub: "user-1", email: "a@b.tn" });
    expect(await verifySession(token)).toEqual({ sub: "user-1", email: "a@b.tn" });
  });

  it("rejects tampered, foreign and empty tokens", async () => {
    const token = await signSession({ sub: "user-1", email: "a@b.tn" });
    expect(await verifySession(`${token.slice(0, -2)}xx`)).toBeNull();
    const foreign = await new SignJWT({ email: "a@b.tn" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuer("stagefinder-tn")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("another-secret-another-secret-another"));
    expect(await verifySession(foreign)).toBeNull();
    expect(await verifySession("")).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const expired = await new SignJWT({ email: "a@b.tn" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuer("stagefinder-tn")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    expect(await verifySession(expired)).toBeNull();
  });
});

describe("safeNext", () => {
  it.each([
    ["/board", "/board"],
    ["/offers?city=sfax", "/offers?city=sfax"],
    ["//evil.example", "/offers"],
    ["/\\evil.example", "/offers"],
    ["https://evil.example", "/offers"],
    [undefined, "/offers"],
  ])("%s -> %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});

describe("rateLimit", () => {
  it("allows up to the limit within a window, then resets", () => {
    const key = `test-${Math.random()}`;
    expect([1, 2, 3].map(() => rateLimit(key, 2, 1000, 0))).toEqual([true, true, false]);
    expect(rateLimit(key, 2, 1000, 1001)).toBe(true);
  });
});
