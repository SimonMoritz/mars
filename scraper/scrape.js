import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const IMAGE_API = 'https://images-api.nasa.gov';

const SEARCH_QUERIES = [
    'mars landscape',
    // 'mars surface',
];

const PAGE_SIZE = 100;

async function fetchPage(url, page) {
    const res = await fetch(url + `&page=${page}`);
    if (!res.ok) throw new Error(`NASA API responded with HTTP ${res.status} on page ${page}`);
    return res.json();
}

async function fetchAllItems(query) {
    const url = `${IMAGE_API}/search?q=${encodeURIComponent(query)}&media_type=image`;

    const firstPage = await fetchPage(url, 1);
    const totalHits = firstPage.collection?.metadata?.total_hits ?? 0;
    const totalPages = Math.ceil(totalHits / PAGE_SIZE);

    console.log(`  "${query}": ${totalHits} hits across ${totalPages} pages`);

    // Fetch remaining pages (batch 5 at a time to be polite)
    const items = [...(firstPage.collection?.items ?? [])];

    for (let i = 2; i <= totalPages; i += 5) {
        const batch = [];
        for (let j = i; j < i + 5 && j <= totalPages; j++) {
            batch.push(j);
        }
        const pages = await Promise.all(batch.map(p => fetchPage(url, p)));
        for (const page of pages) {
            items.push(...(page.collection?.items ?? []));
        }
    }

    return items;
}

function parseItem(item, query) {
    const meta = item.data?.[0];
    if (!meta?.nasa_id) return null;

    // Get the best image URL from links
    let imageUrl = null;
    if (item.links) {
        const orig = item.links.find(l => l.rel === 'canonical');
        const preview = item.links.find(l => l.rel === 'preview');
        imageUrl = (orig ?? preview)?.href ?? null;
    }
    if (!imageUrl) return null;

    return {
        nasaId: meta.nasa_id,
        title: meta.title ?? 'Untitled',
        description: meta.description ?? '',
        date: meta.date_created?.split('T')[0] ?? 'Unknown',
        center: meta.center ?? 'NASA',
        imageUrl,
        query,
    };
}

async function main() {
    console.log('Scraping NASA Images API...\n');

    const allPhotos = [];
    const seenIds = new Set();

    for (const query of SEARCH_QUERIES) {
        const items = await fetchAllItems(query);

        for (const item of items) {
            const photo = parseItem(item, query);
            if (photo && !seenIds.has(photo.nasaId)) {
                seenIds.add(photo.nasaId);
                allPhotos.push(photo);
            }
        }
    }

    console.log(`\nTotal unique photos: ${allPhotos.length}`);

    const outputPath = join(__dirname, 'output.json');
    writeFileSync(outputPath, JSON.stringify(allPhotos, null, 2));
    console.log(`Written to ${outputPath}`);
}

main().catch(err => {
    console.error('Scraper failed:', err);
    process.exit(1);
});
