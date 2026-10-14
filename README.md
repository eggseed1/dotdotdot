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

## Bilingual suggestions and a larger catalog (October 2026)

- Start typing **2+ characters** in any solo or 1v1 answer field. The dropdown accepts English and Korean titles regardless of site language. Arrow keys select, Enter chooses a suggestion, Enter again submits. Examples in the curated catalog: `중경`, `Chungking`, `에반게리온`, `Evangelion`.
- The live Node server adds a **normalized alias + trigram index**, so missing punctuation, romanization aliases, and small typos can return helpful suggestions without letting a typo silently count as a correct answer.
- The `/api/suggest?kind=film&q=중경` endpoint returns a bounded list without spoilers such as rarity, vote counts, or other eligible answers. `/api/validate` checks imported titles against the actual prompt and the known popularity evidence.
- Run `npm test` after installing dependencies, or `node --test server/*.test.mjs src/lib/title-match.test.mjs` for dependency-free backend tests.

### Public data you CAN import (not unauthorized scraping)

**Music:** MusicBrainz [official CC0 core dumps](https://musicbrainz.org/doc/MusicBrainz_Database/Download) are the starting point for broad album/artist identities. The *supplementary tags and ratings* have different, restrictive licenses, so core music metadata **does not automatically provide RYM genres or rarity scores**. For a small, rate-limited API sample:

```sh
CATALOG_CONTACT_EMAIL=your-contact@example.com npm run fetch:musicbrainz -- --query 'primarytype:album' --limit 100 --out musicbrainz-sample.jsonl
npm run import:catalog -- --source musicbrainz --file musicbrainz-sample.jsonl
```

The fetcher uses an identifying User-Agent, makes no more than one request a second, and caps requests at five pages; **do not use repeated API queries as a substitute for the official full dump**. If the catalog's albums have no reliable vote counts, they appear as suggestions but are not used for ranked rarity scoring.

**Books:** Use [Open Library's monthly works dumps](https://openlibrary.org/developers/dumps), not HTML scraping or bulk API harvesting:

```sh
npm run import:books -- --file /path/to/ol_dump_works_2026-XX-XX.txt.gz --limit 250000
```

The importer streams a compressed official dump in bounded memory, preserving Open Library identifiers, titles, years and subjects. It does not invent missing creator countries or rating counts.

**Multilingual film, game, anime and music titles:** Wikidata's CC0 knowledge graph supports English and Korean labels. A **small capped discovery query** (for bulk collection, use its official dumps) produces another JSONL source:

```sh
CATALOG_CONTACT_EMAIL=your-contact@example.com npm run fetch:wikidata -- --kind film --limit 50 --out wiki-films.jsonl
npm run import:catalog -- --source wikidata --file wiki-films.jsonl
```

**Optional licensed imports:** `.jsonl`, `.tsv`, or `.csv` from RYM, Backloggd, Letterboxd, IMDb, Spotify, TMDB, Last.fm, AniList, or other providers can be normalized by `scripts/import-catalog.mjs` **only with the relevant permissions and source attribution**. For restricted sources, use `--authorized` only after you actually have rights to the dataset. The project never logs in to scrape, bypasses rate limits, or defeats anti-bot controls.

### What is not yet complete

No comprehensive third-party database has been copied into this repository, and large dumps are not checked into git. The two game modes still start with the original small curated offline catalog. Imported, verified titles become searchable while running the **Node server** with `CATALOG_DB` pointing to your prepared SQLite database. To offer reliable competitive rarity, license/obtain comparable audience counts for each media type, normalize duplicates, and review country/genre classifications. Do not mistake sparse metadata or zero rating counts for extreme obscurity.

## Full-scale film catalog import (official IMDb files)

A streaming bulk loader for official `title.basics.tsv.gz`, `title.ratings.tsv.gz`, and optional `title.akas.tsv.gz` now exists. It joins titles to real IMDb vote counts in disk-backed SQLite, excludes adult/short/TV records, imports all feature films (unless `--limit` is specified), and indexes alternate and Korean titles for autocomplete. It does not invent creator/country metadata.

**Rights:** IMDb's public downloadable datasets are for non-commercial use under their terms. You must verify that your specific use is permitted, or obtain a commercial license. `--acknowledge-imdb-terms` is an explicit operator acknowledgement, not a license grant. Do not use this importer to bypass licensing.

```bash
# Obtain these files from IMDb's official dataset download page if your use is permitted.
npm run import:imdb -- --basics /data/title.basics.tsv.gz --ratings /data/title.ratings.tsv.gz \
  --akas /data/title.akas.tsv.gz --db /data/catalog.sqlite --acknowledge-imdb-terms
npm run test:bulk
```

The public GitHub Pages preview cannot load this server-side SQLite database. To use imported titles in ranked play and server-side validation, deploy the Node server with `CATALOG_DB=/data/catalog.sqlite` and persistent storage. The existing solo frontend still uses the demo catalog and needs server-authoritative daily prompts before a full-catalog launch. Other media remain incomplete pending authorized imports.


## Full-catalog pipelines (October 2026)

**The GitHub repository does not contain or host these full datasets.** These are import pipelines to run on a disk-backed Node server or a data worker. Downloading large official dumps and storing millions of indexed works requires substantial disk space, time and server resources. The static GitHub Pages demo cannot query the SQLite catalog directly.

### MusicBrainz — all artists + album/EP release groups (CC0 core)

Download the **official** `mbdump.tar.bz2` snapshot from [MusicBrainz database downloads](https://musicbrainz.org/doc/MusicBrainz_Database/Download) and verify the published checksum. Unpack it, then:

```bash
npm run import:musicbrainz-core -- --dump-dir /data/mbdump --db /data/catalog.sqlite
```

This importer streams MusicBrainz's core TSV tables, joins artist credits, saves every artist (with aliases and country where verifiable) to `music_artists`, and indexes album/EP release groups with original release years and multilingual release-group aliases. It stages tables on disk; use `--limit 1000` for an initial test. The staging file is reused on reruns; for a clean reimport, delete the `.musicbrainz-stage.sqlite` staging file before restarting. Do not treat interrupted imports as fully resumable until checkpoints are implemented.

**Genre associations and popularity are NOT in the CC0 core.** The official `mbdump-derived.tar.bz2` supplementary snapshot is licensed **CC BY-NC-SA 3.0** and cannot be treated as unrestricted commercial game data. Only if you are complying with those terms (or have separate commercial permission), extract it and pass:

```bash
npm run import:musicbrainz-core -- --dump-dir /data/mbdump --derived-dir /data/mbdump-derived --allow-noncommercial --db /data/catalog.sqlite
```

Genre names are restricted to MusicBrainz's actual genre taxonomy; general user tags are not blindly treated as genres. Rating counts are included only when an authorized supplementary dump is present. If no such counts exist, the album is searchable but **not eligible for authoritative rarity scoring**. Countries are not inferred from artist names, language, or release territories. Release-group years come from actual release dates in the core dump.

### Anime — AniList GraphQL

```bash
npm run fetch:anilist -- --pages 1000 --out /data/anilist.jsonl
npm run import:catalog -- --source anilist --file /data/anilist.jsonl --db /data/catalog.sqlite
```

Pagination stops when the API has no next page. Includes English/Romaji/native names, synonyms, year, country of origin, studio, genres and number of submitted scores. Respect AniList API rules and retry/backoff. Korean aliases are retained when present; missing translations must be supplemented from an authorized multilingual source.

### Movies — TMDB API

Obtain a TMDB read token under its API terms. Then:

```bash
TMDB_READ_TOKEN=... npm run fetch:tmdb -- --from 1900 --to 2026 --out /data/tmdb.jsonl
npm run import:catalog -- --source tmdb --file /data/tmdb.jsonl --authorized --db /data/catalog.sqlite
```

Year-partitioned discovery includes genres, vote counts, English and Korean localized titles when supplied by TMDB. **Not guaranteed complete:** TMDB discovery caps pagination at 500 pages; any overfull year requires narrower date partitions. Film production countries and directors are not inferred from the discover results; enrich those via verified data. A TMDB account/API authorization is required and attribution rules apply.

### Video games — IGDB API

Obtain a Twitch/IGDB client ID and OAuth access token under their API terms. Then:

```bash
IGDB_CLIENT_ID=... IGDB_ACCESS_TOKEN=... npm run fetch:igdb -- --out /data/igdb.jsonl
npm run import:catalog -- --source igdb --file /data/igdb.jsonl --authorized --db /data/catalog.sqlite
```

ID-cursor pagination avoids the offset window, and stores genres, developers, original release year, alternate titles and vote counts when available. Do not invent developer country or missing rating counts. IGDB is not Backloggd, and no Backloggd proprietary data is scraped.

### Books, IMDb and multilingual Wikidata

Existing `import:books`, `import-imdb-dump.mjs` and `fetch:wikidata` scripts remain available. Use Open Library's monthly official dumps, properly licensed IMDb TSVs, and Wikidata's official bulk dumps for large-scale multilingual enrichment. Wikidata's public SPARQL endpoint is **not** suitable for harvesting its full database.

### Production checklist

- Keep canonical work IDs and cross-provider identity mapping (MusicBrainz MBIDs, IMDb IDs, AniList IDs, IGDB IDs, Open Library IDs and Wikidata QIDs). Current importer indexes each source separately; **cross-source deduplication is still pending**.
- Track popularity *basis* and source; a listener count, number of ratings, and number of library additions are not interchangeable.
- Build full-coverage prompt eligibility only where genre, year, country and valid rarity counts are actually known.
- Move indexed search and scoring to a persistent server; add account authentication and server-validated Elo before a competitive launch.
- Run `npm run test:catalog-pipelines` before large imports.

## Real full music catalog: official Discogs CC0 dumps

**The 136-item browser fixture is NOT the database.** To cover genuinely obscure releases,
run the complete official Discogs monthly **masters** and **releases** dumps on a
persistent backend. Discogs publishes four CC0 XML.GZ datasets (artists, labels,
masters, releases) at https://data.discogs.com/. These are multi-gigabyte
archives and should not be stored in GitHub or GitHub Pages.

The new `scripts/import-discogs-dump.py` converts the official XML incrementally
using Python's streaming parser. It keeps all masters and standalone releases
without a master, so different pressings of the same album do not become
independent game answers. It imports title, credited artists, year, Discogs
genres and detailed styles, and a source link. It **does not** treat the
release's country as the artist's origin or invent listener counts.

```bash
# Download the current OFFICIAL masters.xml.gz and releases.xml.gz
# from https://data.discogs.com/ (the exact date changes each month).
# Run these commands on a machine with plenty of disk space and Node 22.13+.
set -o pipefail
python3 scripts/import-discogs-dump.py --kind masters --file /data/discogs_masters.xml.gz \
  | node scripts/import-catalog.mjs --file - --source discogs --db /data/catalog.sqlite
python3 scripts/import-discogs-dump.py --kind releases --file /data/discogs_releases.xml.gz \
  | node scripts/import-catalog.mjs --file - --source discogs --db /data/catalog.sqlite
```

For every individual release edition, add `--include-mastered-releases`, but
avoid that for rarity-game canonical works because multiple editions duplicate
albums. Large imports can take hours and require substantial disk space.
The importer does not download the dumps or scrape Discogs pages.

**Important distinction:** Discogs bulk metadata has genres and styles but
no comparable listener/vote counts. Imported works with verified metadata but
no votes are recognized in the *solo* game and assigned a **provisional neutral
44 points**; this is NOT an actual obscurity rating. Ranked play requires
scorable data. For actual rarity, enrich with separately licensed audience
metrics, normalize source-by-source, and freeze daily score snapshots.

**Live deployment:** A `Dockerfile` and `railway.json` now support a Node
backend with persistent `/data` volume. Mount a persistent disk at `/data`
and import the datasets there. GitHub Pages only serves a small static demo;
it cannot hold the full catalog, run indexed SQL queries, or host live Elo.
Discogs artist and label XML dumps also exist; those should be indexed into
separate artist/label tables before offering artist/label-specific prompts.

## Loading full public Discogs snapshots on Render

**Current state:** The repo contains the import software, but deploying the web
service does not itself import the catalog. To populate the user's live database,
run the importer **inside Render's service Shell**, or from a Render job sharing
the same persistent disk. A GitHub Pages build cannot write to the Render disk.
The game should not claim comprehensive coverage until the status endpoint
reports the actual imported counts.

1. In Render > larper101 Web Service > Disks, confirm an actual **persistent disk**
   mounted at `/data`. A Docker `VOLUME` declaration alone is NOT a Render disk.
   Multiple millions of searchable records and their trigram indexes may need
   **tens of gigabytes or more**; 10 GB may not be enough. Back up the database.
2. In Render > Shell, confirm `node --version` is 22.13 or newer and
   `python3 --version` works.
3. Run this **once** to stream the official CC0 Discogs artists, masters and
   label data. No API key or temporary 11 GB compressed download is needed:

   ```sh
   python3 scripts/import-discogs-online.py --month 202610 --db /data/catalog.sqlite --kinds artists masters labels
   ```

4. With larger disk capacity, run the comprehensive individual-release import,
   including non-mastered obscure releases:

   ```sh
   python3 scripts/import-discogs-online.py --month 202610 --db /data/catalog.sqlite --kinds releases
   ```

   These are **large, long-running operations**; network or shell timeouts can
   interrupt them. They are idempotent but, when restarted, must still re-read
   the selected dump. Use the complete published month listed at
   https://data.discogs.com/ ; if the current month returns 404, use the last
   available month. The release dump can require many hours.

5. Check live counts:

   ```sh
   node -e "fetch('http://localhost:8787/api/catalog/status').then(r=>r.json()).then(console.log)"
   ```

   Or open `https://dotdotdot-7yot.onrender.com/api/catalog/status`.

A verified Discogs title *without* audience vote counts becomes a valid answer
with **neutral provisional credit**, not a fictitious 100-point rarity reward.
Discogs styles provide genre clues and release dates; the *release country* is
not necessarily the artist's country and is intentionally excluded. Full
cross-source merging, reliable audience popularity, artist origin enrichment
and stable ranked rarity still require separate pipelines and licensing.

**Full Open Library in one command:** With additional disk space, stream the
official latest WORKS dump directly into the same Render SQLite database
without manually downloading the gzip archive:

```sh
python3 scripts/import-openlibrary-online.py --db /data/catalog.sqlite
```

Books without known author/origin/readership data remain searchable but only
qualify for prompts whose factual conditions can be verified. All downloads are
from the official Open Library bulk-export endpoint.

**Other full catalogs:**
- MusicBrainz core (official CC0 dump, not optional noncommercial derived data):
  download/extract `mbdump.tar.bz2` from
  https://ftp.musicbrainz.org/pub/musicbrainz/data/fullexport/ ;
  run `node scripts/import-musicbrainz-core.mjs --dump-dir /data/mbdump --db /data/catalog.sqlite`.
  Ensure space for both raw data and the staging database.
- Open Library full books: download the official *works* dump from
  https://openlibrary.org/developers/dumps and use
  `node scripts/import-openlibrary-dump.mjs --file /data/ol_dump_works_YYYY-MM-DD.txt.gz --db /data/catalog.sqlite`.
- IMDb, TMDB, AniList, IGDB, RYM, Spotify, Last.fm, Backloggd,
  Letterboxd and MyAnimeList have distinct API/dataset rights, some requiring
  keys or approved access. The repo's existing import scripts are **not**
  evidence that complete catalogs from those services have been imported.

Do **not** launch all huge imports simultaneously on a small web service.
Prefer a separate import worker or scheduled job with enough disk and CPU;
keep real-time multiplayer running on its own instance for a production launch.


## Zero-cost GitHub Pages catalog shards (work in progress)

GitHub Pages cannot host a many-GB SQLite database, and GitHub repositories
have per-file and site bandwidth/size limits. The frontend now knows how to
fetch **only the needed title-prefix JSON shards** and accepts exact
matches from them, including bilingual aliases. Missing audience counts
earn a neutral provisional score, not artificial maximum obscurity points.

Once the source datasets have been downloaded and imported to SQLite **on a
sufficiently provisioned machine**, export prefix shards:

```sh
node scripts/build-static-catalog.mjs --db data/catalog.sqlite --out public/catalog-shards --shard-size 1200
```

Generated `manifest.json` describes every prefix, record count and file.
That command does **not** download Discogs/MusicBrainz, and it doesn't
automatically push multi-GB files to GitHub. The current game remains on the
limited sample catalog unless published shards are present. A complete
Discogs export may exceed GitHub Pages' 1 GB published site limit and
the ability of free hosted runners to build it. For larger catalogs,
separate public shard hosting, copyright/attribution review, and a
verified publishing workflow will be required.

The shards are indexed by the first two normalized title characters; they
include creator/title aliases from the database. Users typing `러브리스`
can also search aliases when present; transliteration suggestions are not
accepted as exact answers without verification.

Do not distribute proprietary RYM, Spotify or Bandcamp content or
noncommercial MusicBrainz supplementary tags/ratings without suitable rights.


## Build MusicBrainz catalog entirely inside GitHub Actions

Go to [Actions → Build music catalog in the cloud](https://github.com/eggseed1/dotdotdot/actions/workflows/build-music-catalog.yml)
and select **Run workflow**. No Oracle or PC downloads required.

For the **first run**, use `mode=sample`, `limit=500`,
`include_community_tags=false`, `deploy_pages=true`, and
`publish_release=false`. Set repository
**Settings → Secrets and variables → Actions → New repository secret**:
`CATALOG_CONTACT_EMAIL` = a working address identifying this MusicBrainz API
client. The sample builds ~500 real album entries, builds static search
shards and, when small enough, deploys them directly to GitHub Pages.

For experimental full database processing, use `mode=dump` and set
`limit` to the desired album count (`0` means unlimited).
This downloads official MusicBrainz core **onto the temporary GitHub runner**,
not your PC, then processes the supported album and EP tables. The full
snapshot + indexes can exhaust GitHub's free runner disk or time; there
is no guarantee that this mode completes. Start with a bounded count,
monitor Actions logs and free disk, and use an external bulk-processing
solution if the entire database is too large.

`include_community_tags=true` downloads the derived MusicBrainz snapshot
for community-voted genres and user rating counts; **only enable this for
noncommercial CC BY-NC-SA 3.0-compliant uses**, and retain required attribution
and share-alike terms. This is not RYM or AOTY data. ListenBrainz is
not yet integrated; do not describe its listener scores as available.

The default `deploy_pages=true` deploys only if the built site is below
900 MB; large archives are uploaded as short-lived GitHub Actions
artifacts instead. Optional `publish_release` stores a small compressed
catalog snapshot as a GitHub Release asset, **but current browser search
does not load Release archives directly**. Neither the sample nor a
bounded `dump` constitutes the entire MusicBrainz/Rym/AOTY catalog.
