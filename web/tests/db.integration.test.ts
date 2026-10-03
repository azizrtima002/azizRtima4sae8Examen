/**
 * Integration tests against a migrated PostgreSQL database seeded by
 * `python scrapers/run.py --sources demo`. Skipped unless TEST_DATABASE_URL is set.
 */
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { collectDigests } from "@/lib/alerts";
import { buildOfferWhere } from "@/lib/search";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("database integration", () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const email = `integration-${Date.now()}@example.tn`;

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        email,
        passwordHash: "x",
        savedSearches: {
          create: [
            { keywords: "génie civil", createdAt: new Date("2020-01-01") },
            { keywords: "zzz-no-match", createdAt: new Date("2020-01-01") },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it("finds demo offers with accent-insensitive search", async () => {
    const count = await prisma.offer.count({ where: buildOfferWhere({ q: "GENIE civil" }) });
    expect(count).toBeGreaterThan(0);
  });

  it("filters by city and type", async () => {
    const offers = await prisma.offer.findMany({ where: buildOfferWhere({ city: "sfax", type: "PFE" }) });
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((o) => o.city === "sfax" && o.type === "PFE")).toBe(true);
  });

  it("collects alert digests only for matching searches", async () => {
    const digests = await collectDigests(prisma, new Date());
    const mine = digests.find((d) => d.email === email);
    expect(mine?.searchIds).toHaveLength(2);
    expect(mine?.matches).toHaveLength(1);
    expect(mine?.matches[0]?.search.keywords).toBe("génie civil");
    expect(mine?.matches[0]?.total).toBeGreaterThan(0);
  });
});
