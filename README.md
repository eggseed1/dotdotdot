# larper101 / 꺼드럭대마왕

A bilingual, pixel-art obscurity challenge. **Music Only** and **All Media** (music, movies, books, anime, games). Name a valid obscure title to dive deeper into the inferno. English brand **larper101**; Korean brand **꺼드럭대마왕**.

## Implemented prototype

- Seven questions per daily game; 25 seconds each, with browser-local single-player progress.
- Korean and English UI; original little-devil + crimson hellscape art (provided by project owner).
- Result screen with **seven answers, points, possible answers** and a copyable public `?r=...` link. The code recalculates scores instead of trusting scores encoded in the link. **Solo share codes are portable and unverified**, not an authoritative record.
- Live WebSocket 1v1: private rooms, ranked queue, 7 shared questions, opponent lock indicators, identical-answer jinx, synchronized reveal, rematch lobby.
- Provisional guest Elo (initial 1000, first 10 placement matches at K=48, then K=24), ranked ladder API, persisted match history, and **shareable `?match=<id>`** completed-duel reports with possible answers. The match page requires the Node server and saved data.
- Offline catalog import into indexed SQLite with source provenance, aliases, genres, rating counts, authorization requirements, and tests. Imported results are available to the **PvP server**; the local daily UI still uses the curated fixture.

**This is NOT a complete RYM / Backloggd / Letterboxd / Spotify / IMDb / MAL catalog.** Current fixture has a small number of hand-selected titles, and its popularity values are illustrative. Production coverage, authorization, normalization, prompt generation and security remain future work. Rankings using guest identities are not cheat-resistant. Do not advertise the game as fully populated.

## Run locally

Requires Node.js **22.13+** (built-in experimental SQLite support).

```bash
npm install
npm run build
npm start
# http://localhost:8787
```

For a frontend-only demo: `npm run dev`; the live 1v1 server must also run via `npm run server` to enable ranked play.

```bash
npm test
```

## Authorized data imports

Use API licenses and permitted official exports only. We do not implement scraping protections bypasses. The importer supports **JSONL, TSV, CSV** with a normalized schema:

```json
{"kind":"music","title":"Example Album","creator":"Example Artist","sourceId":"release-group-123","year":1987,"country":"Japan","genres":["shoegaze","dream pop"],"aliases":["Alternate Name"],"ratingCount":540,"verified":true,"sourceUrl":"https://example.org/123"}
```

Required: `kind` (music/film/literature/anime/games), `title`, `sourceId`. Optional: `titleKo`, `creator`, `year`, `country`, `genres`, `aliases`, `ratingCount`, `verified`, `sourceUrl`. Imported works without **verified** metadata or positive vote counts are not included in ranked rarity pools. `ratingCount` should reflect the actual count of listeners/raters/voters, not an average rating.

```bash
npm run import:catalog -- --source musicbrainz --file permitted-music.jsonl
npm run import:catalog -- --source openlibrary --file licensed-books.tsv
npm run import:catalog -- --source imdb --file licensed-imdb.jsonl --authorized
npm run import:catalog -- --source rym --file authorized-rym-export.csv --authorized
```

The `--authorized` flag is a confirmation that **you already have legal permission**, not permission itself. For a production import, check rights for each dataset, do canonical ID/alternate edition deduplication, ensure genre/country definitions match, and keep popularity counts comparable within the same source. The loader does not download or fetch the providers automatically. Run imports on a separate machine or background job for multi-gigabyte datasets. SQLite's `node:sqlite` is experimental in Node 22; use managed PostgreSQL for large production deployments.

| Desired source | Path to real data | Restriction |
| --- | --- | --- |
| RYM | Permission / licensed export | No unrestricted public bulk API |
| Backloggd | Permission / export | No general sanctioned bulk catalog feed |
| Spotify | Registered developer Web API | Rate/field limitations; no broad unrestricted export |
| Letterboxd | Approved API access | By request only, restricted intended uses |
| IMDb | Official noncommercial IMDb TSV datasets | Confirm noncommercial license or obtain commercial rights |
| MyAnimeList | Approved MAL API / authorized content | Authentication and usage rules; unofficial Jikan is not a licensed bulk dump |
| MusicBrainz | Official data dump, then normalize as JSONL/TSV | Attribution and license obligations |
| Open Library | Monthly works/authors/ratings dumps | Prefer dumps to bulk API calls |
| Film alternatives | TMDB API with attribution | API key and license |
| Games alternatives | IGDB API with Twitch OAuth | API credentials and license |

Supported aliases let the game avoid false negatives, but duplicate works across providers and title collisions must be resolved before a large ranked launch.

## APIs

- `GET /health` — server health
- `GET /api/catalog/status` — imported catalog coverage and sources
- `GET /api/leaderboard` — provisional top guest Elo ratings
- `GET /api/matches/:id` — completed public 1v1 results (retains latest 250 matches)
- WebSocket `/ws` — same-match questions, validation, jinx, final result

## Deployment

GitHub Pages only serves the static single-player preview. **For ranked play and live sharing, deploy the Node server on a persistent-disk host** with `DATA_DIR` set to a persistent directory and `PORT` configured by the host. The server hosts both the built frontend and WebSocket API.

## Security/production work before launch

Replace guest UUIDs with authenticated identities, introduce account-specific Elo records and match auditing, load authoritative daily prompts from the backend, pin release-day rarity snapshots, and implement anti-cheat/server-validated daily attempts. Backups, rate limits, abuse controls, source normalization, and dispute reports are required for a production ranking system.

## Bilingual title suggestions and permitted catalog expansion

Typing at least two characters now opens a selectable dropdown in solo and ranked 1v1. Search works across English and Korean regardless of the language toggle; e.g. `중경` / `Chungking` and `에반게리온` / `Evangelion` resolve to the same works. Arrow keys navigate and Enter selects; a second Enter submits. Submissions still require a valid matching work. The Node server offers `GET /api/suggest` (normalized aliases and trigram typo search) and `POST /api/validate` (imported title + prompt + verified count rarity).

### Import the broadest available *permitted* sources

**MusicBrainz:** For comprehensive coverage, download the [CC0 core database dump](https://musicbrainz.org/doc/MusicBrainz_Database/Download). Supplementary tags and ratings are under different licenses. For a *limited* rate-controlled API discovery sample:

```sh
CATALOG_CONTACT_EMAIL=your-real-contact@example.com npm run fetch:musicbrainz -- --query 'primarytype:album' --limit 100 --out musicbrainz-sample.jsonl
npm run import:catalog -- --source musicbrainz --file musicbrainz-sample.jsonl
```

The query fetcher identifies itself, never exceeds one request per second, and caps responses; do not use repeated sample requests as a replacement for the core dump.

**Open Library:** Download the [monthly works dump](https://openlibrary.org/developers/dumps) rather than scraping HTML or using the API for bulk collection:

```sh
npm run import:books -- --file /path/to/ol_dump_works_YYYY-MM-DD.txt.gz --limit 250000
```

This streaming importer collects identifiers, book titles, release dates, and subjects, but *does not invent* missing creator countries or readership counts.

**Wikidata:** CC0 multilingual labels and cross-media entities. A capped sample importer for a local experiment (for broad imports use Wikidata dumps):

```sh
CATALOG_CONTACT_EMAIL=your-real-contact@example.com npm run fetch:wikidata -- --kind film --limit 50 --out wiki-films.jsonl
npm run import:catalog -- --source wikidata --file wiki-films.jsonl
```

**Restricted sources:** RYM, Bandcamp, Last.fm, Spotify, IMDb, Letterboxd, MyAnimeList, Backloggd, and similar catalogs each have separate restrictions. Don't scrape or evade blocks. If you obtain a *licensed export*, `scripts/import-catalog.mjs` can ingest normalized JSONL / TSV / CSV with `--authorized` where required. Last.fm's documented API requires a key and the required licensing approval for commercial usage.

**Important:** These scripts create infrastructure, NOT a complete imported catalog. The checked-in sample data is still small. Full popularity-based competitive rarity needs authorized, comparable user-count signals plus rigorous entity matching across providers. Records without reliable popularity counts can be suggested, but are not scored as exceptionally obscure by default.

For Node-only tests without npm packages: `node --test server/*.test.mjs src/lib/title-match.test.mjs`. For the app build, install dependencies and run `npm run build`.


## Bulk IMDb movie database importer

New: `scripts/import-imdb-dump.mjs` streams official `title.basics.tsv.gz`, `title.ratings.tsv.gz`, and optionally `title.akas.tsv.gz` into the indexed catalog. It imports all feature films (unless `--limit` is set), joins real vote counts on disk, indexes Korean/alternate titles for fuzzy autocomplete, and does not fabricate countries or creators.

**Licensing:** IMDb public downloadable datasets are generally limited to noncommercial use. Check your use is permitted or obtain appropriate rights before downloading/importing. The `--acknowledge-imdb-terms` flag does not grant permission.

```sh
npm run import:imdb -- --basics /data/title.basics.tsv.gz --ratings /data/title.ratings.tsv.gz --akas /data/title.akas.tsv.gz --db /data/catalog.sqlite --acknowledge-imdb-terms
npm run test:bulk
```

This importer is a real bulk-data pathway, **not an imported dataset**. The live Node server needs `CATALOG_DB=/data/catalog.sqlite` with persistent storage. GitHub Pages cannot query the database, and its solo game still uses the small fixture until server-backed daily gameplay is deployed. Music, books, anime and games also remain incomplete until their official/authorized bulk sources are ingested.
