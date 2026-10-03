import type { SavedSearch } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { criteriaToQuery, describeCriteria, renderDigestEmail, type UserDigest } from "@/lib/alerts";
import { healthOf } from "@/lib/sync";

const search: SavedSearch = {
  id: "s1",
  userId: "u1",
  keywords: "react",
  city: "tunis",
  domain: null,
  type: "PFE",
  lastNotifiedAt: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
};

const offer = (id: string, title: string) => ({
  id,
  title,
  company: "Medina <Soft>",
  city: "tunis",
  domain: "informatique",
  type: "PFE" as const,
  sourceName: "keejob",
  publishedAt: new Date("2026-10-02T00:00:00Z"),
  descriptionExcerpt: null,
});

describe("alert criteria", () => {
  it("describes and serializes criteria", () => {
    expect(describeCriteria(search)).toBe("react · Tunis · PFE");
    expect(criteriaToQuery(search)).toBe("?q=react&city=tunis&type=PFE");
    expect(describeCriteria({ keywords: "", city: null, domain: null, type: null })).toBe("Toutes les offres");
  });
});

describe("renderDigestEmail", () => {
  const digest: UserDigest = {
    userId: "u1",
    email: "a@b.tn",
    searchIds: ["s1"],
    matches: [{ search, offers: [offer("o1", "Stage PFE <React>")], total: 12 }],
  };

  it("summarizes the number of new offers in the subject", () => {
    expect(renderDigestEmail(digest, "https://stagefinder.tn/").subject).toBe(
      "12 nouvelles offres de stage pour vos alertes",
    );
  });

  it("escapes HTML and links to the site", () => {
    const { html, text } = renderDigestEmail(digest, "https://stagefinder.tn/");
    expect(html).toContain("Stage PFE &lt;React&gt;");
    expect(html).toContain("Medina &lt;Soft&gt;");
    expect(html).not.toContain("<React>");
    expect(html).toContain("https://stagefinder.tn/offers/o1");
    expect(html).toContain("https://stagefinder.tn/offers?q=react&amp;city=tunis&amp;type=PFE");
    expect(html).toContain("https://stagefinder.tn/alerts");
    expect(text).toContain("- Stage PFE <React> — Medina <Soft>");
  });
});

describe("healthOf", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000);

  it.each([
    [null, "never"],
    [hoursAgo(1), "fresh"],
    [hoursAgo(20), "late"],
    [hoursAgo(48), "stale"],
  ] as const)("%s -> %s", (date, expected) => {
    expect(healthOf(date, now)).toBe(expected);
  });
});
