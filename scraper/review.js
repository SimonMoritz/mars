import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, createReadStream, statSync } from 'fs';
import { createServer } from 'http';
import { join, extname } from 'path';

const __dirname = import.meta.dirname;

const PORT = 8787;
const IMAGES_DIR = join(__dirname, 'images');
const REVIEW_DIR = join(__dirname, 'review');
const OUTPUT_FILE = join(__dirname, 'output.json');
const PROGRESS_FILE = join(__dirname, 'review-progress.json');
const REVIEWED_FILE = join(__dirname, 'output.reviewed.json');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
};

function filenameFor(photo) {
    const ext = photo.imageUrl.split('.').pop().split('?')[0] || 'jpg';
    return `${photo.nasaId}.${ext}`;
}

async function ensureDownloaded(photo) {
    const filename = filenameFor(photo);
    const filepath = join(IMAGES_DIR, filename);
    if (existsSync(filepath)) return filename;

    const res = await fetch(photo.imageUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${photo.imageUrl}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(filepath, buffer);
    return filename;
}

function shuffle(arr) {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function loadState(photos) {
    if (existsSync(PROGRESS_FILE)) {
        return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
    }
    const state = {
        order: shuffle(photos.map(p => p.nasaId)),
        decisions: {},
        history: [],
    };
    writeFileSync(PROGRESS_FILE, JSON.stringify(state, null, 2));
    return state;
}

function saveState(state) {
    writeFileSync(PROGRESS_FILE, JSON.stringify(state, null, 2));
}

function counts(state) {
    let kept = 0;
    let rejected = 0;
    for (const v of Object.values(state.decisions)) {
        if (v === 'keep') kept++;
        else if (v === 'reject') rejected++;
    }
    return {
        total: state.order.length,
        reviewed: Object.keys(state.decisions).length,
        kept,
        rejected,
    };
}

function nextUndecided(state) {
    return state.order.find(id => !(id in state.decisions)) ?? null;
}

function sendJson(res, status, body) {
    const json = JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(json),
    });
    res.end(json);
}

function sendFile(res, filepath) {
    if (!existsSync(filepath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
    }
    const ext = extname(filepath).toLowerCase();
    const size = statSync(filepath).size;
    res.writeHead(200, {
        'Content-Type': MIME[ext] ?? 'application/octet-stream',
        'Content-Length': size,
        'Cache-Control': 'no-store',
    });
    createReadStream(filepath).pipe(res);
}

async function readBody(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf-8');
    return raw ? JSON.parse(raw) : {};
}

function deleteImage(photo) {
    const filepath = join(IMAGES_DIR, filenameFor(photo));
    if (existsSync(filepath)) unlinkSync(filepath);
}

function writeReviewed(photos, state) {
    const kept = photos.filter(p => state.decisions[p.nasaId] === 'keep');
    writeFileSync(REVIEWED_FILE, JSON.stringify(kept, null, 2));
    return kept.length;
}

async function main() {
    if (!existsSync(OUTPUT_FILE)) {
        console.error(`Missing ${OUTPUT_FILE}. Run "node scraper/scrape.js" first.`);
        process.exit(1);
    }

    mkdirSync(IMAGES_DIR, { recursive: true });

    const photos = JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8'));
    const photoById = new Map(photos.map(p => [p.nasaId, p]));
    const state = loadState(photos);

    // If output.json has new ids not in order, append them shuffled at the end.
    const inOrder = new Set(state.order);
    const newIds = photos.map(p => p.nasaId).filter(id => !inOrder.has(id));
    if (newIds.length > 0) {
        state.order.push(...shuffle(newIds));
        saveState(state);
        console.log(`Added ${newIds.length} new photo(s) to review queue.`);
    }

    const server = createServer(async (req, res) => {
        try {
            const url = new URL(req.url, `http://localhost:${PORT}`);
            const path = url.pathname;

            if (req.method === 'GET' && path === '/') {
                return sendFile(res, join(REVIEW_DIR, 'index.html'));
            }
            if (req.method === 'GET' && path === '/review.js') {
                return sendFile(res, join(REVIEW_DIR, 'review.js'));
            }
            if (req.method === 'GET' && path === '/styles.css') {
                return sendFile(res, join(REVIEW_DIR, 'styles.css'));
            }
            if (req.method === 'GET' && path.startsWith('/img/')) {
                const name = decodeURIComponent(path.slice(5));
                if (name.includes('/') || name.includes('..')) {
                    res.writeHead(400); return res.end('Bad path');
                }
                return sendFile(res, join(IMAGES_DIR, name));
            }

            if (req.method === 'GET' && path === '/api/status') {
                return sendJson(res, 200, counts(state));
            }

            if (req.method === 'GET' && path === '/api/next') {
                const id = nextUndecided(state);
                if (!id) return sendJson(res, 200, { done: true, ...counts(state) });
                const photo = photoById.get(id);
                if (!photo) {
                    // Orphaned id — skip by marking reject without file delete.
                    state.decisions[id] = 'reject';
                    saveState(state);
                    return sendJson(res, 200, { done: false, stale: true });
                }
                try {
                    const filename = await ensureDownloaded(photo);
                    return sendJson(res, 200, {
                        done: false,
                        photo,
                        filename,
                        ...counts(state),
                    });
                } catch (err) {
                    return sendJson(res, 502, { error: `Download failed: ${err.message}`, nasaId: id });
                }
            }

            if (req.method === 'POST' && path === '/api/decide') {
                const body = await readBody(req);
                const { nasaId, keep } = body;
                const photo = photoById.get(nasaId);
                if (!photo) return sendJson(res, 404, { error: 'Unknown nasaId' });
                const decision = keep ? 'keep' : 'reject';
                state.decisions[nasaId] = decision;
                state.history.push(nasaId);
                if (decision === 'reject') deleteImage(photo);
                saveState(state);
                return sendJson(res, 200, counts(state));
            }

            if (req.method === 'POST' && path === '/api/undo') {
                const lastId = state.history.pop();
                if (!lastId) return sendJson(res, 200, { undone: null, ...counts(state) });
                delete state.decisions[lastId];
                saveState(state);
                return sendJson(res, 200, { undone: lastId, ...counts(state) });
            }

            if (req.method === 'POST' && path === '/api/finalize') {
                const kept = writeReviewed(photos, state);
                return sendJson(res, 200, { written: REVIEWED_FILE, kept, ...counts(state) });
            }

            res.writeHead(404);
            res.end('Not found');
        } catch (err) {
            console.error('Request error:', err);
            if (!res.headersSent) res.writeHead(500);
            res.end('Internal error');
        }
    });

    server.listen(PORT, () => {
        const c = counts(state);
        console.log(`Review server: http://localhost:${PORT}`);
        console.log(`  ${c.reviewed}/${c.total} reviewed (${c.kept} kept, ${c.rejected} rejected)`);
        console.log('Press Ctrl+C to stop.');
    });
}

main().catch(err => {
    console.error('Review server failed:', err);
    process.exit(1);
});
