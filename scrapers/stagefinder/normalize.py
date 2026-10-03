"""Normalization: turn heterogeneous source data into clean, comparable offers.

Everything that classifies an offer (city, domain, type) or identifies it
(content hash) lives here so that every source is treated identically.

The keys returned for cities and domains are stable slugs; the web app owns
their human labels (FR/AR). Keep `web/src/lib/taxonomy.ts` in sync when you
add a key here.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from datetime import UTC, datetime, timedelta

from .models import Offer, OfferType, RawOffer

EXCERPT_MAX_CHARS = 400

# --------------------------------------------------------------------------
# Text
# --------------------------------------------------------------------------

_NON_ALNUM = re.compile(r"[\W_]+", re.UNICODE)


def normalize_text(value: str | None) -> str:
    """Lowercase, strip accents and punctuation, collapse whitespace.

    Must stay byte-for-byte identical to `normalizeText` in
    `web/src/lib/normalize.ts` (see `shared/normalize-cases.json`).
    """
    if not value:
        return ""
    decomposed = unicodedata.normalize("NFKD", value)
    stripped = "".join(c for c in decomposed if not unicodedata.category(c).startswith("M"))
    return _NON_ALNUM.sub(" ", stripped.lower()).strip()


def clean_whitespace(value: str | None) -> str:
    """Collapse runs of whitespace (including non-breaking spaces) into one space."""
    if not value:
        return ""
    return re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip()


def make_excerpt(description: str | None, limit: int = EXCERPT_MAX_CHARS) -> str | None:
    """Short excerpt shown on the site. We never republish a full offer:
    the excerpt plus a link to the original keeps the source credited."""
    text = clean_whitespace(description)
    if not text:
        return None
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(" ,;:.-–")
    return f"{cut}…"


# --------------------------------------------------------------------------
# Deduplication
# --------------------------------------------------------------------------

# Noise that differs between sites for the very same offer.
_TITLE_NOISE = re.compile(r"\b(h f|f h|m f|f m|h x|x h|urgent|nouveau|new|offre de stage|offre)\b")
_COMPANY_NOISE = re.compile(
    r"\b(sarl|suarl|sa|s a|spa|ltd|llc|inc|sas|group|groupe|tunisie|tunisia|tn|ste|societe)\b"
)


def dedup_key_title(title: str) -> str:
    return clean_whitespace(_TITLE_NOISE.sub(" ", normalize_text(title)))


def dedup_key_company(company: str) -> str:
    key = clean_whitespace(_COMPANY_NOISE.sub(" ", normalize_text(company)))
    # "Ste Vermeg SARL" and "Vermeg" must collide, but an all-noise name
    # ("Groupe SA") must not collapse to an empty key.
    return key or normalize_text(company)


def content_hash(title: str, company: str) -> str:
    """Identity of an offer across sources: normalized title + company."""
    key = f"{dedup_key_title(title)}|{dedup_key_company(company)}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------
# Classification
# --------------------------------------------------------------------------

# Governorate slug -> aliases (normalized). Localities map to their governorate
# so that "Les Berges du Lac" and "Tunis" land in the same filter.
CITY_ALIASES: dict[str, tuple[str, ...]] = {
    "tunis": (
        "tunis",
        "grand tunis",
        "lac",
        "les berges du lac",
        "berges du lac",
        "charguia",
        "centre urbain nord",
        "cun",
        "montplaisir",
        "la marsa",
        "marsa",
        "carthage",
        "le kram",
        "la goulette",
        "el menzah",
        "menzah",
        "mutuelleville",
        "bab bhar",
        "el omrane",
        "le bardo",
        "bardo",
        "sidi bou said",
    ),
    "ariana": (
        "ariana",
        "ennasr",
        "el ghazala",
        "technopole el ghazala",
        "raoued",
        "soukra",
        "la soukra",
        "mnihla",
        "kalaat el andalous",
        "sidi thabet",
        "borj louzir",
    ),
    "ben-arous": (
        "ben arous",
        "megrine",
        "rades",
        "ezzahra",
        "hammam lif",
        "mourouj",
        "el mourouj",
        "fouchana",
        "mohamedia",
        "boumhel",
        "nouvelle medina",
        "mornag",
        "hammam chott",
    ),
    "manouba": ("manouba", "la manouba", "denden", "oued ellil", "douar hicher", "tebourba"),
    "nabeul": (
        "nabeul",
        "hammamet",
        "yasmine hammamet",
        "korba",
        "kelibia",
        "menzel temime",
        "grombalia",
        "soliman",
        "dar chaabane",
        "beni khiar",
        "menzel bouzelfa",
    ),
    "zaghouan": ("zaghouan", "el fahs", "bir mcherga"),
    "bizerte": ("bizerte", "menzel bourguiba", "mateur", "ras jebel", "menzel jemil"),
    "beja": ("beja", "medjez el bab", "testour"),
    "jendouba": ("jendouba", "tabarka", "ain draham"),
    "kef": ("kef", "le kef", "el kef"),
    "siliana": ("siliana", "makthar"),
    "sousse": (
        "sousse",
        "sahloul",
        "hammam sousse",
        "akouda",
        "kalaa kebira",
        "msaken",
        "enfidha",
        "kantaoui",
        "port el kantaoui",
        "technopole de sousse",
    ),
    "monastir": ("monastir", "ksar hellal", "moknine", "jemmal", "teboulba", "sahline"),
    "mahdia": ("mahdia", "ksour essef", "el jem"),
    "sfax": ("sfax", "sakiet ezzit", "sakiet eddaier", "thyna", "technopole de sfax"),
    "kairouan": ("kairouan",),
    "kasserine": ("kasserine",),
    "sidi-bouzid": ("sidi bouzid",),
    "gabes": ("gabes",),
    "medenine": ("medenine", "djerba", "jerba", "houmt souk", "zarzis", "ben gardane"),
    "tataouine": ("tataouine",),
    "gafsa": ("gafsa", "metlaoui"),
    "tozeur": ("tozeur", "nefta"),
    "kebili": ("kebili", "douz"),
    "remote": ("teletravail", "remote", "full remote", "travail a distance"),
}

# Longest aliases first so "hammam sousse" wins over "sousse" and
# "technopole el ghazala" over "el ghazala".
_CITY_PATTERNS: list[tuple[re.Pattern[str], str]] = sorted(
    (
        (re.compile(rf"\b{re.escape(alias)}\b"), slug)
        for slug, aliases in CITY_ALIASES.items()
        for alias in aliases
    ),
    key=lambda item: -len(item[0].pattern),
)


def detect_city(*texts: str | None) -> str | None:
    """Return the governorate slug of the first text that names one."""
    for text in texts:
        norm = normalize_text(text)
        if not norm:
            continue
        for pattern, slug in _CITY_PATTERNS:
            if pattern.search(norm):
                return slug
    return None


# Domain slug -> keywords (normalized, matched on word boundaries).
DOMAIN_KEYWORDS: dict[str, tuple[str, ...]] = {
    "informatique": (
        "informatique",
        "developpeur",
        "developpement",
        "developer",
        "software",
        "logiciel",
        "web",
        "mobile",
        "full stack",
        "fullstack",
        "frontend",
        "front end",
        "backend",
        "back end",
        "devops",
        "data",
        "data science",
        "machine learning",
        "ia",
        "intelligence artificielle",
        "cloud",
        "cybersecurite",
        "securite informatique",
        "java",
        "python",
        "javascript",
        "react",
        "angular",
        "node",
        "nodejs",
        "php",
        "dotnet",
        "asp net",
        "erp",
        "odoo",
        "sap",
        "base de donnees",
        "bi",
        "business intelligence",
        "qa",
        "testeur",
        "systeme d information",
        "genie logiciel",
        "it",
        "big data",
        "flutter",
    ),
    "telecom": (
        "telecom",
        "telecommunication",
        "telecommunications",
        "reseau",
        "reseaux",
        "network",
        "5g",
        "4g",
        "fibre optique",
        "radio",
        "rf",
    ),
    "genie-civil": (
        "genie civil",
        "btp",
        "batiment",
        "construction",
        "structure",
        "chantier",
        "topographie",
        "geotechnique",
        "travaux publics",
        "architecture",
        "architecte",
    ),
    "genie-electrique": (
        "genie electrique",
        "electrique",
        "electricite",
        "electronique",
        "electrotechnique",
        "automatisme",
        "automatique",
        "embarque",
        "systemes embarques",
        "plc",
        "energie",
        "photovoltaique",
        "mecatronique",
    ),
    "genie-mecanique": (
        "genie mecanique",
        "mecanique",
        "conception mecanique",
        "catia",
        "solidworks",
        "maintenance",
        "productique",
        "aeronautique",
        "automobile",
    ),
    "genie-industriel": (
        "genie industriel",
        "industriel",
        "qualite",
        "lean",
        "production",
        "methodes",
        "supply chain",
        "logistique",
        "achats",
        "hse",
        "process",
        "amelioration continue",
    ),
    "chimie-bio": (
        "chimie",
        "chimique",
        "biologie",
        "biotechnologie",
        "agroalimentaire",
        "pharmaceutique",
        "pharmacie",
        "laboratoire",
        "genie des procedes",
        "environnement",
    ),
    "marketing": (
        "marketing",
        "digital marketing",
        "marketing digital",
        "communication",
        "community manager",
        "social media",
        "seo",
        "brand",
        "evenementiel",
        "publicite",
    ),
    "finance": (
        "finance",
        "financier",
        "comptabilite",
        "comptable",
        "audit",
        "controle de gestion",
        "banque",
        "bancaire",
        "assurance",
        "fiscalite",
        "tresorerie",
        "actuariat",
    ),
    "commerce": (
        "commercial",
        "commerce",
        "vente",
        "ventes",
        "business developer",
        "business development",
        "sales",
        "relation client",
        "service client",
        "import export",
        "commerce international",
    ),
    "rh": ("ressources humaines", "rh", "recrutement", "talent", "paie", "human resources"),
    "design": (
        "design",
        "designer",
        "ui",
        "ux",
        "graphiste",
        "graphique",
        "multimedia",
        "infographie",
        "motion design",
        "audiovisuel",
        "3d",
        "architecte d interieur",
        "architecture d interieur",
        "design d espace",
    ),
    "juridique": ("juridique", "droit", "juriste", "legal", "contentieux"),
    "tourisme": ("tourisme", "hotellerie", "hotel", "restauration", "voyage"),
    "sante": ("medical", "sante", "infirmier", "paramedical", "clinique", "kinesitherapie"),
}

_DOMAIN_PATTERNS: dict[str, list[re.Pattern[str]]] = {
    slug: [re.compile(rf"\b{re.escape(k)}\b") for k in keywords] for slug, keywords in DOMAIN_KEYWORDS.items()
}


def detect_domain(title: str, description: str | None = None, hint: str | None = None) -> str | None:
    """Score each domain: keyword hits in the title weigh 3, in the hint 2,
    in the description 1. Returns the best scoring slug, or None."""
    weighted = ((normalize_text(title), 3), (normalize_text(hint), 2), (normalize_text(description), 1))
    best_slug, best_score = None, 0
    for slug, patterns in _DOMAIN_PATTERNS.items():
        score = sum(
            weight for text, weight in weighted if text for pattern in patterns if pattern.search(text)
        )
        if score > best_score:
            best_slug, best_score = slug, score
    return best_slug


_TYPE_RULES: list[tuple[OfferType, re.Pattern[str]]] = [
    (
        OfferType.PFE,
        re.compile(
            r"\b(pfe|projet de fin d etudes?|projet fin d etudes?|fin d etudes?|"
            r"graduation project|end of studies|master thesis|memoire de fin)\b"
        ),
    ),
    (OfferType.WORKER, re.compile(r"\b(stage ouvrier|stages ouvriers|ouvrier)\b")),
    (
        OfferType.SUMMER,
        re.compile(
            r"\b(stage d ete|stages d ete|stage ete|stage estival|summer internship|"
            r"summer intern|summer camp|ete 20\d\d|juillet aout)\b"
        ),
    ),
]


def detect_type(title: str, description: str | None = None, hint: str | None = None) -> OfferType:
    """Most specific type wins; the title is trusted before the description."""
    for text in (title, hint, description):
        norm = normalize_text(text)
        if not norm:
            continue
        for offer_type, pattern in _TYPE_RULES:
            if pattern.search(norm):
                return offer_type
    return OfferType.OTHER


_INTERNSHIP = re.compile(
    r"\b(stage|stages|stagiaire|stagiaires|pfe|internship|internships|intern|interns|"
    r"fin d etudes?|graduation project)\b"
)


def is_internship(title: str, description: str | None = None) -> bool:
    """Sources mix jobs and internships; we only keep internships."""
    return bool(_INTERNSHIP.search(normalize_text(title))) or bool(
        _INTERNSHIP.search(normalize_text((description or "")[:300]))
    )


# --------------------------------------------------------------------------
# Dates
# --------------------------------------------------------------------------

_FR_MONTHS = {
    "janvier": 1,
    "janv": 1,
    "jan": 1,
    "january": 1,
    "fevrier": 2,
    "fevr": 2,
    "fev": 2,
    "feb": 2,
    "february": 2,
    "mars": 3,
    "mar": 3,
    "march": 3,
    "avril": 4,
    "avr": 4,
    "apr": 4,
    "april": 4,
    "mai": 5,
    "may": 5,
    "juin": 6,
    "jun": 6,
    "june": 6,
    "juillet": 7,
    "juil": 7,
    "jul": 7,
    "july": 7,
    "aout": 8,
    "aug": 8,
    "august": 8,
    "septembre": 9,
    "sept": 9,
    "sep": 9,
    "september": 9,
    "octobre": 10,
    "oct": 10,
    "october": 10,
    "novembre": 11,
    "nov": 11,
    "november": 11,
    "decembre": 12,
    "dec": 12,
    "december": 12,
}

_RELATIVE = re.compile(
    r"(?:il y a|depuis|since)?\s*(\d+|un|une)\s*"
    r"(minutes?|mins?|heures?|hours?|h|jours?|days?|j|semaines?|weeks?|mois|months?)\b"
)
_UNIT_DELTA = {
    "min": timedelta(minutes=1),
    "h": timedelta(hours=1),
    "heure": timedelta(hours=1),
    "hour": timedelta(hours=1),
    "j": timedelta(days=1),
    "jour": timedelta(days=1),
    "day": timedelta(days=1),
    "semaine": timedelta(weeks=1),
    "week": timedelta(weeks=1),
    "mois": timedelta(days=30),
    "month": timedelta(days=30),
}


def _unit_delta(unit: str) -> timedelta:
    if unit in _UNIT_DELTA:
        return _UNIT_DELTA[unit]
    for prefix in ("min", "heure", "hour", "jour", "day", "semaine", "week", "month"):
        if unit.startswith(prefix):
            return _UNIT_DELTA[prefix]
    return timedelta(days=1)


def parse_date(value: str | datetime | None, now: datetime | None = None) -> datetime | None:
    """Parse the many date formats Tunisian job boards use.

    Handles ISO dates, dd/mm/yyyy, "12 septembre 2026", "Sep 12, 2026",
    "aujourd'hui", "hier" and relative forms like "il y a 3 jours".
    Always returns an aware UTC datetime, never in the future.
    """
    now = now or datetime.now(UTC)
    if value is None:
        return None
    if isinstance(value, datetime):
        parsed = value if value.tzinfo else value.replace(tzinfo=UTC)
        return min(parsed.astimezone(UTC), now)

    raw = clean_whitespace(value)
    if not raw:
        return None

    iso = re.search(r"(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?", raw)
    if iso:
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            y, m, d = (int(iso.group(i)) for i in (1, 2, 3))
            hh, mm = int(iso.group(4) or 0), int(iso.group(5) or 0)
            try:
                parsed = datetime(y, m, d, hh, mm, tzinfo=UTC)
            except ValueError:
                return None
        return parse_date(parsed, now)

    numeric = re.search(r"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b", raw)
    if numeric:
        d, m, y = (int(numeric.group(i)) for i in (1, 2, 3))
        y = y + 2000 if y < 100 else y
        try:
            return min(datetime(y, m, d, tzinfo=UTC), now)
        except ValueError:
            return None

    norm = normalize_text(raw)
    if re.search(r"\b(aujourd hui|today|a l instant|just now|maintenant)\b", norm):
        return now
    if re.search(r"\b(hier|yesterday)\b", norm):
        return now - timedelta(days=1)

    relative = _RELATIVE.search(norm)
    if relative:
        amount = relative.group(1)
        count = 1 if amount in ("un", "une") else int(amount)
        return now - count * _unit_delta(relative.group(2))

    words = re.search(r"\b(\d{1,2})\s+([a-z]+)\s+(\d{4})\b", norm)  # 12 septembre 2026
    if words and words.group(2) in _FR_MONTHS:
        try:
            return min(
                datetime(int(words.group(3)), _FR_MONTHS[words.group(2)], int(words.group(1)), tzinfo=UTC),
                now,
            )
        except ValueError:
            return None
    words = re.search(r"\b([a-z]+)\s+(\d{1,2})\s+(\d{4})\b", norm)  # sep 12 2026
    if words and words.group(1) in _FR_MONTHS:
        try:
            return min(
                datetime(int(words.group(3)), _FR_MONTHS[words.group(1)], int(words.group(2)), tzinfo=UTC),
                now,
            )
        except ValueError:
            return None
    return None


# --------------------------------------------------------------------------
# Raw -> normalized offer
# --------------------------------------------------------------------------


class InvalidOffer(ValueError):
    """Raised when a raw offer lacks the minimum data to be useful."""


def normalize_offer(raw: RawOffer, source_name: str, now: datetime | None = None) -> Offer:
    now = now or datetime.now(UTC)
    title = clean_whitespace(raw.title)
    company = clean_whitespace(raw.company) or "Entreprise confidentielle"
    url = (raw.source_url or "").strip()

    if len(title) < 4:
        raise InvalidOffer(f"title too short: {title!r}")
    if not url.startswith(("http://", "https://")):
        raise InvalidOffer(f"invalid source url: {url!r}")

    description = clean_whitespace(raw.description)
    excerpt = make_excerpt(description)
    city = detect_city(raw.city, title, description[:500])
    domain = detect_domain(title, description, raw.domain_hint)
    offer_type = detect_type(title, description, raw.type_hint)
    published_at = parse_date(raw.published, now) or now

    search_text = normalize_text(" ".join(filter(None, [title, company, raw.city, excerpt])))

    return Offer(
        title=title[:300],
        company=company[:200],
        city=city,
        domain=domain,
        type=offer_type,
        description_excerpt=excerpt,
        source_name=source_name,
        source_url=url[:1000],
        published_at=published_at,
        content_hash=content_hash(title, company),
        search_text=search_text,
    )


def dedupe(offers: list[Offer]) -> list[Offer]:
    """Collapse offers that share a content hash, keeping the richest copy
    (one with a description, then the oldest publication date)."""
    best: dict[str, Offer] = {}
    for offer in offers:
        current = best.get(offer.content_hash)
        if current is None or _richness(offer) > _richness(current):
            best[offer.content_hash] = offer
    return list(best.values())


def _richness(offer: Offer) -> tuple[int, int, int, float]:
    return (
        len(offer.description_excerpt or ""),
        1 if offer.city else 0,
        1 if offer.type is not OfferType.OTHER else 0,
        -offer.published_at.timestamp(),
    )
