#!/usr/bin/env python3
"""Live smoke test of the real scrapers — no database involved.

    python scrapers/test.py               # every real source
    python scrapers/test.py keejob        # a single source

For each source it prints what was parsed (first offers, detected city /
domain / type) or the full error. If something breaks, copy the output
into your issue / AI conversation: it contains everything needed to fix
the selectors.
"""

from __future__ import annotations

import logging
import sys
import traceback
from datetime import UTC, datetime

from stagefinder.pipeline import collect
from stagefinder.registry import REAL_SOURCES, get_scrapers


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    names = sys.argv[1:] or list(REAL_SOURCES)
    failures = 0
    for scraper in get_scrapers(names):
        scraper.max_pages = 1
        scraper.max_details = 3
        print(f"\n=== {scraper.label} ({scraper.name}) ===")
        try:
            offers, skipped = collect(scraper, datetime.now(UTC))
        except Exception:  # noqa: BLE001
            failures += 1
            print("FAILED\n" + traceback.format_exc())
            continue
        print(f"OK — {len(offers)} internship offers, {len(skipped)} skipped")
        for offer in offers[:5]:
            print(
                f"- {offer.title} | {offer.company} | city={offer.city} domain={offer.domain} "
                f"type={offer.type.value} | {offer.source_url}"
            )
        for reason in skipped[:5]:
            print(f"  skipped: {reason}")
        if not offers:
            failures += 1
            print("WARNING: no offers parsed — the page markup has probably changed.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
