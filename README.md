# DEEP CUT / 꺼드럭대마왕

**A tiny pixel-art culture-snob trivia game.** Name the most obscure valid work you know. Seven prompts, twenty-five seconds per round, up to 700 points.

- **Music Only**: albums filtered by genres, decades, years, and artist countries, inspired by the idea of Rate Your Music's catalog metadata.
- **All Media**: two music prompts, two film prompts, one literature prompt, one anime prompt, and one video game prompt (Backloggd-inspired game categories).
- **English / 한국어**: change the language instantly; Korean title is **꺼드럭대마왕**.
- Illustrated pixel mascot, vinyl sprite, retro-lilac UI; responsive desktop and mobile layout.
- Daily seeded question selection, 25-second timer, album/work matching including Korean titles and alternate spellings, rarity-scored reveals, result sharing, and local session persistence.

## Run locally

Install Node.js 20.19+ or 22.12+ and run:

```bash
npm install
npm run dev
```

Navigate to the address printed by Vite. To create a static production bundle, run `npm run build`.

Run the engine tests with `npm test`.

## IMPORTANT: prototype limitations

**This is a playable vertical slice with a small hand-curated sample catalog.** It does **not** contain the complete Rate Your Music, Backloggd, Letterboxd, IMDb, Goodreads, or AniList databases, and it does not scrape them. `src/data/catalog.ts` contains explicitly illustrative popularity weights, **not real rating or audience counts**. A work absent from the sample catalog will be rejected even if the answer is correct in the real world. The prototype labels this limitation in the interface.

Daily attempts and results are tracked in browser localStorage. That is not tamper-resistant; production leaderboards must validate attempts, clocks, and scores on the server.

## Roadmap: production metadata

- Establish authorized metadata access and a canonical item-ID system for all five media; do not scrape websites contrary to their terms or bypass anti-bot access controls.
- Music: licensed/authorized music metadata, including primary genres and countries (RYM-style). MusicBrainz can supply some baseline metadata, subject to its data and tag licenses.
- Film: license-compatible movie metadata with country and year.
- Literature: licensed book/author metadata with original publication year and origin country.
- Anime: licensed anime metadata with format, production country, year, and genres.
- Games: licensed video game metadata with developer country, initial release year, and genres (Backloggd-style discovery).
- Add proper aliases, transliterations, Korean localized titles, collision-resolution UI, and review/admin tools for disputed answers.
- Move scoring, timed attempts, saved scores, and daily question packs to a real server with a database and monitoring.
- Use distribution-based rarity scoring with a verifiability floor instead of manually assigned demo weights.

## Tech stack

Vite + React 19 + TypeScript + CSS, with custom CSS/grid pixel sprites. No images are scraped or hotlinked from outside sites.