import test from 'node:test';
import assert from 'node:assert/strict';
import { ONLINE_LAYERS, OFFLINE_URL, tileCoordinates, tileUrl } from '../src/components/map/mapProviders.js';

test('V11 map styles use documented keyless services with attribution', () => {
  assert.deepEqual(Object.keys(ONLINE_LAYERS), ['default', 'satellite', 'terrain']);
  for (const layer of Object.values(ONLINE_LAYERS)) {
    assert.match(layer.url, /^https:\/\//);
    assert.ok(layer.options.attribution.length > 10);
    assert.doesNotMatch(layer.url, /mt[0-9]*\.google\.com|tile\.googleapis\.com|key=/);
  }
  assert.equal(ONLINE_LAYERS.default.url, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
});

test('offline tiles remain a local authenticated API URL', () => {
  assert.equal(tileUrl(OFFLINE_URL, { z: 12, x: 3470, y: 1900 }),
    '/api/maps/tiles/12/3470/1900.png');
});

test('online probes use source native zoom and correct x/y order', () => {
  const map = {
    getZoom: () => 15,
    getCenter: () => ({ lat: 8, lng: 125 }),
    project: (_, z) => ({ x: (z + 1) * 256 + 4, y: (z + 2) * 256 + 8 }),
  };
  const pos = tileCoordinates(map, ONLINE_LAYERS.satellite.options.maxNativeZoom);
  assert.deepEqual(pos, { z: 9, x: 10, y: 11 });
  assert.match(tileUrl(ONLINE_LAYERS.satellite.url, pos), /\/9\/11\/10\.jpg$/);
});
