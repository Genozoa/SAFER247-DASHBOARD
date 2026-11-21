// Public browser-facing tile services. Never bulk-download these for offline storage.
// The licensed offline XYZ pack is served separately by FastAPI.
const satelliteDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

export const ONLINE_LAYERS = {
  default: {
    name: 'Default',
    description: 'OpenStreetMap roadmap with local streets and places',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 18,
      maxNativeZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    },
  },
  satellite: {
    name: 'Satellite',
    description: 'NASA MODIS true-colour satellite overview. Lower resolution than street-level imagery.',
    url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${satelliteDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    options: {
      maxZoom: 18,
      maxNativeZoom: 9,
      attribution: 'Imagery &copy; <a href="https://www.earthdata.nasa.gov/data/instruments/modis">NASA EOSDIS / MODIS Terra</a>',
    },
  },
  terrain: {
    name: 'Terrain',
    description: 'OpenTopoMap-R contours and terrain features',
    url: 'https://tile.openmaps.fr/opentopomap/{z}/{x}/{y}.png',
    options: {
      maxZoom: 18,
      maxNativeZoom: 17,
      attribution: '<a href="https://github.com/sletuffe/OpenTopoMap">&copy; OpenTopoMap-R</a> <a href="https://openmaps.fr/donate">Support tile hosting</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
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

export function tileUrl(template, { z, x, y }) {
  return template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}
