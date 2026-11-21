import test from 'node:test';
import assert from 'node:assert/strict';
import { ONLINE_LAYERS, OFFLINE_URL, tileCoordinates, tileUrl } from '../src/components/map/mapProviders.js';

test('original V11 Google Roadmap, Satellite, and Terrain URLs are restored', () => {
  assert.deepEqual(Object.keys(ONLINE_LAYERS), ['default', 'satellite', 'terrain']);
  for (const [style, mode] of Object.entries({ default: 'm', satellite: 'y', terrain: 'p' })) {
    const layer = ONLINE_LAYERS[style];
    assert.equal(layer.url, `https://mt{s}.google.com/vt/lyrs=${mode}&x={x}&y={y}&z={z}`);
    assert.deepEqual(layer.options.subdomains, ['0', '1', '2', '3']);
    assert.match(layer.options.attribution, /Google Maps/);
  }
});

test('live online tile probes resolve subdomain and xyz, without a Google API key', () => {
  const actual = tileUrl(ONLINE_LAYERS.default.url, { z: 12, x: 3470, y: 1900 });
  assert.equal(actual, 'https://mt0.google.com/vt/lyrs=m&x=3470&y=1900&z=12');
  assert.ok(!actual.includes('{'));
  assert.ok(!actual.includes('key='));
});

test('offline tiles remain on the authenticated local API route', () => {
  assert.equal(tileUrl(OFFLINE_URL, { z: 12, x: 3470, y: 1900 }),
    '/api/maps/tiles/12/3470/1900.png');
});

test('online probes retain correct coordinates at the source native zoom', () => {
  const map = {
    getZoom: () => 15,
    getCenter: () => ({ lat: 8, lng: 125 }),
    project: (_, z) => ({ x: (z + 1) * 256 + 4, y: (z + 2) * 256 + 8 }),
  };
  const pos = tileCoordinates(map, ONLINE_LAYERS.satellite.options.maxNativeZoom);
  assert.deepEqual(pos, { z: 15, x: 16, y: 17 });
  assert.equal(tileUrl(ONLINE_LAYERS.satellite.url, pos),
    'https://mt0.google.com/vt/lyrs=y&x=16&y=17&z=15');
});
