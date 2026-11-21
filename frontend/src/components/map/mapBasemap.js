// No-key interactive raster basemap, separate from the independently licensed offline pack.
// OSM tile policy: https://operations.osmfoundation.org/policies/tiles/
export const ONLINE_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OFFLINE_TILES = '/api/maps/tiles/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';
export const RECOVERY_INTERVAL_MS = 60_000;
export const PROVIDER_BACKOFF_MS = 5 * 60_000;

export function currentTileCoordinates(map) {
  const z = Math.round(map.getZoom());
  const point = map.project(map.getCenter(), z);
  return { z, x: Math.floor(point.x / 256), y: Math.floor(point.y / 256) };
}

export function tileUrl(template, { z, x, y }) {
  return template.replace('{z}', z).replace('{x}', x).replace('{y}', y);
}

export function classifyTileResponse(response) {
  if (response.ok && (response.headers.get('content-type') || '').startsWith('image/')) {
    return { ok: true };
  }
  if (response.status === 404) return { ok: false, reason: 'missing' };
  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: 'access' };
  }
  if (response.status === 429) return { ok: false, reason: 'rate_limit' };
  return { ok: false, reason: 'provider' };
}

// A one-tile availability check; no bulk downloads or cache-busting. The image
// fallback handles CDNs that render cross-origin images but deny fetch/CORS.
export async function probeTile(url, { offline = false, signal, fetchImpl = fetch, ImageCtor = typeof Image === 'undefined' ? null : Image } = {}) {
  if (signal?.aborted) return { ok: false, reason: 'aborted' };
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 10000);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      credentials: offline ? 'same-origin' : 'omit',
      cache: 'default',
    });
    return classifyTileResponse(response);
  } catch (error) {
    if (signal?.aborted) return { ok: false, reason: 'aborted' };
    if (offline || !ImageCtor || timedOut) return { ok: false, reason: timedOut ? 'timeout' : 'network' };
    return await new Promise((resolve) => {
      const img = new ImageCtor();
      let finished = false;
      const finish = (result) => {
        if (finished) return;
        finished = true;
        clearTimeout(imageTimer);
        signal?.removeEventListener('abort', imageAbort);
        img.onload = null;
        img.onerror = null;
        resolve(result);
      };
      const imageAbort = () => { img.src = ''; finish({ ok: false, reason: 'aborted' }); };
      const imageTimer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), 10000);
      signal?.addEventListener('abort', imageAbort, { once: true });
      if (signal?.aborted) imageAbort();
      else {
        img.onload = () => finish({ ok: true });
        img.onerror = () => finish({ ok: false, reason: 'network' });
        img.src = url;
      }
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
