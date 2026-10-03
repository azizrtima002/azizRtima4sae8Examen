"""Registry of available sources. Adding a source = one module + one line here."""

from __future__ import annotations

from .base import BaseScraper
from .sources.demo import DemoScraper
from .sources.emploi_nat import EmploiNatScraper
from .sources.keejob import KeejobScraper
from .sources.tanitjobs import TanitJobsScraper

SCRAPERS: dict[str, type[BaseScraper]] = {
    cls.name: cls for cls in (DemoScraper, TanitJobsScraper, KeejobScraper, EmploiNatScraper)
}

#: Sources used in production when none are given explicitly.
REAL_SOURCES = ("tanitjobs", "keejob", "emploi_nat")


def get_scrapers(names: list[str] | tuple[str, ...]) -> list[BaseScraper]:
    unknown = [n for n in names if n not in SCRAPERS]
    if unknown:
        raise ValueError(f"unknown source(s): {', '.join(unknown)}. Available: {', '.join(SCRAPERS)}")
    return [SCRAPERS[n]() for n in names]
