export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname === '/api/photos') {
			return handlePhotosIndex(env);
		}

		if (url.pathname.startsWith('/api/photo/')) {
			const id = decodeURIComponent(url.pathname.slice('/api/photo/'.length));
			return handlePhoto(id, env);
		}

		if (url.pathname.startsWith('/img/')) {
			return handleImage(url.pathname.slice(5), env);
		}

		// Static assets are served automatically by the assets binding
	},
};

async function handlePhotosIndex(env) {
	const headers = {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': '*',
		'Cache-Control': 'public, max-age=300',
	};

	const indexRaw = await env.PHOTOS_KV.get('photos:index');
	if (!indexRaw) {
		return new Response(JSON.stringify({ error: 'No photos indexed' }), {
			status: 503,
			headers,
		});
	}

	return new Response(indexRaw, { headers });
}

async function handlePhoto(id, env) {
	const headers = {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': '*',
	};

	const photoRaw = await env.PHOTOS_KV.get(`photo:${id}`);
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
