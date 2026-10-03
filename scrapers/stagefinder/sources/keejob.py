"""Keejob (keejob.com) — Tunisian job board with a dedicated internship flow.

Offer links follow `/offres-emploi/<id>/<slug>/`; cards are located from
those links so that cosmetic markup changes do not break the scraper.
"""

from __future__ import annotations

import re
from urllib.parse import urlencode

from ..base import (
    ListingScraper,
    absolute,
    closest_card,
    find_date,
    find_location,
    first,
    soup_of,
    text_of,
)
from ..models import RawOffer

OFFER_LINK = re.compile(r"/offres-emploi/\d+/")
COMPANY_LINK = re.compile(r"/offres-emploi/companies/|/entreprises?/")


class KeejobScraper(ListingScraper):
    name = "keejob"
    label = "Keejob"
    homepage = "https://www.keejob.com"

    def listing_url(self, page: int) -> str:
        return f"{self.homepage}/offres-emploi/?{urlencode({'keywords': 'stage', 'page': page})}"

    def parse_listing(self, html: str, page_url: str) -> list[RawOffer]:
        soup = soup_of(html)
        offers: list[RawOffer] = []
        seen: set[str] = set()
        for link in soup.find_all("a", href=OFFER_LINK):
            url = absolute(page_url, link.get("href")).split("?")[0]
            title = text_of(link)
            if url in seen or len(title) < 4:  # skip "Voir l'offre" style buttons
                continue
            seen.add(url)
            card = closest_card(link, ("block_white", "post", "card", "job"))
            company_node = card.find("a", href=COMPANY_LINK) or first(card, ".company", "strong")
            description = text_of(first(card, ".description", "p.text-muted", "p")) or None
            offers.append(
                RawOffer(
                    title=title,
                    company=text_of(company_node),
                    source_url=url,
                    city=find_location(card) or None,
                    published=find_date(card) or None,
                    description=description if description and description != title else None,
                )
            )
        return offers

    def parse_detail(self, html: str, offer: RawOffer) -> RawOffer:
        offer = super().parse_detail(html, offer)
        if not offer.description:
            body = first(
                soup_of(html), ".block_a .content", "#job-description", ".job-description", "article"
            )
            offer.description = text_of(body) or None
        return offer
