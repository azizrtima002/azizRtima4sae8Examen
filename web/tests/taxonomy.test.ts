import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CITY_SLUGS, DOMAIN_SLUGS, OFFER_TYPE_KEYS, cityLabel, typeLabel } from "@/lib/taxonomy";

const pythonFile = (name: string) =>
  readFileSync(path.resolve(__dirname, "../../scrapers/stagefinder", name), "utf-8");
const python = pythonFile("normalize.py");

/** Top-level keys of a Python dict literal such as `CITY_ALIASES: dict[...] = {`. */
function pythonDictKeys(name: string): string[] {
  const start = python.indexOf(`${name}:`);
  const body = python.slice(start, python.indexOf("\n}\n", start));
  return [...body.matchAll(/^ {4}"([^"]+)":/gm)].map((m) => m[1]!);
}

describe("taxonomy stays in sync with the Python normalizer", () => {
  it("has a label for every city slug the scrapers can produce", () => {
    expect([...CITY_SLUGS].sort()).toEqual(pythonDictKeys("CITY_ALIASES").sort());
  });

  it("has a label for every domain slug the scrapers can produce", () => {
    expect([...DOMAIN_SLUGS].sort()).toEqual(pythonDictKeys("DOMAIN_KEYWORDS").sort());
  });

  it("matches the OfferType enum", () => {
    const enumValues = [...pythonFile("models.py").matchAll(/^ {4}(\w+) = "(\w+)"$/gm)].map((m) => m[2]);
    expect([...OFFER_TYPE_KEYS].sort()).toEqual(enumValues.sort());
  });
});

describe("labels", () => {
  it("translates known keys and falls back to the key", () => {
    expect(cityLabel("sfax", "ar")).toBe("صفاقس");
    expect(typeLabel("SUMMER", "fr")).toBe("Stage d'été");
    expect(cityLabel("atlantis", "fr")).toBe("atlantis");
    expect(cityLabel(null, "fr")).toBeNull();
  });
});
