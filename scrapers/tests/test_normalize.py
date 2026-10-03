import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from stagefinder.models import OfferType, RawOffer
from stagefinder.normalize import (
    EXCERPT_MAX_CHARS,
    InvalidOffer,
    detect_city,
    detect_domain,
    detect_type,
    is_internship,
    make_excerpt,
    normalize_offer,
    normalize_text,
    parse_date,
)

NOW = datetime(2026, 10, 3, 12, 0, tzinfo=UTC)
SHARED = json.loads(
    (Path(__file__).resolve().parents[2] / "shared" / "normalize-cases.json").read_text("utf-8")
)


@pytest.mark.parametrize("case", SHARED["cases"], ids=lambda c: c["input"][:30] or "empty")
def test_normalize_text_matches_shared_vectors(case):
    assert normalize_text(case["input"]) == case["expected"]


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Les Berges du Lac, Tunis", "tunis"),
        ("Technopole El Ghazala", "ariana"),
        ("Hammam Sousse", "sousse"),
        ("Mégrine", "ben-arous"),
        ("DJERBA", "medenine"),
        ("Sfax, Tunisie", "sfax"),
        ("Télétravail", "remote"),
        ("Paris, France", None),
        (None, None),
    ],
)
def test_detect_city(text, expected):
    assert detect_city(text) == expected


def test_detect_city_falls_back_to_later_texts():
    assert detect_city(None, "Stage PFE à Monastir") == "monastir"


@pytest.mark.parametrize(
    ("title", "description", "expected"),
    [
        ("Stage PFE Développeur Full-Stack React", None, "informatique"),
        ("PFE Génie Civil – Étude d'un bâtiment", None, "genie-civil"),
        ("Stage d'été Assistant Marketing Digital", None, "marketing"),
        ("Stage PFE Contrôle de gestion", "analyse budgétaire et audit", "finance"),
        ("Stage PFE Ingénieur Qualité", "démarche lean et amélioration continue", "genie-industriel"),
        ("PFE Télécoms – Réseau 5G", None, "telecom"),
        ("Stage", "Rien de spécifique ici", None),
    ],
)
def test_detect_domain(title, description, expected):
    assert detect_domain(title, description) == expected


def test_detect_domain_title_outweighs_description():
    assert detect_domain("Stage PFE Marketing", "outil développé en Python et React") == "marketing"


@pytest.mark.parametrize(
    ("title", "description", "expected"),
    [
        ("Stage PFE Data Science", None, OfferType.PFE),
        ("Projet de fin d'études en génie civil", None, OfferType.PFE),
        ("Stage ouvrier – Maintenance", None, OfferType.WORKER),
        ("Stage d'été développeur", None, OfferType.SUMMER),
        ("Summer internship 2026", None, OfferType.SUMMER),
        ("Stage commercial", "Stage de fin d'études de 6 mois", OfferType.PFE),
        ("Stage commercial", "L'offre a été publiée hier", OfferType.OTHER),
        ("Stagiaire comptable", None, OfferType.OTHER),
    ],
)
def test_detect_type(title, description, expected):
    assert detect_type(title, description) == expected


@pytest.mark.parametrize(
    ("title", "description", "expected"),
    [
        ("Stage PFE Java", None, True),
        ("Stagiaire comptable", None, True),
        ("Summer Internship", None, True),
        ("Développeur Java", "Projet de fin d'études chez nous", True),
        ("Comptable confirmé (CDI)", "5 ans d'expérience", False),
        ("Ingénieur DevOps Senior", None, False),
    ],
)
def test_is_internship(title, description, expected):
    assert is_internship(title, description) is expected


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("2026-09-12", datetime(2026, 9, 12, tzinfo=UTC)),
        ("2026-09-12T08:30:00Z", datetime(2026, 9, 12, 8, 30, tzinfo=UTC)),
        ("12/09/2026", datetime(2026, 9, 12, tzinfo=UTC)),
        ("Publiée le 12.09.26", datetime(2026, 9, 12, tzinfo=UTC)),
        ("15 septembre 2026", datetime(2026, 9, 15, tzinfo=UTC)),
        ("Sep 15, 2026", datetime(2026, 9, 15, tzinfo=UTC)),
        ("aujourd'hui", NOW),
        ("Hier", NOW - timedelta(days=1)),
        ("il y a 3 jours", NOW - timedelta(days=3)),
        ("Il y a 5 heures", NOW - timedelta(hours=5)),
        ("il y a une semaine", NOW - timedelta(weeks=1)),
        ("2 days ago", NOW - timedelta(days=2)),
        ("bientôt", None),
        ("", None),
        (None, None),
    ],
)
def test_parse_date(value, expected):
    assert parse_date(value, NOW) == expected


def test_parse_date_never_returns_future_dates():
    assert parse_date("2030-01-01", NOW) == NOW


def test_parse_date_rejects_impossible_dates():
    assert parse_date("31/02/2026", NOW) is None


def test_make_excerpt_truncates_on_word_boundary():
    text = "mot " * 200
    excerpt = make_excerpt(text)
    assert excerpt is not None
    assert len(excerpt) <= EXCERPT_MAX_CHARS + 1
    assert excerpt.endswith("mot…")


def test_make_excerpt_keeps_short_text():
    assert make_excerpt("  Court\n texte ") == "Court texte"
    assert make_excerpt(None) is None


def test_normalize_offer_builds_a_complete_offer():
    raw = RawOffer(
        title="  Stage PFE – Développeur React ",
        company="Medina Soft",
        source_url="https://example.org/offre/1",
        city="Les Berges du Lac",
        description="Développement d'une application web en React.",
        published="il y a 2 jours",
    )
    offer = normalize_offer(raw, "demo", NOW)
    assert offer.title == "Stage PFE – Développeur React"
    assert offer.city == "tunis"
    assert offer.domain == "informatique"
    assert offer.type is OfferType.PFE
    assert offer.published_at == NOW - timedelta(days=2)
    assert offer.source_name == "demo"
    assert "developpeur react" in offer.search_text
    assert "medina soft" in offer.search_text


def test_normalize_offer_defaults():
    offer = normalize_offer(RawOffer(title="Stage PFE", company="", source_url="https://x.tn/1"), "demo", NOW)
    assert offer.company == "Entreprise confidentielle"
    assert offer.published_at == NOW


@pytest.mark.parametrize(
    "raw",
    [
        RawOffer(title="PFE", company="X", source_url="https://x.tn/1"),
        RawOffer(title="Stage PFE Java", company="X", source_url="/relative/url"),
    ],
)
def test_normalize_offer_rejects_invalid_offers(raw):
    with pytest.raises(InvalidOffer):
        normalize_offer(raw, "demo", NOW)
