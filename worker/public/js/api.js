export async function fetchRandomPhoto() {
  const res = await fetch('/api/random');
  if (!res.ok) throw new Error(`API responded with HTTP ${res.status}`);
  return res.json();
}
