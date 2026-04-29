export async function fetchPhotoIndex() {
  const res = await fetch('/api/photos');
  if (!res.ok) throw new Error(`API responded with HTTP ${res.status}`);
  return res.json();
}

export async function fetchPhoto(id) {
  const res = await fetch(`/api/photo/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`API responded with HTTP ${res.status}`);
  return res.json();
}
