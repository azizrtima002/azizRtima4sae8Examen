"""Data structures shared by every scraper and by the pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum


class OfferType(StrEnum):
    """Mirrors the `OfferType` enum of the Prisma schema."""

    PFE = "PFE"
    SUMMER = "SUMMER"
    WORKER = "WORKER"
    OTHER = "OTHER"


@dataclass(slots=True)
class RawOffer:
    """An offer exactly as a source exposes it, before any normalization.

    Scrapers only fill what they can read; the normalizer infers the rest
    (city, domain, type) from the text.
    """

    title: str
    company: str
    source_url: str
    city: str | None = None
    description: str | None = None
    published: str | datetime | None = None
    type_hint: str | None = None
    domain_hint: str | None = None


@dataclass(slots=True)
class Offer:
    """A normalized offer, ready to be stored in the `offers` table."""

    title: str
    company: str
    city: str | None
    domain: str | None
    type: OfferType
    description_excerpt: str | None
    source_name: str
    source_url: str
    published_at: datetime
    content_hash: str
    search_text: str


@dataclass(slots=True)
class SourceResult:
    """Outcome of one scraper run, persisted in `scraper_runs`."""

    source: str
    started_at: datetime
    finished_at: datetime | None = None
    ok: bool = False
    offers_found: int = 0
    offers_new: int = 0
    error: str | None = None
    skipped: list[str] = field(default_factory=list)
