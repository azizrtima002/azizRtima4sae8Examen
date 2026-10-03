import { describe, expect, it } from "vitest";
import { format } from "@/lib/i18n";
import ar from "@/lib/i18n/ar";
import fr from "@/lib/i18n/fr";

function leaves(obj: object, prefix = ""): [string, string][] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === "string" ? [[`${prefix}${key}`, value] as [string, string]] : leaves(value, `${prefix}${key}.`),
  );
}

describe("dictionaries", () => {
  it("translate every key into Arabic with the same placeholders", () => {
    const arabic = new Map(leaves(ar));
    for (const [key, value] of leaves(fr)) {
      const translated = arabic.get(key);
      expect(translated, key).toBeTruthy();
      const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(placeholders(translated!), key).toEqual(placeholders(value));
    }
  });
});

describe("format", () => {
  it("replaces placeholders and keeps unknown ones", () => {
    expect(format("{count} offres via {source}", { count: 3, source: "Keejob" })).toBe("3 offres via Keejob");
    expect(format("{missing}", {})).toBe("{missing}");
  });
});
