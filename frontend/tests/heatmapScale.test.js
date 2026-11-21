import test from 'node:test';
import assert from 'node:assert/strict';
import { geographicRadiusPixels, metersPerPixel, kernelIntersectsViewport }
  from '../src/components/map/heatmapScale.js';

test('one geographic KDE radius covers the same ground distance at every zoom', () => {
  const latitude = 7.9; // San Fernando, Bukidnon
  const bandwidthMeters = 4000;
  const lowZoom = geographicRadiusPixels(bandwidthMeters, latitude, 11);
  const highZoom = geographicRadiusPixels(bandwidthMeters, latitude, 14);

  assert.ok(lowZoom > 0);
  assert.ok(Math.abs(highZoom / lowZoom - 8) < 1e-10);
  assert.ok(Math.abs(lowZoom * metersPerPixel(latitude, 11) - bandwidthMeters) < 1e-8);
  assert.ok(Math.abs(highZoom * metersPerPixel(latitude, 14) - bandwidthMeters) < 1e-8);
});

test('incident location intensity radius depends on bandwidth, not viewport size', () => {
  const latitude = 7.9;
  assert.ok(geographicRadiusPixels(6000, latitude, 13)
    > geographicRadiusPixels(2500, latitude, 13));
  assert.equal(geographicRadiusPixels(4000, latitude, 12),
    geographicRadiusPixels(4000, latitude, 12));
});

test('kernel coverage includes incidents just outside the visible map', () => {
  assert.equal(kernelIntersectsViewport(-20, 100, 40, 800, 600), true);
  assert.equal(kernelIntersectsViewport(-60, 100, 40, 800, 600), false);
  assert.equal(kernelIntersectsViewport(850, 200, 60, 800, 600), true);
});
