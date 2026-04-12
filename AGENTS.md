# Mars Transmission

A fullscreen Mars photo viewer backed by Cloudflare Workers, R2, and KV.

## Architecture

- **worker/** — Cloudflare Worker that serves the static frontend and a `/api/random` endpoint. Images are served from R2 via `/img/*`, metadata is read from KV.
- **scraper/** — Local Node.js scripts. `scrape.js` fetches image metadata from the NASA Images API and outputs `output.json`. `upload.js` downloads images to R2 and pushes metadata to KV. Config (bucket name, KV namespace ID) is read from `worker/wrangler.jsonc`.
- **scratch/** — One-off exploration scripts, not part of the app.

## Key details

- Frontend is vanilla HTML/CSS/JS (no framework, no bundler). Files live in `worker/public/`.
- The worker entry point is `worker/src/index.js`. Static assets are served by Cloudflare's asset binding; only `/api/random` and `/img/*` are handled by the worker code.
- KV schema: `photos:index` holds a JSON array of all NASA IDs. `photo:{nasaId}` holds metadata for each photo. Image URLs in KV point to `/img/{filename}` which the worker proxies from R2.
- R2 bucket: `mars-images`. Objects are keyed by `{nasaId}.{ext}`.
- The scraper search queries are configured in `scraper/scrape.js` (`SEARCH_QUERIES` array).

## Commands

```bash
node scraper/scrape.js          # Scrape NASA metadata -> scraper/output.json
node scraper/upload.js          # Upload images to R2, metadata to KV
cd worker && npx wrangler dev --remote   # Local dev against remote KV/R2
cd worker && npx wrangler deploy         # Deploy
```
