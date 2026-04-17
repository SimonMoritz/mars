# Mars Transmission

A fullscreen viewer for NASA's Mars photography archive. Each click delivers a random high-resolution image from the collection with metadata overlay.

**Live:** https://mars-transmission.simon-moritz.workers.dev/

## How it works

Images and metadata are pre-scraped from the [NASA Images API](https://images.nasa.gov/) and stored on Cloudflare — images in R2, metadata in KV. A Cloudflare Worker serves the static frontend and a `/api/random` endpoint that picks a photo from KV and serves the image from R2. No NASA API calls at runtime.

## Structure

```
worker/          Cloudflare Worker (frontend + API)
scraper/         Local tooling to fetch and upload NASA data
scratch/         API exploration scripts
```

## Development

```bash
# Scrape NASA image metadata
node scraper/scrape.js

# Review photos at http://localhost:8787 (→/K keep, ←/R reject, U undo)
# Click Finalize when done to write scraper/output.reviewed.json
node scraper/review.js

# Upload reviewed images to R2 and metadata to KV
node scraper/upload.js

# Run locally
cd worker && npx wrangler dev --remote

# Deploy
cd worker && npx wrangler deploy
```
