"""Common interface every source implements, plus HTML helpers they share."""

from __future__ import annotations

import json
import logging
import re
from abc import ABC, abstractmethod
from collections.abc import Iterable, Iterator
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag

from .http import PoliteSession, ScrapeError
from .models import RawOffer
from .normalize import clean_whitespace

log = logging.getLogger(__name__)


class BaseScraper(ABC):
    """One subclass per source. A scraper only *reads* a source: it yields
    `RawOffer`s and never touches the database. Normalization, deduplication
    and storage are handled by the pipeline, identically for every source."""

    #: Stable identifier, stored in `offers.source_name` and `scraper_runs.source`.
    name: str
    #: Human readable name displayed on the site.
    label: str
    #: Home page of the source.
    homepage: str

    def __init__(self, http: PoliteSession | None = None) -> None:
        self._http = http

    @property
    def http(self) -> PoliteSession:
        if self._http is None:
            self._http = PoliteSession()
        return self._http

    @abstractmethod
    def scrape(self) -> Iterable[RawOffer]:
        """Yield the offers currently published by the source."""


class ListingScraper(BaseScraper):
    """Template for sources exposing paginated HTML search results.

    Subclasses implement `listing_url(page)` and `parse_listing(html, url)`.
    When a listing card has no description, the detail page is fetched (up to
    `max_details` per run) and parsed with `parse_detail`, which understands
    schema.org `JobPosting` JSON-LD out of the box.
    """

    max_pages: int = 3
    max_details: int = 40

    @abstractmethod
    def listing_url(self, page: int) -> str: ...

    @abstractmethod
    def parse_listing(self, html: str, page_url: str) -> list[RawOffer]: ...

    def parse_detail(self, html: str, offer: RawOffer) -> RawOffer:
        return enrich_from_jsonld(html, offer)

    def scrape(self) -> Iterator[RawOffer]:
        seen: set[str] = set()
        details_fetched = 0
        for page in range(1, self.max_pages + 1):
            url = self.listing_url(page)
            try:
                html = self.http.get_text(url)
            except ScrapeError as exc:
                if page == 1:
                    raise
                # Keep what earlier pages gave us rather than losing the whole run.
                log.warning("%s: stopping at page %d (%s)", self.name, page, exc)
                break
            offers = self.parse_listing(html, url)
            if page == 1 and not offers:
                # An empty first page almost always means the markup changed:
                # fail loudly so the run is reported instead of silently empty.
                raise ScrapeError(f"{self.name}: no offers parsed from {url} (markup changed?)")
            fresh = [o for o in offers if o.source_url not in seen]
            if not fresh:
                break
            for offer in fresh:
                seen.add(offer.source_url)
                if not offer.description and details_fetched < self.max_details:
                    details_fetched += 1
                    try:
                        offer = self.parse_detail(self.http.get_text(offer.source_url), offer)
                    except ScrapeError as exc:
                        log.warning("%s: detail page skipped (%s)", self.name, exc)
                yield offer


# --------------------------------------------------------------------------
# HTML helpers
# --------------------------------------------------------------------------


def soup_of(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


def text_of(node: Tag | None) -> str:
    return clean_whitespace(node.get_text(" ", strip=True)) if node else ""


def first(node: Tag, *selectors: str) -> Tag | None:
    """First match among several CSS selectors: sources change their markup,
    so each field is looked up through a list of known variants."""
    for selector in selectors:
        found = node.select_one(selector)
        if found is not None:
            return found
    return None


def absolute(base: str, href: str | None) -> str:
    return urljoin(base, href) if href else ""


def closest_card(link: Tag, stop_classes: tuple[str, ...] = ()) -> Tag:
    """Walk up from an offer link to the element that holds the whole card."""
    node: Tag = link
    for _ in range(8):
        parent = node.parent
        if not isinstance(parent, Tag) or parent.name in ("body", "html"):
            break
        node = parent
        classes = " ".join(node.get("class", []))
        if node.name in ("article", "li", "tr") or any(c in classes for c in stop_classes):
            return node
    return node


def iter_jsonld(html: str | BeautifulSoup) -> Iterator[dict]:
    soup = html if isinstance(html, BeautifulSoup) else soup_of(html)
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or script.get_text() or "")
        except (json.JSONDecodeError, TypeError):
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            item = stack.pop(0)
            if isinstance(item, dict):
                if "@graph" in item and isinstance(item["@graph"], list):
                    stack.extend(item["@graph"])
                yield item


def _html_to_text(value: str) -> str:
    return text_of(soup_of(value)) if "<" in value else clean_whitespace(value)


def jobposting_to_fields(item: dict) -> dict:
    """Extract the fields we use from a schema.org JobPosting object."""
    org = item.get("hiringOrganization")
    company = org.get("name") if isinstance(org, dict) else org if isinstance(org, str) else None

    city = None
    locations = item.get("jobLocation")
    for loc in locations if isinstance(locations, list) else [locations]:
        if isinstance(loc, dict):
            address = loc.get("address")
            if isinstance(address, dict):
                city = address.get("addressLocality") or address.get("addressRegion")
            elif isinstance(address, str):
                city = address
            if city:
                break

    description = item.get("description")
    return {
        "title": clean_whitespace(item.get("title")),
        "company": clean_whitespace(company),
        "city": clean_whitespace(city) or None,
        "description": _html_to_text(description) if isinstance(description, str) else None,
        "published": item.get("datePosted"),
        "type_hint": " ".join(item.get("employmentType", []))
        if isinstance(item.get("employmentType"), list)
        else item.get("employmentType"),
        "domain_hint": item.get("industry") or item.get("occupationalCategory"),
    }


def enrich_from_jsonld(html: str, offer: RawOffer) -> RawOffer:
    """Fill missing fields of `offer` from the page's JobPosting JSON-LD."""
    for item in iter_jsonld(html):
        types = item.get("@type")
        if types == "JobPosting" or (isinstance(types, list) and "JobPosting" in types):
            fields = jobposting_to_fields(item)
            offer.description = offer.description or fields["description"]
            offer.city = offer.city or fields["city"]
            offer.published = offer.published or fields["published"]
            offer.company = offer.company or fields["company"] or ""
            offer.type_hint = offer.type_hint or fields["type_hint"]
            offer.domain_hint = offer.domain_hint or fields["domain_hint"]
            break
    return offer


_ICON_LABEL = re.compile(r"(map|marker|location|lieu|place|pin)", re.I)
_DATE_LABEL = re.compile(r"(clock|calendar|date|time|time-ago|posted)", re.I)


def find_by_icon(card: Tag, pattern: re.Pattern[str]) -> str:
    """Many boards render `<i class="fa fa-map-marker"></i> Tunis`: find the
    text next to an icon whose class matches `pattern`."""
    for icon in card.find_all(["i", "span", "svg"]):
        classes = " ".join(icon.get("class", []))
        if classes and pattern.search(classes):
            parent = icon.parent
            label = text_of(parent) if isinstance(parent, Tag) else ""
            if label:
                return label
    return ""


def find_location(card: Tag) -> str:
    return find_by_icon(card, _ICON_LABEL)


def find_date(card: Tag) -> str:
    time_tag = card.find("time")
    if isinstance(time_tag, Tag):
        return str(time_tag.get("datetime") or text_of(time_tag))
    return find_by_icon(card, _DATE_LABEL)
