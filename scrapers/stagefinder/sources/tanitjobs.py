"""TanitJobs (tanitjobs.com) — the largest Tunisian job board.

Search results are server-rendered cards (`.listing-item`). The selectors
below list the variants seen on the site; when the markup changes, add the
new selector at the front of the tuple and refresh the test fixture.
"""

from __future__ import annotations

import re
from urllib.parse import urlencode

from ..base import ListingScraper, absolute, closest_card, find_date, first, soup_of, text_of
from ..models import RawOffer

JOB_LINK = re.compile(r"/job/\d+")


class TanitJobsScraper(ListingScraper):
    name = "tanitjobs"
    label = "TanitJobs"
    homepage = "https://www.tanitjobs.com"

    def listing_url(self, page: int) -> str:
        params = {"keywords[all_words]": "stage", "action": "search", "page": page}
        return f"{self.homepage}/jobs/?{urlencode(params)}"

    def parse_listing(self, html: str, page_url: str) -> list[RawOffer]:
        soup = soup_of(html)
        cards = soup.select("article.listing-item, div.listing-item")
        if not cards:
            # Fallback: any link to a job page, grouped by its enclosing card.
            cards = [closest_card(a, ("listing", "job", "card")) for a in soup.find_all("a", href=JOB_LINK)]

        offers: list[RawOffer] = []
        for card in cards:
            link = first(
                card,
                ".listing-item__title a",
                ".media-heading a",
                "h2 a[href]",
                "h3 a[href]",
            ) or card.find("a", href=JOB_LINK)
            if link is None:
                continue
            title = text_of(link)
            url = absolute(page_url, link.get("href"))
            company = text_of(
                first(card, ".listing-item__info--item-company", ".company", "[itemprop=hiringOrganization]")
            )
            city = text_of(
                first(card, ".listing-item__info--item-location", ".location", "[itemprop=jobLocation]")
            )
            date = text_of(first(card, ".listing-item__date", ".date")) or find_date(card)
            description = text_of(first(card, ".listing-item__desc", ".description")) or None
            if title and url:
                offers.append(
                    RawOffer(
                        title=title,
                        company=company,
                        source_url=url.split("?")[0],
                        city=city or None,
                        published=date or None,
                        description=description,
                    )
                )
        return offers

    def parse_detail(self, html: str, offer: RawOffer) -> RawOffer:
        offer = super().parse_detail(html, offer)
        if not offer.description:
            soup = soup_of(html)
            body = first(soup, ".details-body__content", ".job-description", "#job-description")
            offer.description = text_of(body) or None
        return offer
