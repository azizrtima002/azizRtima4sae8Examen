"""Demonstration source backed by fixtures.

Used for local development, CI and tests: it exercises the whole pipeline
(normalization, filtering of non-internships, deduplication, storage, email
alerts) without sending a single request to a real website.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

from ..base import BaseScraper
from ..models import RawOffer

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "demo_offers.json"


class DemoScraper(BaseScraper):
    name = "demo"
    label = "Démo"
    homepage = "https://example.org/stagefinder-demo"

    def __init__(self, fixture: Path = FIXTURE, now: datetime | None = None, **kwargs) -> None:
        super().__init__(**kwargs)
        self.fixture = fixture
        self.now = now

    def scrape(self) -> Iterator[RawOffer]:
        now = self.now or datetime.now(UTC)
        data = json.loads(self.fixture.read_text(encoding="utf-8"))
        for item in data["offers"]:
            yield RawOffer(
                title=item["title"],
                company=item["company"],
                source_url=item["url"],
                city=item.get("city"),
                description=item.get("description"),
                published=now - timedelta(hours=item.get("hours_ago", 0)),
            )
