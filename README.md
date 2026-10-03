# StageFinder TN

**Tous les stages de Tunisie, au même endroit.** StageFinder TN agrège automatiquement les offres de stage (PFE, stage d'été, stage ouvrier) publiées sur les sites d'emploi tunisiens, permet de les rechercher et de les filtrer, et fournit à chaque étudiant un tableau Kanban pour suivre ses candidatures, ainsi que des alertes email.

![Démo de StageFinder TN](docs/demo.gif)

---

## Le problème

Un étudiant tunisien qui cherche un stage doit consulter plus de 10 sites (TanitJobs, Emploi.tn, Keejob, LinkedIn, groupes Facebook…). Les offres y sont éparpillées et mal filtrées, la même annonce apparaît trois fois, et le suivi des candidatures finit dans un tableur.

## La solution

| # | Fonctionnalité | Détail |
|---|---|---|
| F1 | **Agrégation automatique** | Scrapers TanitJobs, Keejob et Emploi.nat.tn (ANETI), lancés 2×/jour par GitHub Actions, avec déduplication entre sources |
| F2 | **Liste des offres** | Titre, entreprise, ville, type (PFE / été / ouvrier), domaine, date, source avec lien vers l'original |
| F3 | **Recherche + filtres** | Recherche plein texte insensible aux accents, filtres ville (24 gouvernorats + télétravail), domaine, type de stage et fraîcheur (< 24 h, < 7 j, < 30 j), pagination |
| F4 | **Détail d'une offre** | Extrait, bouton « Voir l'offre originale », boutons « Postuler » et « Garder pour plus tard » (ajout au Kanban), offres similaires |
| F5 | **Kanban de candidatures** | Intéressé → Postulé → Entretien → Offre / Refus, glisser-déposer (souris, tactile, clavier), notes et date de relance par carte, relances en retard signalées |
| F6 | **Alertes email** | Recherches sauvegardées, puis un email récapitulatif par utilisateur après chaque synchronisation (Resend) |

En plus : interface **bilingue FR/AR** (arabe en RTL), pensée **mobile d'abord**, et un **badge « dernière synchro réussie »** avec l'état de chaque source.

---

## Architecture

```
                 GitHub Actions cron (06:00 et 18:00, heure de Tunis)
┌───────────────────────────────────────────────────────────────────────┐
│  scrapers/ (Python)                                                   │
│  ┌───────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐               │
│  │ TanitJobs │ │  Keejob  │ │ Emploi.nat │ │   Démo   │  un module    │
│  └─────┬─────┘ └────┬─────┘ └─────┬──────┘ └────┬─────┘  par source   │
│        └────────────┴──── PoliteSession ────────┘                     │
│                 robots.txt · 2-3 s entre requêtes · User-Agent honnête│
│                              ▼                                        │
│      Normalisation (ville, domaine, type, date) + déduplication       │
│      content_hash = sha256(titre normalisé | entreprise normalisée)   │
│      Une source en panne n'arrête pas les autres → scraper_runs       │
└──────────────────────────────┬────────────────────────────────────────┘
                               ▼
                 ┌──────────────────────────────┐
                 │ PostgreSQL (schéma Prisma)   │
                 │ offers · users · applications│
                 │ saved_searches · scraper_runs│
                 └───────┬──────────────┬───────┘
                         ▼              ▼
        ┌─────────────────────────┐   ┌──────────────────────────┐
        │ web/ (Next.js 14)       │   │ npm run alerts           │
        │ App Router + API routes │   │ (après chaque scraping)  │
        │ Tailwind · JWT · FR/AR  │   │ → Resend (emails)        │
        └─────────────────────────┘   └──────────────────────────┘
```

### Choix techniques

| Sujet | Choix | Pourquoi |
|---|---|---|
| Scrapers | **Python** (requests + BeautifulSoup) | Écosystème de scraping le plus mûr, code court et lisible. Chaque source est un module qui implémente la même interface (`BaseScraper`) |
| Web + API | **Next.js 14** (App Router, API routes) + TypeScript + Tailwind | Un seul déploiement Vercel pour le frontend et l'API |
| Base | **PostgreSQL + Prisma** | Prisma possède le schéma et les migrations. Les scrapers écrivent en SQL sur les mêmes tables, vérifié en CI par un test d'intégration |
| Recherche | colonne `search_text` normalisée + index trigramme `pg_trgm` | Recherche insensible aux accents et à la casse, sans service externe. La normalisation Python et TypeScript est garantie identique par des vecteurs de test partagés (`shared/normalize-cases.json`) |
| Auth | JWT HS256 (jose) dans un cookie `httpOnly`, mots de passe bcrypt | Simple, sans service tiers. Protection CSRF : JSON obligatoire + vérification d'origine |
| Kanban | `@dnd-kit/core` | Glisser-déposer accessible au clavier et utilisable sur mobile |
| Alertes | Script Node lancé après les scrapers | Réutilise exactement la logique de filtrage du site (`buildOfferWhere`). Un seul email par utilisateur et par exécution, plafonné pour rester dans le quota gratuit de Resend |
| Planification | GitHub Actions cron | Gratuit, avec des logs et des annotations par source en échec |

---

## Lancer en local en 1 commande

Prérequis : Docker.

```bash
docker compose up --build
```

Ouvrez ensuite <http://localhost:3000>. La commande démarre PostgreSQL, applique les migrations, remplit la base avec la **source de démonstration** (40 offres fictives mais réalistes, sans aucune requête vers un vrai site), puis lance le site.

Pour lancer les **vrais scrapers** :

```bash
SCRAPER_SOURCES=tanitjobs,keejob,emploi_nat docker compose run --rm scraper
```

### Sans Docker (développement)

```bash
# 1. Base de données : un PostgreSQL local, ou seulement celui du compose
docker compose up -d db

# 2. Web
cd web
cp .env.example .env          # puis renseignez JWT_SECRET
npm install
npx prisma migrate deploy
npm run dev                   # http://localhost:3000

# 3. Scrapers (dans un autre terminal)
cd scrapers
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
DATABASE_URL=postgresql://stagefinder:stagefinder@localhost:5432/stagefinder python run.py --sources demo

# 4. Alertes email (affichées dans la console sans RESEND_API_KEY)
cd web && npm run alerts
```

---

## Tester les scrapers

```bash
python scrapers/test.py            # teste en direct chaque vraie source, sans base de données
python scrapers/test.py keejob     # une seule source
```

Le script affiche les premières offres trouvées, avec la ville, le domaine et le type détectés, ou l'erreur complète. **Si une source casse** (le site a changé sa mise en page), copiez la sortie dans une issue : elle contient tout ce qu'il faut pour corriger les sélecteurs.

> ⚠️ Les sélecteurs HTML des sources réelles ont été écrits d'après la structure connue de ces sites et sont couverts par des tests sur des pages d'exemple (`scrapers/tests/fixtures/`). Ils doivent être validés contre les sites en ligne avec `python scrapers/test.py`. Les parseurs sont défensifs : plusieurs sélecteurs de repli par champ, repérage des cartes par motif d'URL, lecture du JSON-LD `JobPosting`, et une erreur explicite (« markup changed? ») si une page ne donne plus aucune offre.

### Règles de scraping (appliquées dans `PoliteSession`)

- respect de `robots.txt` (et de `Crawl-delay` s'il est plus long que notre délai) ;
- 2 à 3 secondes entre deux requêtes vers un même site ;
- User-Agent identifiable : `StageFinderTN-Bot/1.0 (+lien du projet)` ;
- seuls un **extrait** (400 caractères) et le **lien vers l'annonce originale** sont stockés : on ne recopie jamais l'offre complète ;
- les offres d'emploi (CDI…) sont écartées : on ne garde que les stages.

LinkedIn n'est pas scrapé : ses conditions d'utilisation l'interdisent. Il pourra être ajouté via une API officielle (V2).

### Ajouter une source

1. Créez `scrapers/stagefinder/sources/ma_source.py` avec une classe qui hérite de `ListingScraper` (pages de résultats HTML) ou de `BaseScraper`, et implémentez `listing_url()` et `parse_listing()`.
2. Ajoutez-la dans `scrapers/stagefinder/registry.py`.
3. Ajoutez une page HTML d'exemple dans `scrapers/tests/fixtures/` et un test dans `tests/test_sources.py`.

---

## Tests

```bash
cd scrapers && pytest          # normalisation, déduplication, client HTTP poli, parseurs, pipeline
cd web && npm test             # recherche, auth/JWT, i18n, alertes, synchronisation avec le normaliseur Python
```

La CI (`.github/workflows/ci.yml`) exécute aussi un **test d'intégration** sur un vrai PostgreSQL : migrations Prisma, puis écriture par les scrapers Python, puis requêtes du site et calcul des alertes.

---

## Déploiement (0 €)

1. **Base de données** : sur [Railway](https://railway.app), créez un projet avec PostgreSQL et copiez la `DATABASE_URL` (onglet *Connect*, URL publique).
2. **Site** : sur [Vercel](https://vercel.com), importez le dépôt GitHub et choisissez `web` comme *Root Directory*. Ajoutez les variables `DATABASE_URL`, `JWT_SECRET` (générée avec `openssl rand -base64 32`) et `APP_URL` (l'URL Vercel). Ensuite, chaque push sur `main` est déployé automatiquement.
3. **Emails** : créez un compte [Resend](https://resend.com) et une clé API. Sans domaine vérifié, Resend n'envoie qu'à l'adresse du compte (`onboarding@resend.dev` comme expéditeur).
4. **Secrets GitHub** (*Settings → Secrets and variables → Actions*) : `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`.
   - Le workflow **CI** applique les migrations sur la base de production à chaque push sur `main`.
   - Le workflow **Scrape** tourne à 06:00 et 18:00 (heure de Tunis). Il peut aussi être lancé à la main (*Actions → Scrape offers & send alerts → Run workflow*).

### Variables d'environnement

| Variable | Utilisée par | Description |
|---|---|---|
| `DATABASE_URL` | web, scrapers, alertes | Chaîne de connexion PostgreSQL |
| `JWT_SECRET` | web | Secret de signature des sessions (≥ 32 caractères, obligatoire en production) |
| `APP_URL` | web, alertes | URL publique du site (liens dans les emails) |
| `RESEND_API_KEY` | alertes | Clé Resend. Si elle est vide, les emails sont affichés dans la console |
| `EMAIL_FROM` | alertes | Expéditeur, par ex. `StageFinder TN <alertes@votre-domaine.tn>` |
| `SCRAPER_SOURCES` | scrapers | Sources à lancer (par défaut `tanitjobs,keejob,emploi_nat`) |
| `SCRAPER_CONTACT` | scrapers | URL de contact ajoutée au User-Agent |
| `MAX_EMAILS_PER_RUN` | alertes | Plafond d'emails par exécution (45 par défaut, adapté au quota gratuit de Resend) |

---

## API

| Méthode | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/api/offers?q=&city=&domain=&type=&freshness=&page=` | – | Liste paginée (20 par page) |
| `GET` | `/api/offers/:id` | – | Détail d'une offre |
| `POST` | `/api/auth/register` · `/api/auth/login` · `/api/auth/logout` | – | Authentification (cookie de session) |
| `GET` | `/api/auth/me` | – | Utilisateur connecté |
| `GET` · `POST` | `/api/applications` | ✓ | Cartes du Kanban / ajout d'une offre (idempotent) |
| `PATCH` · `DELETE` | `/api/applications/:id` | ✓ | Statut, notes, date de relance / suppression |
| `GET` · `POST` | `/api/alerts` | ✓ | Recherches sauvegardées (10 au maximum) |
| `DELETE` | `/api/alerts/:id` | ✓ | Suppression d'une alerte |
| `GET` | `/api/sync-status` | – | Dernière synchro réussie et état de chaque source |
| `GET` | `/api/health` | – | Santé de l'application et de la base |

Les routes en écriture exigent `Content-Type: application/json`. Les erreurs ont la forme `{ "error": { "code", "message", "details?" } }`.

---

## Structure du dépôt

```
.
├── docker-compose.yml          # db + migrations + scraper (démo) + web
├── shared/normalize-cases.json # vecteurs de test communs Python/TypeScript
├── scrapers/                   # Python
│   ├── run.py                  # point d'entrée (cron)
│   ├── test.py                 # test en direct des vraies sources
│   ├── stagefinder/
│   │   ├── base.py             # interface BaseScraper / ListingScraper + helpers HTML
│   │   ├── http.py             # PoliteSession : robots.txt, délai, retries
│   │   ├── normalize.py        # ville, domaine, type, dates, hash de déduplication
│   │   ├── pipeline.py         # isolation des sources, stockage, scraper_runs
│   │   ├── db.py               # upsert PostgreSQL
│   │   └── sources/            # demo, tanitjobs, keejob, emploi_nat
│   └── tests/
├── web/                        # Next.js 14
│   ├── prisma/                 # schéma + migrations
│   ├── scripts/send-alerts.ts  # job des alertes email
│   ├── src/app/                # pages et routes API
│   ├── src/components/         # UI (Kanban, filtres, cartes…)
│   ├── src/lib/                # recherche, auth, i18n, taxonomie, alertes
│   └── tests/
└── .github/workflows/          # ci.yml, scrape.yml
```

## Feuille de route (V2)

- Profil avec CV et score de correspondance CV ↔ offre (IA)
- Notifications Telegram
- Tableau de bord public des statistiques (offres par domaine et par ville)
- Source LinkedIn via une API officielle

---

Les offres affichées restent la propriété de leurs sources respectives. StageFinder TN n'en publie qu'un extrait et renvoie toujours vers l'annonce originale.
