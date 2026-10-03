from datetime import UTC, datetime, timedelta

from stagefinder.models import RawOffer
from stagefinder.normalize import content_hash, dedupe, normalize_offer

NOW = datetime(2026, 10, 3, tzinfo=UTC)


def test_same_offer_with_different_formatting_collides():
    a = content_hash("Stage PFE – Développeur Full-Stack React / Node.js", "Medina Soft")
    b = content_hash("STAGE PFE - Developpeur Full Stack React/Node.js (H/F)", "MEDINA SOFT SARL")
    assert a == b


def test_company_legal_suffixes_and_country_are_ignored():
    assert content_hash("Stage PFE Java", "Vermeg") == content_hash("Stage PFE Java", "Ste Vermeg Tunisie SA")


def test_different_titles_do_not_collide():
    assert content_hash("Stage PFE Java", "Vermeg") != content_hash("Stage PFE Python", "Vermeg")


def test_different_companies_do_not_collide():
    assert content_hash("Stage PFE Java", "Vermeg") != content_hash("Stage PFE Java", "Sofrecom")


def test_all_noise_company_name_still_identifies_the_company():
    assert content_hash("Stage PFE Java", "Groupe SA") != content_hash("Stage PFE Java", "")


def _offer(title, company, description=None, hours=0, source="demo"):
    return normalize_offer(
        RawOffer(
            title=title,
            company=company,
            source_url=f"https://{source}.example.org/{abs(hash(title + company + str(hours)))}",
            description=description,
            published=NOW - timedelta(hours=hours),
        ),
        source,
        NOW,
    )


def test_dedupe_keeps_one_entry_per_offer():
    offers = [
        _offer("Stage PFE Java", "Vermeg", hours=1),
        _offer("STAGE PFE JAVA (H/F)", "VERMEG SARL", hours=5),
        _offer("Stage PFE Python", "Vermeg"),
    ]
    assert len(dedupe(offers)) == 2


def test_dedupe_prefers_the_copy_with_the_richest_description():
    poor = _offer("Stage PFE Java", "Vermeg", description=None, hours=1)
    rich = _offer(
        "Stage PFE Java (H/F)", "Vermeg SARL", description="Description complète du stage.", hours=9
    )
    (kept,) = dedupe([poor, rich])
    assert kept.description_excerpt == "Description complète du stage."


def test_dedupe_prefers_the_oldest_publication_on_ties():
    recent = _offer("Stage PFE Java", "Vermeg", hours=1, source="keejob")
    older = _offer("Stage PFE Java", "Vermeg", hours=30, source="tanitjobs")
    (kept,) = dedupe([recent, older])
    assert kept.source_name == "tanitjobs"
