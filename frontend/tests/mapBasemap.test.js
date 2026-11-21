import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ONLINE_TILES, OFFLINE_TILES, OSM_ATTRIBUTION,
  currentTileCoordinates, tileUrl, classifyTileResponse, probeTile,
} from '../src/components/map/mapBasemap.js';

const response = (status, type = 'image/png') => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Map([['content-type', type]]),
});

test('default roadmap uses a licensed no-key OSM URL with attribution', () => {
  assert.equal(ONLINE_TILES, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  assert.match(OSM_ATTRIBUTION, /openstreetmap.org\/copyright/);
  assert.equal(tileUrl(ONLINE_TILES, {z: 11, x: 1736, y: 955}), 'https://tile.openstreetmap.org/11/1736/955.png');
  assert.equal(tileUrl(OFFLINE_TILES, {z: 11, x: 1736, y: 955}), '/api/maps/tiles/11/1736/955.png');
});

test('map tiles preserve current Leaflet center and zoom', () => {
  const map = { getZoom: () => 11, getCenter: () => ({ lat: 7.9, lng: 125.3 }),
    project: () => ({ x: 513, y: 771 }) };
  assert.deepEqual(currentTileCoordinates(map), { z: 11, x: 2, y: 3 });
});

test('tile HTTP failures are distinguished from available imagery', () => {
  assert.deepEqual(classifyTileResponse(response(200)), { ok: true });
  assert.deepEqual(classifyTileResponse(response(404)), { ok: false, reason: 'missing' });
  assert.deepEqual(classifyTileResponse(response(403)), { ok: false, reason: 'access' });
  assert.deepEqual(classifyTileResponse(response(429)), { ok: false, reason: 'rate_limit' });
  assert.deepEqual(classifyTileResponse(response(502)), { ok: false, reason: 'provider' });
  assert.deepEqual(classifyTileResponse(response(200, 'application/json')), { ok: false, reason: 'provider' });
});

test('a local tile check uses same-origin authenticated requests', async () => {
  let options;
  const result = await probeTile('/api/maps/tiles/11/2/3.png', {
    offline: true,
    fetchImpl: async (_url, opts) => { options = opts; return response(200); },
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(options.credentials, 'same-origin');
  assert.equal(options.cache, 'default');
});

test('failed online requests never claim successful imagery', async () => {
  const result = await probeTile('https://tile.openstreetmap.org/0/0/0.png', {
    fetchImpl: async () => response(429),
  });
  assert.deepEqual(result, { ok: false, reason: 'rate_limit' });
});

test('cancelled tile probes do not trigger stale transitions', async () => {
  const controller = new AbortController();
  controller.abort();
  const result = await probeTile(ONLINE_TILES, { signal: controller.signal });
  assert.deepEqual(result, { ok: false, reason: 'aborted' });
});
