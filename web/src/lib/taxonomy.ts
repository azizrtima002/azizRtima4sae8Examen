/**
 * Controlled vocabularies shared by the filters, the API validation and the
 * email alerts. City and domain slugs are produced by the Python normalizer
 * (scrapers/stagefinder/normalize.py): keep both lists in sync.
 */

export type Locale = "fr" | "ar";
export type Label = Record<Locale, string>;

export const CITIES = {
  tunis: { fr: "Tunis", ar: "تونس" },
  ariana: { fr: "Ariana", ar: "أريانة" },
  "ben-arous": { fr: "Ben Arous", ar: "بن عروس" },
  manouba: { fr: "Manouba", ar: "منوبة" },
  nabeul: { fr: "Nabeul", ar: "نابل" },
  zaghouan: { fr: "Zaghouan", ar: "زغوان" },
  bizerte: { fr: "Bizerte", ar: "بنزرت" },
  beja: { fr: "Béja", ar: "باجة" },
  jendouba: { fr: "Jendouba", ar: "جندوبة" },
  kef: { fr: "Le Kef", ar: "الكاف" },
  siliana: { fr: "Siliana", ar: "سليانة" },
  sousse: { fr: "Sousse", ar: "سوسة" },
  monastir: { fr: "Monastir", ar: "المنستير" },
  mahdia: { fr: "Mahdia", ar: "المهدية" },
  sfax: { fr: "Sfax", ar: "صفاقس" },
  kairouan: { fr: "Kairouan", ar: "القيروان" },
  kasserine: { fr: "Kasserine", ar: "القصرين" },
  "sidi-bouzid": { fr: "Sidi Bouzid", ar: "سيدي بوزيد" },
  gabes: { fr: "Gabès", ar: "قابس" },
  medenine: { fr: "Médenine / Djerba", ar: "مدنين / جربة" },
  tataouine: { fr: "Tataouine", ar: "تطاوين" },
  gafsa: { fr: "Gafsa", ar: "قفصة" },
  tozeur: { fr: "Tozeur", ar: "توزر" },
  kebili: { fr: "Kébili", ar: "قبلي" },
  remote: { fr: "Télétravail", ar: "عن بعد" },
} as const satisfies Record<string, Label>;

export const DOMAINS = {
  informatique: { fr: "Informatique", ar: "إعلامية" },
  telecom: { fr: "Télécommunications", ar: "اتصالات" },
  "genie-civil": { fr: "Génie civil", ar: "هندسة مدنية" },
  "genie-electrique": { fr: "Génie électrique", ar: "هندسة كهربائية" },
  "genie-mecanique": { fr: "Génie mécanique", ar: "هندسة ميكانيكية" },
  "genie-industriel": { fr: "Génie industriel & qualité", ar: "هندسة صناعية وجودة" },
  "chimie-bio": { fr: "Chimie & biotechnologies", ar: "كيمياء وبيوتكنولوجيا" },
  marketing: { fr: "Marketing & communication", ar: "تسويق واتصال" },
  finance: { fr: "Finance & comptabilité", ar: "مالية ومحاسبة" },
  commerce: { fr: "Commerce & vente", ar: "تجارة ومبيعات" },
  rh: { fr: "Ressources humaines", ar: "موارد بشرية" },
  design: { fr: "Design & multimédia", ar: "تصميم ووسائط متعددة" },
  juridique: { fr: "Juridique", ar: "قانون" },
  tourisme: { fr: "Tourisme & hôtellerie", ar: "سياحة وفندقة" },
  sante: { fr: "Santé", ar: "صحة" },
} as const satisfies Record<string, Label>;

export const OFFER_TYPES = {
  PFE: { fr: "PFE", ar: "مشروع ختم الدروس" },
  SUMMER: { fr: "Stage d'été", ar: "تربص صيفي" },
  WORKER: { fr: "Stage ouvrier", ar: "تربص عامل" },
  OTHER: { fr: "Autre stage", ar: "تربص آخر" },
} as const satisfies Record<string, Label>;

export const FRESHNESS = {
  "24h": { fr: "Moins de 24 h", ar: "أقل من 24 ساعة", ms: 24 * 3600 * 1000 },
  "7d": { fr: "Moins de 7 jours", ar: "أقل من 7 أيام", ms: 7 * 24 * 3600 * 1000 },
  "30d": { fr: "Moins de 30 jours", ar: "أقل من 30 يومًا", ms: 30 * 24 * 3600 * 1000 },
} as const;

export const APPLICATION_STATUSES = {
  INTERESTED: { fr: "Intéressé", ar: "مهتم" },
  APPLIED: { fr: "Postulé", ar: "تم التقديم" },
  INTERVIEW: { fr: "Entretien", ar: "مقابلة" },
  OFFER: { fr: "Offre", ar: "عرض" },
  REJECTED: { fr: "Refus", ar: "رفض" },
} as const satisfies Record<string, Label>;

export const SOURCES: Record<string, { label: string; homepage: string }> = {
  tanitjobs: { label: "TanitJobs", homepage: "https://www.tanitjobs.com" },
  keejob: { label: "Keejob", homepage: "https://www.keejob.com" },
  emploi_nat: { label: "Emploi.nat.tn (ANETI)", homepage: "https://www.emploi.nat.tn" },
  demo: { label: "Démo", homepage: "https://example.org/stagefinder-demo" },
};

export type CitySlug = keyof typeof CITIES;
export type DomainSlug = keyof typeof DOMAINS;
export type OfferTypeKey = keyof typeof OFFER_TYPES;
export type FreshnessKey = keyof typeof FRESHNESS;
export type ApplicationStatusKey = keyof typeof APPLICATION_STATUSES;

export const CITY_SLUGS = Object.keys(CITIES) as [CitySlug, ...CitySlug[]];
export const DOMAIN_SLUGS = Object.keys(DOMAINS) as [DomainSlug, ...DomainSlug[]];
export const OFFER_TYPE_KEYS = Object.keys(OFFER_TYPES) as [OfferTypeKey, ...OfferTypeKey[]];
export const FRESHNESS_KEYS = Object.keys(FRESHNESS) as [FreshnessKey, ...FreshnessKey[]];
export const APPLICATION_STATUS_KEYS = Object.keys(APPLICATION_STATUSES) as [
  ApplicationStatusKey,
  ...ApplicationStatusKey[],
];

function lookup<T extends Record<string, Label>>(table: T, key: string | null | undefined, locale: Locale) {
  if (!key) return null;
  return (table as Record<string, Label>)[key]?.[locale] ?? key;
}

export const cityLabel = (slug: string | null | undefined, locale: Locale) => lookup(CITIES, slug, locale);
export const domainLabel = (slug: string | null | undefined, locale: Locale) => lookup(DOMAINS, slug, locale);
export const typeLabel = (key: string | null | undefined, locale: Locale) => lookup(OFFER_TYPES, key, locale);
export const sourceLabel = (name: string) => SOURCES[name]?.label ?? name;
