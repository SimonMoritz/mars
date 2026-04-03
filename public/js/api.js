const IMAGE_API = 'https://images-api.nasa.gov';

const SEARCH_QUERIES = [
  'mars rover',
  'perseverance mars',
  'curiosity rover mars',
  'mars surface',
  'artemis',
  'mars landscape',
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pickRandomQuery() {
  return SEARCH_QUERIES[randomInt(0, SEARCH_QUERIES.length - 1)];
}

export async function fetchRandomPhoto(query) {
  // Randomize the page to get different results each time
  const page = randomInt(1, 5);
  const url = `${IMAGE_API}/search?q=${encodeURIComponent(query)}&media_type=image&page=${page}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`NASA API responded with HTTP ${res.status}`);

  const data = await res.json();
  const items = data.collection?.items ?? [];

  if (items.length === 0) return null;

  const item = items[randomInt(0, items.length - 1)];
  const meta = item.data[0];

  // Prefer original, fall back to small, then preview (thumb)
  let imageUrl = null;
  if (item.links) {
    const orig = item.links.find(l => l.rel === 'canonical');
    const small = item.links.find(l => l.rel === 'alternate');
    const thumb = item.links.find(l => l.rel === 'preview');
    imageUrl = (orig ?? small ?? thumb)?.href ?? null;
  }

  if (!imageUrl) return null;

  return {
    title: meta.title,
    description: meta.description,
    date: meta.date_created?.split('T')[0] ?? 'Unknown',
    center: meta.center ?? 'NASA',
    nasaId: meta.nasa_id,
    imageUrl,
    query,
  };
}
