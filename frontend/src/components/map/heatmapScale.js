/**
 * Leaflet uses EPSG:3857 Web Mercator. A fixed distance on the ground
 * occupies more CSS pixels as the user zooms in. This makes the KDE
 * footprint independent of the chosen zoom level.
 *
 * Formula: metres per CSS pixel = cos(latitude) * earth circumference /
 * (256 * 2^zoom). Clamp latitude to the Web Mercator projection limits.
 */
const EARTH_RADIUS_METERS = 6378137;
const WEB_MERCATOR_LATITUDE_LIMIT = 85.05112878;

export function metersPerPixel(latitude, zoom) {
  const safeLatitude = Math.max(-WEB_MERCATOR_LATITUDE_LIMIT,
    Math.min(WEB_MERCATOR_LATITUDE_LIMIT, latitude));
  return Math.cos(safeLatitude * Math.PI / 180)
    * 2 * Math.PI * EARTH_RADIUS_METERS / (256 * (2 ** zoom));
}

export function geographicRadiusPixels(radiusMeters, latitude, zoom) {
  return radiusMeters / metersPerPixel(latitude, zoom);
}

export function kernelIntersectsViewport(x, y, radiusPixels, width, height) {
  return x + radiusPixels >= 0 && x - radiusPixels <= width
    && y + radiusPixels >= 0 && y - radiusPixels <= height;
}
