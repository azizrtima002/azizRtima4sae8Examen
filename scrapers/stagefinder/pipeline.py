"""Run scrapers in isolation, normalize, deduplicate and store their offers.

A failing source never stops the others: its error is logged and recorded in
`scraper_runs`, which feeds the "last successful sync" badge on the site.
"""

from __future__ import annotations

import logging
import traceback
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from .base import BaseScraper
from .db import Repository
from .models import Offer, SourceResult
from .normalize import InvalidOffer, dedupe, is_internship, normalize_offer

log = logging.getLogger(__name__)

#: Offers not seen by any scraper for this long are hidden from the site.
STALE_AFTER = timedelta(days=30)


def collect(scraper: BaseScraper, now: datetime) -> tuple[list[Offer], list[str]]:
    """Scrape one source and return its valid, deduplicated internship offers
    plus human-readable reasons for the entries that were skipped."""
    offers: list[Offer] = []
    skipped: list[str] = []
    for raw in scraper.scrape():
        if not is_internship(raw.title, raw.description):
            skipped.append(f"not an internship: {raw.title!r}")
            continue
        try:
            offers.append(normalize_offer(raw, scraper.name, now))
        except InvalidOffer as exc:
            skipped.append(str(exc))
    return dedupe(offers), skipped


def run_pipeline(
    scrapers: list[BaseScraper],
    repo: Repository,
    now: Callable[[], datetime] = lambda: datetime.now(UTC),
) -> list[SourceResult]:
    results: list[SourceResult] = []
    for scraper in scrapers:
        result = SourceResult(source=scraper.name, started_at=now())
        try:
            offers, result.skipped = collect(scraper, result.started_at)
            result.offers_found = len(offers)
            result.offers_new = repo.save_offers(offers, result.started_at)
            result.ok = True
            log.info(
                "%s: %d offers (%d new, %d skipped)",
                scraper.name,
                result.offers_found,
                result.offers_new,
                len(result.skipped),
            )
        except Exception as exc:  # noqa: BLE001 - one broken source must not stop the others
            result.error = f"{type(exc).__name__}: {exc}"
            log.error("%s failed: %s\n%s", scraper.name, result.error, traceback.format_exc())
        result.finished_at = now()
        try:
            repo.record_run(result)
        except Exception:  # noqa: BLE001
            log.exception("%s: could not record the run", scraper.name)
        results.append(result)

    if any(r.ok for r in results):
        hidden = repo.deactivate_stale(now() - STALE_AFTER)
        if hidden:
            log.info("%d stale offers deactivated", hidden)
    return results
