export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname === '/api/random') {
			return handleRandom(env);
		}

		if (url.pathname.startsWith('/img/')) {
			return handleImage(url.pathname.slice(5), env);
		}

		// Static assets are served automatically by the assets binding
	},
};

async function handleRandom(env) {
	const headers = {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': '*',
	};

	const indexRaw = await env.PHOTOS_KV.get('photos:index');
	if (!indexRaw) {
		return new Response(JSON.stringify({ error: 'No photos indexed' }), {
			status: 503,
			headers,
		});
	}

	const ids = JSON.parse(indexRaw);
	const randomId = ids[Math.floor(Math.random() * ids.length)];

	const photoRaw = await env.PHOTOS_KV.get(`photo:${randomId}`);
	if (!photoRaw) {
		return new Response(JSON.stringify({ error: 'Photo not found' }), {
			status: 404,
			headers,
		});
	}

	return new Response(photoRaw, { headers });
}

async function handleImage(key, env) {
	const object = await env.MARS_IMAGES.get(key);
	if (!object) {
		return new Response('Image not found', { status: 404 });
	}

	return new Response(object.body, {
		headers: {
			'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
			'Cache-Control': 'public, max-age=31536000, immutable',
		},
	});
}
