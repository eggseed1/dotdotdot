# DEEP CUT / 꺼드럭대마왕

A pixel-art rarity trivia game where **rare answers send a tiny red devil further down into hell**. The English title is **DEEP CUT**; switch to Korean to play **꺼드럭대마왕**.

Play 7 rounds, 25 seconds each. Score up to 700 points (7,000 meters of hell). Discover new infernal layers as you descend. Original pixel-style visuals are based on two reference images supplied by the project owner and bundled locally in `src/data/art.ts`.

## Game modes

| Mode | What's included |
|---|---|
| **Music Only** | Album prompts using genres, decades, original release years, and artist countries. |
| **All Media** | Music (2), film (2), literature (1), anime (1), and games (1). |
| **Private 1v1** | Create a six-character invite and share it with a friend. |
| **Ranked 1v1 (guest beta)** | Matchmaking within the chosen mode, persistent guest Elo, placement games. |

### Hell dive, PvP rules

- **10 meters per point**. The devil and background descend through six named layers of hell; a route meter tracks progress toward the 7,000m abyss.
- PvP players receive **the same seven prompts**, 25 seconds each, with live *answer locked* indicators. Answers aren't revealed to the opponent until the round ends.
- Valid answers earn 10/20/40/65/85/100 points by tier, according to a **curated demo popularity proxy**, **not** real RYM, Backloggd, or user-submission counts.
- **Jinx:** identical correct answers in a round halve both players' points for that round.
- Live room codes, queue matchmaking, reconnect via stable guest browser ID, and Elo updates (provisional; 10 placement matches with a larger rating adjustment).
- Server validates all PvP answers, timing, and scoring. Guest identity and Elo aren't secure authentication, so this is a **beta**, not cheat-proof ranked play.

## Run locally

Use Node.js 22+. Install and build:

```bash
npm install
npm run build
npm start
```

Open **http://localhost:8787**. Run a second browser or incognito window to test a private match or ranked queue against yourself. Note: a guest ID persists in the browser; for two players use separate profiles/containers.

For frontend-only live editing, run two terminals:

```bash
npm run dev       # Vite frontend, usually http://localhost:5173
npm run server    # Multiplayer backend, http://localhost:8787
```

In Vite development, the browser connects to `ws://localhost:8787/ws`. On a Node-hosted production app it connects to `wss://YOUR_DOMAIN/ws` automatically. Set `VITE_DUEL_URL` when building to override the WebSocket URL.

Run rules tests:

```bash
npm run test:duel  # built-in Node tests for jinx, timeouts and Elo
npm test           # also runs Vitest catalog/prompt tests
```

## Hosting

**Important:** GitHub Pages can show the static frontend and daily mode, **but cannot run live 1v1**. Host the project as a **Node web service** (Railway, Render, Fly.io, or a server), with `npm install && npm run build` during deployment and `npm start` to serve both the built UI and WebSocket endpoint on the same domain. Set `PORT` to the host's port and optionally `DATA_DIR=/data` on a persistent disk to retain guest ratings. Without an online backend the 1v1 lobby clearly shows an offline warning; it doesn't pretend to have live opponents.

The GitHub Pages workflow remains useful for a static daily-only preview; in that environment live 1v1 buttons remain unavailable until a public WebSocket server is configured via `VITE_DUEL_URL` at build time.

## Prototype data limitations

**This build contains a small, manually curated catalog** in `src/data/catalog.ts`. It does **not** scrape, mirror, or provide official access to Rate Your Music, Backloggd, Letterboxd, Goodreads or AniList. Many legitimate answers outside the sample catalog are currently rejected. Popularity weights are hand-curated *illustrations*, not actual rating counts, and therefore are not suitable for a serious ranked competition yet.

To launch real competitive play, obtain data from authorized or appropriately licensed catalogs, add source attribution and aliases, store the verified work registry on the server, freeze rarity tiers per match, implement secure accounts and anti-cheat measures, add fair player reports, persistent match histories and rate-limits. Avoid bypassing restrictions on third-party catalog sites.

## Stack

React 19, TypeScript, Vite, CSS pixel effects, WebSockets (`ws`), Node server, local JSON guest Elo storage. The reference [Krillion Ranked](https://github.com/RazorTigerKid/krillion-ranked) inspired the PvP **mechanics**, but the game UI, code and branding here are original.