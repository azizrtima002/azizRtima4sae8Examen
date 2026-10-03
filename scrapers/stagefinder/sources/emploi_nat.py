"""Emploi.nat.tn — official portal of ANETI (Agence Nationale pour l'Emploi
et le Travail Indépendant).

The portal publishes offers as an HTML table; columns are identified from
the header row rather than by position, which survives column reordering.
"""

from __future__ import annotations

from ..base import ListingScraper, absolute, soup_of, text_of
from ..models import RawOffer
from ..normalize import normalize_text

COLUMN_KEYS = {
    "title": ("intitule", "poste", "offre", "titre", "emploi"),
    "company": ("employeur", "entreprise", "societe", "raison sociale"),
    "city": ("gouvernorat", "lieu", "ville", "region", "delegation"),
    "date": ("date", "publication", "publie"),
}


def _column_index(headers: list[str]) -> dict[str, int]:
    index: dict[str, int] = {}
    for pos, header in enumerate(headers):
        norm = normalize_text(header)
        for key, needles in COLUMN_KEYS.items():
            if key not in index and any(n in norm for n in needles):
                index[key] = pos
                break
    return index


class EmploiNatScraper(ListingScraper):
    name = "emploi_nat"
    label = "Emploi.nat.tn (ANETI)"
    homepage = "https://www.emploi.nat.tn"
    max_details = 20

    def listing_url(self, page: int) -> str:
        return f"{self.homepage}/fo/Fr/global.php?page=146&mot_cle=stage&num_page={page}"

    def parse_listing(self, html: str, page_url: str) -> list[RawOffer]:
        soup = soup_of(html)
        offers: list[RawOffer] = []
        for table in soup.find_all("table"):
            header_cells = table.select("thead th") or table.select("tr:first-child th, tr:first-child td")
            columns = _column_index([text_of(c) for c in header_cells])
            if "title" not in columns:
                continue
            for row in table.select("tbody tr") or table.find_all("tr")[1:]:
                cells = row.find_all("td")
                if len(cells) <= columns["title"]:
                    continue
                title_cell = cells[columns["title"]]
                link = title_cell.find("a", href=True) or row.find("a", href=True)
                if link is None:
                    continue

                def cell(key: str, cells=cells, columns=columns) -> str:
                    pos = columns.get(key)
                    return text_of(cells[pos]) if pos is not None and pos < len(cells) else ""

                offers.append(
                    RawOffer(
                        title=text_of(title_cell),
                        company=cell("company"),
                        source_url=absolute(page_url, link["href"]),
                        city=cell("city") or None,
                        published=cell("date") or None,
                    )
                )
        return offers
