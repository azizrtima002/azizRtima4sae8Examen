#!/usr/bin/env python3
"""Entry point: scrape the configured sources and store the offers.

    python scrapers/run.py                       # sources from $SCRAPER_SOURCES or the real ones
    python scrapers/run.py --sources demo        # fixtures only, no network
    python scrapers/run.py --dry-run             # scrape without a database

Exit code: 0 if at least one source succeeded, 1 if every source failed.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys

from stagefinder.db import MemoryRepository, PostgresRepository
from stagefinder.pipeline import run_pipeline
from stagefinder.registry import REAL_SOURCES, SCRAPERS, get_scrapers


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="StageFinder TN scrapers")
    parser.add_argument(
        "--sources",
        default=os.environ.get("SCRAPER_SOURCES") or ",".join(REAL_SOURCES),
        help=f"comma separated list among: {', '.join(SCRAPERS)}",
    )
    parser.add_argument("--dry-run", action="store_true", help="do not write to the database")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )
    names = [n.strip() for n in args.sources.split(",") if n.strip()]
    scrapers = get_scrapers(names)

    if args.dry_run:
        repo = MemoryRepository()
    else:
        dsn = os.environ.get("DATABASE_URL")
        if not dsn:
            print("DATABASE_URL is not set (use --dry-run to scrape without a database)", file=sys.stderr)
            return 2
        repo = PostgresRepository(dsn)

    try:
        results = run_pipeline(scrapers, repo)
    finally:
        if isinstance(repo, PostgresRepository):
            repo.close()

    in_ci = os.environ.get("GITHUB_ACTIONS") == "true"
    print("\nSource            Status   Found   New")
    for r in results:
        print(f"{r.source:<17} {'OK' if r.ok else 'FAILED':<8} {r.offers_found:>5} {r.offers_new:>5}")
        if not r.ok:
            print(f"  -> {r.error}")
            if in_ci:  # surfaces as an annotation on the workflow run
                print(f"::warning title=Scraper {r.source} failed::{r.error}")
    return 0 if any(r.ok for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
