// V11's original direct Google tile URLs. These interfaces are undocumented
// and Google does not authorize this method for Maps Platform integrations.
// The local offline fallback remains independent and requires licensed tiles.
export const ONLINE_LAYERS = {
  default: {
    name: 'Default',
    description: 'Google Maps Roadmap with roads and natural topography',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    options: {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20,
      maxNativeZoom: 20,
      attribution: '&copy; Google Maps',
    },
  },
  satellite: {
    name: 'Satellite',
    description: 'Google Maps Satellite with roads and place labels',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    options: {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20,
      maxNativeZoom: 20,
      attribution: '&copy; Google Maps Imagery',
    },
  },
  terrain: {
    name: 'Terrain',
    description: 'Google Maps topography and hillshading',
    url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    options: {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20,
      maxNativeZoom: 20,
      attribution: '&copy; Google Maps Terrain',
    },
  },
};

export const OFFLINE_URL = '/api/maps/tiles/{z}/{x}/{y}.png';
export const OFFLINE_OPTIONS = { maxZoom: 18, maxNativeZoom: 18, attribution: 'Locally licensed offline tiles' };

export function tileCoordinates(map, maxNativeZoom = 18) {
  const z = Math.min(Math.round(map.getZoom()), maxNativeZoom);
  const pixel = map.project(map.getCenter(), z);
  return { z, x: Math.floor(pixel.x / 256), y: Math.floor(pixel.y / 256) };
}

// Leaflet substitutes {s} on its own. Probes use subdomain 0 explicitly.
export function tileUrl(template, { z, x, y }) {
  return template.replace('{s}', '0')
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}
