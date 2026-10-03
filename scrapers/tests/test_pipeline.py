import os
from datetime import UTC, datetime

import pytest

from stagefinder.base import BaseScraper
from stagefinder.db import MemoryRepository
from stagefinder.http import ScrapeError
from stagefinder.models import RawOffer
from stagefinder.pipeline import run_pipeline
from stagefinder.sources.demo import DemoScraper

NOW = datetime(2026, 10, 3, 12, tzinfo=UTC)


class BrokenScraper(BaseScraper):
    name = "broken"
    label = "Broken"
    homepage = "https://broken.example.org"

    def scrape(self):
        yield RawOffer(title="Stage PFE avant la panne", company="X", source_url="https://x/1")
        raise ScrapeError("site redesigned")


class StaticScraper(BaseScraper):
    name = "static"
    label = "Static"
    homepage = "https://static.example.org"

    def __init__(self, offers):
        super().__init__()
        self.offers = offers

    def scrape(self):
        return iter(self.offers)


def test_a_failing_source_does_not_stop_the_others():
    repo = MemoryRepository()
    results = run_pipeline([BrokenScraper(), DemoScraper(now=NOW)], repo, now=lambda: NOW)

    broken, demo = results
    assert not broken.ok and "site redesigned" in broken.error
    assert broken.offers_new == 0  # nothing partial is stored for a failed source
    assert demo.ok and demo.offers_new == 40
    assert len(repo.offers) == 40
    assert [r.source for r in repo.runs] == ["broken", "demo"]


def test_offers_already_seen_are_not_counted_as_new():
    repo = MemoryRepository()
    run_pipeline([DemoScraper(now=NOW)], repo, now=lambda: NOW)
    (second,) = run_pipeline([DemoScraper(now=NOW)], repo, now=lambda: NOW)
    assert second.offers_found == 40
    assert second.offers_new == 0


def test_cross_source_duplicates_are_stored_once():
    a = StaticScraper([RawOffer(title="Stage PFE Java", company="Vermeg", source_url="https://a.tn/1")])
    b = StaticScraper(
        [RawOffer(title="STAGE PFE JAVA (H/F)", company="VERMEG SARL", source_url="https://b.tn/9")]
    )
    repo = MemoryRepository()
    first, second = run_pipeline([a, b], repo, now=lambda: NOW)
    assert first.offers_new == 1 and second.offers_new == 0
    assert len(repo.offers) == 1


@pytest.mark.skipif(not os.environ.get("TEST_DATABASE_URL"), reason="TEST_DATABASE_URL not set")
def test_postgres_repository_round_trip():
    """Integration test against a migrated database (run in CI)."""
    import psycopg

    from stagefinder.db import PostgresRepository

    dsn = os.environ["TEST_DATABASE_URL"]
    with psycopg.connect(dsn, autocommit=True) as conn:
        conn.execute("DELETE FROM offers WHERE source_name = 'static'")

    offers = [
        RawOffer(title="Stage PFE intégration Postgres", company="Test SA", source_url="https://t.tn/1")
    ]
    repo = PostgresRepository(dsn)
    try:
        (first,) = run_pipeline([StaticScraper(offers)], repo, now=lambda: NOW)
        (second,) = run_pipeline([StaticScraper(offers)], repo, now=lambda: NOW)
    finally:
        repo.close()
    assert first.ok and first.offers_new == 1
    assert second.ok and second.offers_new == 0

    with psycopg.connect(dsn, autocommit=True) as conn:
        row = conn.execute(
            "SELECT type, is_active, search_text FROM offers WHERE source_name = 'static'"
        ).fetchone()
        runs = conn.execute("SELECT count(*) FROM scraper_runs WHERE source = 'static'").fetchone()
        conn.execute("DELETE FROM offers WHERE source_name = 'static'")
        conn.execute("DELETE FROM scraper_runs WHERE source = 'static'")
    assert row == ("PFE", True, "stage pfe integration postgres test sa")
    assert runs[0] >= 2
