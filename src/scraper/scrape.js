const IMAGE_API = 'https://images-api.nasa.gov';


const SEARCH_QUERIES = [
    'mars landscape',
    'mars surface',
];

const PAGE_SIZE = 100;

async function fetchPhotos(query) {
    const url = `${IMAGE_API}/search?q=${encodeURIComponent(query)}&media_type=image`;
    const res = await fetch(url + `&page=1`);
    if (!res.ok) throw new Error(`NASA API responded with HTTP ${res.status}`);
    const data = await res.json();

    const no_items = data.collection?.metadata?.total_hits ?? 0;
    const pages = Math.ceil(no_items / PAGE_SIZE);
    const pagesList = Array.from({ length: pages - 1 }, (_, i) => i + 2);
    const secondaryPages = await Promise.all(
        pagesList.map(i => fetch(url + `&page=${i}`).then(res => {
            if (!res.ok) throw new Error(`NASA API responded with HTTP ${res.status}`);
            return res.json();
        }))
    );
    const items = [
        ...(data.collection?.items ?? []),
        ...secondaryPages.flatMap(d => d.collection?.items ?? [])
    ]

    return items
}

let items = await fetchPhotos('mars landscape');
