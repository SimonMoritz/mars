const SITE_ORIGIN = 'https://framesfrommars.com';

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

		if (url.pathname === '/sitemap.xml') {
			return handleSitemap(env);
		}

		if (url.pathname.startsWith('/photo/')) {
			const id = decodeURIComponent(url.pathname.slice('/photo/'.length));
			return handlePhotoPage(id, request, env);
		}

		return env.ASSETS.fetch(request);
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

async function handlePhotoPage(id, request, env) {
	const photoRaw = await env.PHOTOS_KV.get(`photo:${id}`);
	if (!photoRaw) {
		return new Response('Photo not found', {
			status: 404,
			headers: { 'Content-Type': 'text/plain' },
		});
	}

	const photo = JSON.parse(photoRaw);
	const shellRequest = new Request(new URL('/', request.url), { method: 'GET' });
	const shell = await env.ASSETS.fetch(shellRequest);
	if (!shell.ok) {
		return shell;
	}

	const canonical = `${SITE_ORIGIN}/photo/${encodeURIComponent(id)}`;
	const imageAbsolute = photo.imageUrl?.startsWith('http')
		? photo.imageUrl
		: `${SITE_ORIGIN}${photo.imageUrl || ''}`;
	const cleanDescription = stripHtml(photo.description || '').trim();
	const metaDescription = truncate(
		cleanDescription || `Mars image "${photo.title}" from the NASA archive.`,
		300
	);
	const pageTitle = `${photo.title} — Frames From Mars`;
	const altText = photo.title
		? `${photo.title} — Mars image from the NASA archive`
		: 'Mars photograph from the NASA archive';

	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'ImageObject',
		name: photo.title,
		description: metaDescription,
		contentUrl: imageAbsolute,
		url: canonical,
		creator: { '@type': 'Organization', name: 'NASA' },
		creditText: photo.center ? `NASA / ${photo.center}` : 'NASA',
		copyrightNotice: 'Public domain — NASA',
		license: 'https://www.nasa.gov/multimedia/guidelines/index.html',
		identifier: photo.nasaId,
		datePublished: photo.date,
	};

	const rewriter = new HTMLRewriter()
		.on('title', setText(pageTitle))
		.on('link[rel="canonical"]', setAttr('href', canonical))
		.on('meta[name="description"]', setAttr('content', metaDescription))
		.on('meta[property="og:url"]', setAttr('content', canonical))
		.on('meta[property="og:title"]', setAttr('content', pageTitle))
		.on('meta[property="og:description"]', setAttr('content', metaDescription))
		.on('meta[property="og:image"]', setAttr('content', imageAbsolute))
		.on('meta[name="twitter:title"]', setAttr('content', pageTitle))
		.on('meta[name="twitter:description"]', setAttr('content', metaDescription))
		.on('meta[name="twitter:image"]', setAttr('content', imageAbsolute))
		.on('img#photo', {
			element(el) {
				el.setAttribute('src', photo.imageUrl || '');
				el.setAttribute('alt', altText);
			},
		})
		.on('head', {
			element(el) {
				el.append(
					`<script type="application/ld+json">${escapeJsonForScript(jsonLd)}</script>`,
					{ html: true }
				);
			},
		});

	const rewritten = rewriter.transform(shell);
	return new Response(rewritten.body, {
		status: 200,
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'public, max-age=300, s-maxage=86400',
		},
	});
}

function setAttr(attr, value) {
	return {
		element(el) {
			el.setAttribute(attr, value);
		},
	};
}

function setText(text) {
	return {
		element(el) {
			el.setInnerContent(text);
		},
	};
}

async function handleSitemap(env) {
	const indexRaw = await env.PHOTOS_KV.get('photos:index');
	const ids = indexRaw ? JSON.parse(indexRaw) : [];

	const urls = [
		`<url><loc>${SITE_ORIGIN}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
		...ids.map(
			(id) =>
				`<url><loc>${SITE_ORIGIN}/photo/${xmlEscape(encodeURIComponent(id))}</loc><changefreq>yearly</changefreq><priority>0.7</priority></url>`
		),
	];

	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600',
		},
	});
}

function stripHtml(html) {
	return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

function truncate(text, max) {
	if (text.length <= max) return text;
	return text.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

function xmlEscape(s) {
	return String(s).replace(/[<>&'"]/g, (c) => ({
		'<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
	}[c]));
}

function escapeJsonForScript(obj) {
	return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}
