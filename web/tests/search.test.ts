import { describe, expect, it } from "vitest";
import { filtersToQuery, hasActiveFilters } from "@/lib/query";
import { buildOfferWhere, parseOfferFilters } from "@/lib/search";

const NOW = new Date("2026-10-03T12:00:00Z");

describe("parseOfferFilters", () => {
  it("parses valid parameters", () => {
    expect(
      parseOfferFilters({ q: " react ", city: "tunis", domain: "informatique", type: "PFE", freshness: "7d", page: "3" }),
    ).toEqual({ q: "react", city: "tunis", domain: "informatique", type: "PFE", freshness: "7d", page: 3 });
  });

  it("drops invalid values instead of failing", () => {
    expect(parseOfferFilters({ city: "paris", type: "CDI", freshness: "1y", page: "-4" })).toEqual({
      q: undefined,
      city: undefined,
      domain: undefined,
      type: undefined,
      freshness: undefined,
      page: 1,
    });
  });

  it("accepts URLSearchParams and repeated keys", () => {
    expect(parseOfferFilters(new URLSearchParams("city=sfax&page=2")).city).toBe("sfax");
    expect(parseOfferFilters({ city: ["sousse", "sfax"] }).city).toBe("sousse");
  });

  it("treats a blank query as no query", () => {
    expect(parseOfferFilters({ q: "   " }).q).toBeUndefined();
  });
});

describe("buildOfferWhere", () => {
  it("only returns active offers by default", () => {
    expect(buildOfferWhere({}, NOW)).toEqual({ AND: [{ isActive: true }] });
  });

  it("requires every normalized search term", () => {
    const where = buildOfferWhere({ q: "Génie Civil" }, NOW);
    expect(where.AND).toEqual([
      { isActive: true },
      { searchText: { contains: "genie" } },
      { searchText: { contains: "civil" } },
    ]);
  });

  it("combines structured filters", () => {
    const where = buildOfferWhere({ city: "sfax", domain: "finance", type: "SUMMER", freshness: "24h" }, NOW);
    expect(where.AND).toEqual([
      { isActive: true },
      { city: "sfax" },
      { domain: "finance" },
      { type: "SUMMER" },
      { publishedAt: { gte: new Date("2026-10-02T12:00:00Z") } },
    ]);
  });
});

describe("filtersToQuery", () => {
  it("omits empty values and page 1", () => {
    expect(filtersToQuery({ q: "data", city: undefined, page: 1 })).toBe("?q=data");
    expect(filtersToQuery({})).toBe("");
  });

  it("applies overrides", () => {
    expect(filtersToQuery({ q: "data", page: 2 }, { page: 3 })).toBe("?q=data&page=3");
  });

  it("detects active filters", () => {
    expect(hasActiveFilters({ page: 4 })).toBe(false);
    expect(hasActiveFilters({ type: "PFE" })).toBe(true);
  });
});
