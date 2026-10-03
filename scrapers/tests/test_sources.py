from datetime import UTC, datetime

import pytest

from stagefinder.http import ScrapeError
from stagefinder.models import OfferType, RawOffer
from stagefinder.pipeline import collect
from stagefinder.registry import REAL_SOURCES, SCRAPERS, get_scrapers
from stagefinder.sources.demo import DemoScraper
from stagefinder.sources.emploi_nat import EmploiNatScraper
from stagefinder.sources.keejob import KeejobScraper
from stagefinder.sources.tanitjobs import TanitJobsScraper

NOW = datetime(2026, 10, 3, 12, tzinfo=UTC)


class FakeHttp:
    """Serves canned HTML by URL, records requested URLs."""

    def __init__(self, pages: dict[str, str], default: str = "<html></html>"):
        self.pages = pages
        self.default = default
        self.requested: list[str] = []

    def get_text(self, url: str) -> str:
        self.requested.append(url)
        for key, html in self.pages.items():
            if key in url:
                return html
        return self.default


# -- TanitJobs ---------------------------------------------------------------


def test_tanitjobs_parses_listing_cards(fixture_html):
    offers = TanitJobsScraper().parse_listing(
        fixture_html("tanitjobs_listing.html"), "https://www.tanitjobs.com/jobs/?page=1"
    )
    assert [o.title for o in offers] == [
        "Stage PFE Développeur Web Angular / Spring",
        "Stage d'été Assistant Marketing",
        "Comptable confirmé (CDI)",
    ]
    first = offers[0]
    assert first.company == "Vermeg"
    assert first.city == "Tunis, Tunisie"
    assert first.published == "il y a 2 jours"
    # tracking query strings are stripped so that URLs stay stable
    assert (
        first.source_url == "https://www.tanitjobs.com/job/1458721/stage-pfe-developpeur-web-angular-spring/"
    )


def test_tanitjobs_detail_page_jsonld_fills_missing_description(fixture_html):
    offer = RawOffer(title="Stage d'été Assistant Marketing", company="Délice Danone", source_url="https://x")
    offer = TanitJobsScraper().parse_detail(fixture_html("tanitjobs_detail.html"), offer)
    assert offer.description.startswith("Stage d'été de deux mois")
    assert "<strong>" not in offer.description
    assert offer.city == "Sousse"
    assert offer.type_hint == "INTERN"


def test_tanitjobs_full_scrape_filters_jobs_and_fetches_details(fixture_html):
    http = FakeHttp(
        {
            "page=1": fixture_html("tanitjobs_listing.html"),
            "/job/1458722/": fixture_html("tanitjobs_detail.html"),
        }
    )
    scraper = TanitJobsScraper(http=http)
    offers, skipped = collect(scraper, NOW)

    assert {o.title for o in offers} == {
        "Stage PFE Développeur Web Angular / Spring",
        "Stage d'été Assistant Marketing",
    }
    assert any("Comptable" in s for s in skipped)
    summer = next(o for o in offers if o.type is OfferType.SUMMER)
    assert summer.city == "sousse"
    assert summer.description_excerpt
    # page 2 returned nothing new, so pagination stopped there
    assert sum("jobs/?" in url for url in http.requested) == 2


def test_listing_scraper_fails_loudly_when_markup_changed():
    scraper = TanitJobsScraper(http=FakeHttp({}, default="<html><body>Nouvelle maquette</body></html>"))
    with pytest.raises(ScrapeError, match="markup changed"):
        list(scraper.scrape())


# -- Keejob ------------------------------------------------------------------


def test_keejob_parses_cards_from_offer_links(fixture_html):
    offers = KeejobScraper().parse_listing(
        fixture_html("keejob_listing.html"), "https://www.keejob.com/offres-emploi/?page=1"
    )
    assert len(offers) == 2  # the "Voir" button duplicates the first link
    civil, worker = offers
    assert civil.title == "Stage PFE Ingénieur Génie Civil"
    assert civil.company == "BET Atlas"
    assert civil.city == "Sfax, Tunisie"
    assert civil.published == "15 septembre 2026"
    assert civil.description.startswith("Étude et dimensionnement")
    assert worker.source_url == "https://www.keejob.com/offres-emploi/215640/stage-ouvrier-electricite/"
    assert worker.company == "STEG"
    assert worker.city == "Bizerte"


def test_keejob_offers_are_classified(fixture_html):
    http = FakeHttp({"page=1": fixture_html("keejob_listing.html")})
    offers, _ = collect(KeejobScraper(http=http), NOW)
    by_title = {o.title: o for o in offers}
    assert by_title["Stage PFE Ingénieur Génie Civil"].domain == "genie-civil"
    assert by_title["Stage PFE Ingénieur Génie Civil"].type is OfferType.PFE
    assert by_title["Stage ouvrier électricité"].type is OfferType.WORKER
    assert by_title["Stage ouvrier électricité"].city == "bizerte"


# -- Emploi.nat.tn -------------------------------------------------------------


def test_emploi_nat_maps_columns_from_headers(fixture_html):
    offers = EmploiNatScraper().parse_listing(
        fixture_html("emploi_nat_listing.html"), "https://www.emploi.nat.tn/fo/Fr/global.php?page=146"
    )
    assert len(offers) == 2
    first = offers[0]
    assert first.title == "Stagiaire en comptabilité (SIVP)"
    assert first.company == "Société Industrielle du Sud"
    assert first.city == "Gabès"
    assert first.published == "20/09/2026"
    assert first.source_url == "https://www.emploi.nat.tn/fo/Fr/global.php?page=990&id=55501"


# -- Demo & registry -----------------------------------------------------------


def test_demo_source_exercises_filtering_and_deduplication():
    offers, skipped = collect(DemoScraper(now=NOW), NOW)
    assert len(skipped) == 2  # the two CDI job offers
    assert len(offers) == 40  # 42 internships, 2 duplicates
    assert len({o.content_hash for o in offers}) == len(offers)
    assert {o.type for o in offers} == {OfferType.PFE, OfferType.SUMMER, OfferType.WORKER}
    assert all(o.city for o in offers)
    assert all(o.domain for o in offers)


def test_registry_exposes_every_source():
    assert set(REAL_SOURCES) <= set(SCRAPERS)
    assert [s.name for s in get_scrapers(["demo", "keejob"])] == ["demo", "keejob"]
    with pytest.raises(ValueError, match="unknown source"):
        get_scrapers(["linkedin"])
