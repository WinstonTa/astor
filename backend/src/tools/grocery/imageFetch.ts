// Grocery Runner — resolves a generic stock photo per grocery item. Walmart,
// Costco, and Whole Foods have no public product-image API, so item photos
// come from free, keyless public image search instead: Openverse first, then
// Wikimedia Commons as a fallback. A generated placeholder guarantees a card
// is never left with a broken <img> even if both sources fail or time out.
const FETCH_TIMEOUT_MS = 6_000;

async function fetchJsonWithTimeout(url: string): Promise<any | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AstorGroceryRunner/1.0 (grocery report images)' },
    });
    if (!res.ok) return undefined;
    return await res.json();
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

async function tryOpenverse(query: string): Promise<string | undefined> {
  const data = await fetchJsonWithTimeout(
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=1&mature=false`,
  );
  const hit = data?.results?.[0];
  return hit?.thumbnail || hit?.url || undefined;
}

async function tryWikimedia(query: string): Promise<string | undefined> {
  const data = await fetchJsonWithTimeout(
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&` +
      `gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=600&format=json&origin=*`,
  );
  const pages = data?.query?.pages;
  if (!pages) return undefined;
  const first: any = Object.values(pages)[0];
  return first?.imageinfo?.[0]?.thumburl || first?.imageinfo?.[0]?.url || undefined;
}

/** Deterministic soft-gradient SVG card with the item's initial — never a broken image. */
function placeholderFor(query: string): string {
  const trimmed = query.trim();
  const initial = (trimmed[0] ?? '?').toUpperCase();
  let hash = 7;
  for (const ch of trimmed) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  const hue = Math.abs(hash);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="hsl(${hue},45%,32%)"/>` +
    `<stop offset="100%" stop-color="hsl(${(hue + 40) % 360},45%,18%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="400" height="300" fill="url(#g)"/>` +
    `<text x="200" y="175" font-family="Georgia, serif" font-size="96" fill="rgba(255,255,255,0.85)" text-anchor="middle">${initial}</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export async function resolveItemImage(query: string): Promise<string> {
  const openverse = await tryOpenverse(query).catch(() => undefined);
  if (openverse) return openverse;
  const wikimedia = await tryWikimedia(query).catch(() => undefined);
  if (wikimedia) return wikimedia;
  return placeholderFor(query);
}
