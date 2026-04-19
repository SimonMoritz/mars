# Mars Transmission

A fullscreen Mars photo viewer backed by Cloudflare Workers, R2, and KV.

## Architecture

- **worker/** — Cloudflare Worker that serves the static frontend and a `/api/random` endpoint. Images are served from R2 via `/img/*`, metadata is read from KV.
- **scraper/** — Local Node.js scripts. `scrape.js` fetches image metadata from the NASA Images API and outputs `output.json`. `review.js` serves a local HTTP UI on port 8787 for human-eval of each photo; it downloads images lazily into `scraper/images/`, deletes rejected files, and writes kept photos to `output.reviewed.json`. `upload.js` reads `output.reviewed.json`, uploads images to R2, and pushes metadata to KV. Config (bucket name, KV namespace ID) is read from `worker/wrangler.jsonc`.
- **scratch/** — One-off exploration scripts, not part of the app.

## Key details

- Frontend is vanilla HTML/CSS/JS (no framework, no bundler). Files live in `worker/public/`.
- The worker entry point is `worker/src/index.js`. Static assets are served by Cloudflare's asset binding; only `/api/random` and `/img/*` are handled by the worker code.
- KV schema: `photos:index` holds a JSON array of all NASA IDs. `photo:{nasaId}` holds metadata for each photo. Image URLs in KV point to `/img/{filename}` which the worker proxies from R2.
- R2 bucket: `mars-images`. Objects are keyed by `{nasaId}.{ext}`.
- The scraper search queries are configured in `scraper/scrape.js` (`SEARCH_QUERIES` array).
- Scraper artifacts are generated state, not source: `scraper/output.json`, `scraper/output.reviewed.json`, `scraper/review-progress.json`, `scraper/images/`, `scraper/upload-progress.json`, `scraper/kv-bulk.json`, and `scraper/kv-index.json` are ignored by git.
- `scraper/review.js` persists decisions incrementally to `scraper/review-progress.json` so a review can be resumed. Delete that file to start over. The review step is a one-shot gate before first upload — re-reviewing already-uploaded photos will not remove them from R2/KV.
- `scraper/upload.js` reads the first `r2_buckets[0]` and `kv_namespaces[0]` entries from `worker/wrangler.jsonc`; keep that in mind before reordering bindings.
- `worker/public/js/ui.js` expects photo metadata fields named `title`, `query`, `center`, `date`, `nasaId`, and `imageUrl`. If the scraper metadata shape changes, update the UI and `/api/random` contract together.
- `upload.js` currently writes `imageUrl` as `/img/{r2Key}`, and the worker maps that path to R2 with `handleImage(url.pathname.slice(5), env)`. Preserve that path contract unless changing scraper, Worker, and frontend together.
- `upload.js` hardcodes R2 uploads with `--content-type="image/jpeg"` even though filenames can keep other extensions such as `.tif`; fix MIME detection there before expanding beyond JPEG-style assets.
- `worker/src/index.js` returns `undefined` for non-API routes so Cloudflare's asset binding serves `worker/public/`. Avoid adding a catch-all `Response` unless static asset fallback is handled explicitly.
- `CLAUDE.md` delegates to this file, so keep durable agent/project guidance here.

## Development notes

- There is no bundler, framework, linter, or test script. Keep browser code as plain ES modules under `worker/public/js/`.
- Prefer small, direct changes over adding dependencies. The deployed surface is one Worker plus static assets.
- When changing the frontend, preserve the fullscreen image-first experience: `index.html` contains the structure, `styles.css` controls the presentation, `ui.js` owns DOM updates, `api.js` owns fetch calls, and `main.js` owns interaction flow.
- Loading a new photo is intentionally serialized with the `isLoading` guard in `worker/public/js/main.js`; keep click and Space-key behavior consistent if changing navigation.
- `node scraper/scrape.js`, `node scraper/review.js`, and `node scraper/upload.js` touch external services and generated files. Run them only when the task calls for changing the dataset or validating scraper/review/upload behavior.
- `cd worker && npx wrangler dev --remote` is the practical local verification path because `/api/random` depends on remote KV/R2 data.
- Use `cd worker && npx wrangler deploy` for deployment. The npm scripts exist (`npm run dev`, `npm run deploy`) but they do not include `--remote`.

## Commands

```bash
node scraper/scrape.js          # Scrape NASA metadata -> scraper/output.json
node scraper/review.js          # Human-eval UI on http://localhost:8787 -> scraper/output.reviewed.json
node scraper/upload.js          # Upload reviewed images to R2, metadata to KV
cd worker && npx wrangler dev --remote   # Local dev against remote KV/R2
cd worker && npx wrangler deploy         # Deploy
```
