"""PostgreSQL storage. The schema is owned by Prisma (`web/prisma/schema.prisma`);
this module only writes rows that match it."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

import psycopg

from .models import Offer, SourceResult

UPSERT_OFFER = """
INSERT INTO offers (
    title, company, city, domain, type, description_excerpt, source_name, source_url,
    published_at, scraped_at, is_active, content_hash, search_text
) VALUES (
    %(title)s, %(company)s, %(city)s, %(domain)s, %(type)s::"OfferType", %(description_excerpt)s,
    %(source_name)s, %(source_url)s, %(published_at)s, %(scraped_at)s, TRUE, %(content_hash)s,
    %(search_text)s
)
ON CONFLICT (content_hash) DO UPDATE SET
    scraped_at = EXCLUDED.scraped_at,
    is_active = TRUE,
    city = COALESCE(offers.city, EXCLUDED.city),
    domain = COALESCE(offers.domain, EXCLUDED.domain),
    type = CASE WHEN offers.type = 'OTHER' THEN EXCLUDED.type ELSE offers.type END,
    search_text = CASE WHEN offers.description_excerpt IS NULL
                       THEN EXCLUDED.search_text ELSE offers.search_text END,
    description_excerpt = COALESCE(offers.description_excerpt, EXCLUDED.description_excerpt),
    published_at = LEAST(offers.published_at, EXCLUDED.published_at)
RETURNING (xmax = 0) AS inserted
"""

INSERT_RUN = """
INSERT INTO scraper_runs (source, started_at, finished_at, status, offers_found, offers_new, error_message)
VALUES (%s, %s, %s, %s::"RunStatus", %s, %s, %s)
"""

DEACTIVATE_STALE = """
UPDATE offers SET is_active = FALSE
WHERE is_active AND scraped_at < %s
"""


class Repository(Protocol):
    def save_offers(self, offers: list[Offer], scraped_at: datetime) -> int: ...
    def record_run(self, result: SourceResult) -> None: ...
    def deactivate_stale(self, before: datetime) -> int: ...


class PostgresRepository:
    def __init__(self, dsn: str) -> None:
        self.conn = psycopg.connect(dsn, autocommit=False)

    def save_offers(self, offers: list[Offer], scraped_at: datetime) -> int:
        """Upsert offers and return how many were new."""
        new = 0
        with self.conn.transaction(), self.conn.cursor() as cur:
            for offer in offers:
                cur.execute(
                    UPSERT_OFFER,
                    {
                        "title": offer.title,
                        "company": offer.company,
                        "city": offer.city,
                        "domain": offer.domain,
                        "type": offer.type.value,
                        "description_excerpt": offer.description_excerpt,
                        "source_name": offer.source_name,
                        "source_url": offer.source_url,
                        "published_at": offer.published_at,
                        "scraped_at": scraped_at,
                        "content_hash": offer.content_hash,
                        "search_text": offer.search_text,
                    },
                )
                row = cur.fetchone()
                new += 1 if row and row[0] else 0
        return new

    def record_run(self, result: SourceResult) -> None:
        with self.conn.transaction(), self.conn.cursor() as cur:
            cur.execute(
                INSERT_RUN,
                (
                    result.source,
                    result.started_at,
                    result.finished_at,
                    "SUCCESS" if result.ok else "FAILED",
                    result.offers_found,
                    result.offers_new,
                    (result.error or "")[:2000] or None,
                ),
            )

    def deactivate_stale(self, before: datetime) -> int:
        with self.conn.transaction(), self.conn.cursor() as cur:
            cur.execute(DEACTIVATE_STALE, (before,))
            return cur.rowcount

    def close(self) -> None:
        self.conn.close()


class MemoryRepository:
    """In-memory implementation used by tests and `--dry-run`."""

    def __init__(self) -> None:
        self.offers: dict[str, Offer] = {}
        self.runs: list[SourceResult] = []

    def save_offers(self, offers: list[Offer], scraped_at: datetime) -> int:
        new = 0
        for offer in offers:
            if offer.content_hash not in self.offers:
                self.offers[offer.content_hash] = offer
                new += 1
        return new

    def record_run(self, result: SourceResult) -> None:
        self.runs.append(result)

    def deactivate_stale(self, before: datetime) -> int:
        return 0
