import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_DIR = join(__dirname, '..', 'worker');

// Read config from wrangler.jsonc
const wranglerConfig = JSON.parse(
    readFileSync(join(WORKER_DIR, 'wrangler.jsonc'), 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '')
);
const R2_BUCKET = wranglerConfig.r2_buckets[0].bucket_name;
const KV_NAMESPACE_ID = wranglerConfig.kv_namespaces[0].id;

const IMAGES_DIR = join(__dirname, 'images');
const CONCURRENCY = 5;

async function downloadImage(photo) {
    const ext = photo.imageUrl.split('.').pop().split('?')[0] || 'jpg';
    const filename = `${photo.nasaId}.${ext}`;
    const filepath = join(IMAGES_DIR, filename);

    if (existsSync(filepath)) {
        return { filename, filepath, cached: true };
    }

    const res = await fetch(photo.imageUrl);
    if (!res.ok) {
        console.error(`  Failed to download ${photo.nasaId}: HTTP ${res.status}`);
        return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(filepath, buffer);
    return { filename, filepath, cached: false };
}

async function uploadToR2(filepath, filename) {
    try {
        execSync(
            `npx wrangler r2 object put "${R2_BUCKET}/${filename}" --file="${filepath}" --content-type="image/jpeg" --remote`,
            { cwd: WORKER_DIR, stdio: 'pipe' }
        );
        return true;
    } catch (err) {
        console.error(`  R2 upload failed for ${filename}: ${err.message}`);
        return false;
    }
}

async function processBatch(photos, startIdx) {
    const results = [];
    for (const photo of photos) {
        const dl = await downloadImage(photo);
        if (!dl) {
            results.push(null);
            continue;
        }

        const uploaded = await uploadToR2(dl.filepath, dl.filename);
        if (!uploaded) {
            results.push(null);
            continue;
        }

        const status = dl.cached ? 'cached' : 'downloaded';
        results.push({ ...photo, r2Key: dl.filename, status });
    }
    return results;
}

async function uploadKVBulk(entries) {
    // wrangler kv bulk put accepts a JSON file with [{key, value}] entries
    const bulkFile = join(__dirname, 'kv-bulk.json');
    const BATCH_SIZE = 1000; // wrangler bulk put limit is 10k but let's be safe

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        const kvData = batch.map(e => ({
            key: e.key,
            value: JSON.stringify(e.value),
        }));

        writeFileSync(bulkFile, JSON.stringify(kvData));
        console.log(`  Uploading KV batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} keys)...`);

        execSync(
            `npx wrangler kv bulk put "${bulkFile}" --namespace-id="${KV_NAMESPACE_ID}" --remote`,
            { cwd: WORKER_DIR, stdio: 'pipe' }
        );
    }
}

async function main() {
    const photos = JSON.parse(readFileSync(join(__dirname, 'output.json'), 'utf-8'));
    console.log(`Uploading ${photos.length} photos to R2 and KV...\n`);

    mkdirSync(IMAGES_DIR, { recursive: true });

    // Track progress
    const progressFile = join(__dirname, 'upload-progress.json');
    let completed = new Set();
    if (existsSync(progressFile)) {
        completed = new Set(JSON.parse(readFileSync(progressFile, 'utf-8')));
        console.log(`Resuming: ${completed.size} already uploaded\n`);
    }

    const remaining = photos.filter(p => !completed.has(p.nasaId));
    const kvEntries = [];
    const successIds = [...completed];

    // Process in batches
    for (let i = 0; i < remaining.length; i += CONCURRENCY) {
        const batch = remaining.slice(i, i + CONCURRENCY);
        const results = await processBatch(batch, i);

        for (const r of results) {
            if (r) {
                const ext = r.r2Key.split('.').pop();
                kvEntries.push({
                    key: `photo:${r.nasaId}`,
                    value: {
                        nasaId: r.nasaId,
                        title: r.title,
                        description: r.description,
                        date: r.date,
                        center: r.center,
                        imageUrl: `/img/${r.r2Key}`,
                        query: r.query,
                    },
                });
                successIds.push(r.nasaId);
                completed.add(r.nasaId);
            }
        }

        const total = completed.size;
        const pct = ((total / photos.length) * 100).toFixed(1);
        console.log(`[${total}/${photos.length}] ${pct}% — batch done`);

        // Save progress periodically
        if (total % 50 === 0 || i + CONCURRENCY >= remaining.length) {
            writeFileSync(progressFile, JSON.stringify(successIds));
        }
    }

    // Upload metadata to KV
    if (kvEntries.length > 0) {
        console.log(`\nUploading ${kvEntries.length} metadata entries to KV...`);
        await uploadKVBulk(kvEntries);
    }

    // Upload the index
    console.log(`\nUploading photos:index (${successIds.length} IDs)...`);
    const indexFile = join(__dirname, 'kv-index.json');
    writeFileSync(indexFile, JSON.stringify([{ key: 'photos:index', value: JSON.stringify(successIds) }]));
    execSync(
        `npx wrangler kv bulk put "${indexFile}" --namespace-id="${KV_NAMESPACE_ID}" --remote`,
        { cwd: WORKER_DIR, stdio: 'pipe' }
    );

    console.log('\nDone!');
}

main().catch(err => {
    console.error('Upload failed:', err);
    process.exit(1);
});
