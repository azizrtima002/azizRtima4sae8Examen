import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeText, searchTerms } from "@/lib/normalize";

const shared = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../shared/normalize-cases.json"), "utf-8"),
) as { cases: { input: string; expected: string }[] };

describe("normalizeText", () => {
  it.each(shared.cases)("matches the Python normalizer for %j", ({ input, expected }) => {
    expect(normalizeText(input)).toBe(expected);
  });

  it("handles null and undefined", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
  });
});

describe("searchTerms", () => {
  it("normalizes and splits the query", () => {
    expect(searchTerms("  Génie   CIVIL ")).toEqual(["genie", "civil"]);
  });

  it("drops one-letter words but keeps digits", () => {
    expect(searchTerms("a 5G d")).toEqual(["5g"]);
    expect(searchTerms("R 8")).toEqual(["8"]);
  });

  it("caps the number of terms", () => {
    expect(searchTerms("un deux trois quatre cinq six sept huit neuf dix")).toHaveLength(8);
  });
});
