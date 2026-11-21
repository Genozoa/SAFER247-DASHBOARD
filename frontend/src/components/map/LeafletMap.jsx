import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import {
  Map as MapIcon,
  Satellite,
  Mountain,
  LocateFixed,
  Maximize2,
  Eye,
  Radio,
  Compass,
  Check,
  Building2,
  AlertCircle,
} from 'lucide-react';
import {
  SAN_FERNANDO_POBLACION,
  SAN_FERNANDO_MUNICIPAL_BORDER,
  BARANGAY_CENTROIDS,
  SAN_FERNANDO_MAP_BOUNDS,
} from '../../data/sanFernandoBoundary';
import { SAN_FERNANDO_BARANGAYS } from '../../data/referenceData';
import sanFernandoBarangaysGeoJson from './san-fernando-barangays.geojson';
import { createKdeHeatmapLayer } from './KdeHeatmapLayer';
import { getIncidentHeatmapPoints } from '../../utils/incidentData';

// The key and Google session tokens stay exclusively on the FastAPI server.
// Google tiles are never part of the separate, licensed local offline tile pack.
const GOOGLE_STYLES = {
  roadmap: { name: 'Roadmap', icon: MapIcon },
  satellite: { name: 'Satellite', icon: Satellite },
  terrain: { name: 'Terrain', icon: Mountain },
};
const GOOGLE_TILE_URL = (style) => `/api/maps/google/${style}/tiles/{z}/{x}/{y}`;
const OFFLINE_TILE_URL = '/api/maps/tiles/{z}/{x}/{y}.png';
const TILE_OPTIONS = { maxZoom: 18, maxNativeZoom: 18 };
const ONLINE_PROBE_MS = 45000;
const PROVIDER_RETRY_MS = 5 * 60 * 1000;

const escapeMapLabel = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

export default function LeafletMap({
  mode = 'Markers',
  incidents = [],
  officers = [],
  selectedIncident = null,
  selectedOfficer = null,
  selectedBarangay = 'All Barangays',
  onSelectIncident,
  onSelectOfficer,
  onSelectBarangay,
  showBreadcrumbs = true,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const baseTileLayerRef = useRef(null);

  // Layer groups for clean management
  const incidentsLayerRef = useRef(null);
  const officersMarkersLayerRef = useRef(null);
  const officersTrailsLayerRef = useRef(null);
  const kdeHeatLayerRef = useRef(null);
  const municipalBorderGroupRef = useRef(null);
  const barangaysLayerRef = useRef(null);
  const municipalPolygonRef = useRef(null);
  const skipNextFlyToRef = useRef(false);

  // Style choice is independent of the currently active tile source.
  const [mapType, setMapType] = useState('roadmap');
  const [showMunicipalBorder, setShowMunicipalBorder] = useState(true);
  const [showBarangayPolygons, setShowBarangayPolygons] = useState(true);
  const [kdeRadius, setKdeRadius] = useState(36);
  const [isMapReady, setIsMapReady] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(11);
  const [allowedMinZoom, setAllowedMinZoom] = useState(10);
  const [basemapStatus, setBasemapStatus] = useState(null);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [tileSource, setTileSource] = useState('google');
  const [googleAttribution, setGoogleAttribution] = useState('');
  const mapStyleRef = useRef('roadmap');
  const sourceRef = useRef('google');
  const revisionRef = useRef(0);
  const retryAfterRef = useRef(0);
  const handledFailureRevisionRef = useRef(-1);
  const fallbackHandlerRef = useRef(null);
  const unmountedRef = useRef(false);
  const isBasemapUnavailable = basemapStatus?.kind === 'unavailable';

  const currentTile = useCallback((map) => {
    const z = Math.round(map.getZoom());
    const point = map.project(map.getCenter(), z);
    return `${z}/${Math.floor(point.x / 256)}/${Math.floor(point.y / 256)}`;
  }, []);

  const tileProbe = useCallback(async (url, signal) => {
    // Distinguish a successful image response from missing tiles, HTTP denial,
    // expired provider quota, and real network failures.
    try {
      const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', signal });
      if (response.ok && (response.headers.get('content-type') || '').startsWith('image/')) {
        return { ok: true };
      }
      const reason = await response.json().then((data) => data?.detail?.reason).catch(() => null);
      return { ok: false, reason: reason || (response.status === 404 ? 'missing' : 'provider') };
    } catch (error) {
      return { ok: false, reason: error?.name === 'AbortError' ? 'aborted' : 'network' };
    }
  }, []);

  // Only a successful image response counts as a usable offline tile.
  const offlineAvailable = useCallback(async (map, signal) => (
    (await tileProbe(`/api/maps/tiles/${currentTile(map)}.png`, signal)).ok
  ), [tileProbe, currentTile]);

  const createBaseTileLayer = useCallback((source, style, map, revision) => {
    const url = source === 'google' ? GOOGLE_TILE_URL(style) : OFFLINE_TILE_URL;
    const layer = L.tileLayer(url, {
      ...TILE_OPTIONS,
      attribution: source === 'google' ? 'Google Maps' : 'Locally licensed offline tiles',
    });
    let loaded = 0;
    let errors = 0;
    layer.on('tileload', () => {
      loaded += 1;
      if (revision !== revisionRef.current || source !== sourceRef.current) return;
      setBasemapStatus(null);
      setNoticeDismissed(false);
    });
    layer.on('tileerror', () => { errors += 1; });
    layer.on('load', () => {
      if (revision !== revisionRef.current || source !== sourceRef.current) return;
      // A failed entire tile batch is stronger evidence than navigator.onLine.
      if (errors > 0 && loaded === 0) {
        if (handledFailureRevisionRef.current !== revision) {
          handledFailureRevisionRef.current = revision;
          fallbackHandlerRef.current?.(source, revision);
        }
      } else if (errors > 0) {
        setBasemapStatus({
          kind: 'partial', message: source === 'google'
            ? 'Some Google map tiles are unavailable for this view.'
            : 'Some local offline tiles are missing at this zoom.',
        });
        setNoticeDismissed(false);
      }
      loaded = 0;
      errors = 0;
    });
    layer.addTo(map);
    return layer;
  }, []);

  const replaceBaseLayer = useCallback((source, style) => {
    const map = mapInstanceRef.current;
    if (!map || unmountedRef.current) return;
    const revision = ++revisionRef.current;
    handledFailureRevisionRef.current = -1;
    if (baseTileLayerRef.current) map.removeLayer(baseTileLayerRef.current);
    sourceRef.current = source;
    setTileSource(source);
    setBasemapStatus(null);
    setNoticeDismissed(false);
    if (source === 'offline') setGoogleAttribution('');
    baseTileLayerRef.current = createBaseTileLayer(source, style, map, revision);
  }, [createBaseTileLayer]);

  // A manual style change never selects the offline source. If the active map
  // is offline, remember the style until real Google imagery becomes available.
  const switchMapType = useCallback((style) => {
    if (!GOOGLE_STYLES[style]) return;
    mapStyleRef.current = style;
    setMapType(style);
    retryAfterRef.current = 0;
    if (sourceRef.current === 'google') {
      replaceBaseLayer('google', style);
    }
  }, [replaceBaseLayer]);

  const describeFailure = useCallback((reason, offline) => {
    const labels = {
      authorization: 'Google Maps API authorization failed. Check the API key and restrictions.',
      quota: 'Google Maps API quota or request limit reached.',
      configuration: 'Google Map Tiles API is not configured on the server.',
      timeout: 'The Google tile service timed out.',
      network: 'Google tiles could not be reached.',
      provider_request: 'Google rejected the tile request.',
      provider: 'Google Maps imagery is temporarily unavailable.',
    };
    const cause = labels[reason] || labels.provider;
    return offline
      ? `${cause} Using available local offline tiles.`
      : `${cause} No local tile pack covers this view; boundaries and operational overlays remain visible.`;
  }, []);

  const enterFallback = useCallback(async (revision) => {
    const map = mapInstanceRef.current;
    if (!map || revision !== revisionRef.current || unmountedRef.current) return;
    const available = await offlineAvailable(map);
    if (revision !== revisionRef.current || unmountedRef.current) return;
    if (available) {
      replaceBaseLayer('offline', mapStyleRef.current);
      setBasemapStatus({
        kind: 'partial',
        message: 'Google map tiles are unavailable. Using locally stored offline map tiles.',
      });
    } else {
      setBasemapStatus({
        kind: 'unavailable',
        message: 'Online basemap unavailable and no local tiles cover this view. Municipal and barangay boundaries remain visible.',
      });
    }
    setNoticeDismissed(false);
  }, [offlineAvailable, replaceBaseLayer]);

  fallbackHandlerRef.current = (source, revision) => {
    if (source === 'google') {
      const map = mapInstanceRef.current;
      if (!map) return;
      // Probe once for a precise error reason. No retries inside tile callbacks.
      void (async () => {
        const state = await tileProbe(
          `/api/maps/google/${mapStyleRef.current}/tiles/${currentTile(map)}`
        );
        if (revision !== revisionRef.current || unmountedRef.current) return;
        if (['authorization', 'quota', 'configuration'].includes(state.reason)) {
          retryAfterRef.current = Date.now() + PROVIDER_RETRY_MS;
        }
        const available = await offlineAvailable(map);
        if (revision !== revisionRef.current || unmountedRef.current) return;
        if (available) {
          replaceBaseLayer('offline', mapStyleRef.current);
          setBasemapStatus({ kind: 'partial', message: describeFailure(state.reason, true) });
        } else {
          setBasemapStatus({ kind: 'unavailable', message: describeFailure(state.reason, false) });
        }
        setNoticeDismissed(false);
      })();
    } else {
      setBasemapStatus({
        kind: 'unavailable',
        message: 'Local offline tiles are missing for this view. Operational overlays remain visible.',
      });
      setNoticeDismissed(false);
    }
  };

  // Offline recovery uses actual authenticated Google tile responses, not
  // navigator.onLine alone. Failed checks occur at most once per interval.
  useEffect(() => {
    if (!isMapReady) return undefined;
    let stopped = false;
    let checking = false;
    const controller = new AbortController();
    const probe = async () => {
      const map = mapInstanceRef.current;
      const needsRecovery = sourceRef.current === 'offline' ||
        (sourceRef.current === 'google' && basemapStatus?.kind === 'unavailable');
      if (checking || !map || !needsRecovery || Date.now() < retryAfterRef.current) return;
      checking = true;
      const style = mapStyleRef.current;
      const source = sourceRef.current;
      const result = await tileProbe(
        `/api/maps/google/${style}/tiles/${currentTile(map)}`,
        controller.signal
      );
      checking = false;
      if (stopped || unmountedRef.current || sourceRef.current !== source ||
          style !== mapStyleRef.current) return;
      if (result.ok) {
        replaceBaseLayer('google', style);
      } else if (['authorization', 'quota', 'configuration'].includes(result.reason)) {
        retryAfterRef.current = Date.now() + PROVIDER_RETRY_MS;
      }
    };
    const interval = window.setInterval(() => { void probe(); }, ONLINE_PROBE_MS);
    const onOnline = () => { void probe(); };
    window.addEventListener('online', onOnline);
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener('online', onOnline);
    };
  }, [isMapReady, basemapStatus?.kind, tileProbe, currentTile, replaceBaseLayer]);

  // Google requires viewport-dependent copyright text in addition to brand
  // attribution; update it when the map moves or changes styles.
  useEffect(() => {
    if (!isMapReady || tileSource !== 'google') return undefined;
    const map = mapInstanceRef.current;
    if (!map) return undefined;
    let controller = null;
    const updateCopyright = () => {
      if (controller) controller.abort();
      controller = new AbortController();
      const bounds = map.getBounds();
      const search = new URLSearchParams({
        zoom: String(Math.round(map.getZoom())),
        north: String(bounds.getNorth()), south: String(bounds.getSouth()),
        east: String(bounds.getEast()), west: String(bounds.getWest()),
      });
      fetch(`/api/maps/google/${mapType}/copyright?${search.toString()}`, {
        cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
      }).then((response) => {
        if (!response.ok) throw new Error('Attribution unavailable');
        return response.json();
      }).then((data) => {
        if (data.copyright) setGoogleAttribution(data.copyright);
      }).catch((error) => {
        if (error.name !== 'AbortError') setGoogleAttribution('Map data attribution temporarily unavailable');
      });
    };
    setGoogleAttribution('Map data attribution loading');
    updateCopyright();
    map.on('moveend', updateCopyright);
    return () => {
      controller?.abort();
      map.off('moveend', updateCopyright);
    };
  }, [isMapReady, mapType, tileSource]);

  // Exact Bounding Box of SAN_FERNANDO_MUNICIPAL_BORDER
  const municipalBorderBounds = useMemo(() => {
    return L.latLngBounds(SAN_FERNANDO_MUNICIPAL_BORDER);
  }, []);

  // Dynamically calculate and enforce minZoom so the maximum zoom-out is the closest view
  // that still shows the entire San Fernando municipal border with 12–20px (target: 16px) padding.
  const updateDynamicMinZoom = useCallback((map) => {
    if (!map) return;
    const container = map.getContainer();
    if (!container || container.clientWidth === 0 || container.clientHeight === 0) return;

    // Use SAN_FERNANDO_MUNICIPAL_BORDER bounds directly (not the larger buffer)
    const bounds = L.latLngBounds(SAN_FERNANDO_MUNICIPAL_BORDER);
    // 16px padding gives 12-20px space between the border bounding box and map edges
    const fittedZoom = map.getBoundsZoom(bounds, false, [16, 16]);

    if (Number.isFinite(fittedZoom) && fittedZoom > 0) {
      map.setMinZoom(fittedZoom);
      setAllowedMinZoom(fittedZoom);

      // If current zoom is less than minZoom (e.g., after resize), fit to bounds
      if (map.getZoom() < fittedZoom) {
        map.fitBounds(bounds, { padding: [16, 16], animate: false });
      }
    }
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Compute initial center and bounds from SAN_FERNANDO_MUNICIPAL_BORDER
    const borderBounds = L.latLngBounds(SAN_FERNANDO_MUNICIPAL_BORDER);
    const borderCenter = borderBounds.getCenter();

    // Create Map instance centered on San Fernando, Bukidnon (encompassing all 24 barangays)
    const map = L.map(mapContainerRef.current, {
      center: borderCenter,
      zoom: 11,
      minZoom: 9, // Will be dynamically refined based on container size and SAN_FERNANDO_MUNICIPAL_BORDER
      maxZoom: 18,
      maxBounds: borderBounds.pad(0.35), // Bound panning around San Fernando municipal territory
      maxBoundsViscosity: 0.85,
      zoomControl: false, // Custom zoom buttons
    });

    // Start with the selected Google style; offline mode is automatic only.
    unmountedRef.current = false;
    sourceRef.current = 'google';
    const baseLayer = createBaseTileLayer('google', mapStyleRef.current, map, ++revisionRef.current);
    baseTileLayerRef.current = baseLayer;

    // Initialize Layer Groups in proper z-order
    municipalBorderGroupRef.current = L.layerGroup().addTo(map);
    barangaysLayerRef.current = L.layerGroup().addTo(map);
    officersTrailsLayerRef.current = L.layerGroup().addTo(map);
    incidentsLayerRef.current = L.layerGroup().addTo(map);
    officersMarkersLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    window.leafletMapInstance = map;

    // Initial calculation of dynamic min zoom and fit
    updateDynamicMinZoom(map);
    map.fitBounds(borderBounds, { padding: [16, 16], animate: false });
    setCurrentZoom(map.getZoom());
    setIsMapReady(true);

    // Track zoom level changes for UI controls state
    const handleZoomEnd = () => {
      setCurrentZoom(map.getZoom());
    };
    map.on('zoomend', handleZoomEnd);

    // Recalculate dynamic minimum zoom when the map container resizes
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        updateDynamicMinZoom(mapInstanceRef.current);
      }
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }
    const initialTimer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        updateDynamicMinZoom(mapInstanceRef.current);
      }
    }, 120);

    return () => {
      unmountedRef.current = true;
      revisionRef.current += 1;
      clearTimeout(initialTimer);
      resizeObserver.disconnect();
      map.off('zoomend', handleZoomEnd);
      window.leafletMapInstance = null;
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [updateDynamicMinZoom, createBaseTileLayer]);

  // Base layer switching and connectivity recovery are handled above.

  // Fit Entire San Fernando Lungsod (enclosing all 24 barangays)
  // Closest view with 12–20px space between the municipal border bounding box and map edges
  const fitEntireLungsod = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const bounds = L.latLngBounds(SAN_FERNANDO_MUNICIPAL_BORDER);
    map.fitBounds(bounds, {
      padding: [16, 16],
      animate: true,
      duration: 0.6,
    });
  }, []);

  // Recenter to Halapitan Poblacion (Municipal Hall / EOC)
  const recenterToHalapitan = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo(SAN_FERNANDO_POBLACION, 14, { duration: 0.8 });
  }, []);

  // Zoom handlers
  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };
  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  // Render Official Google Maps San Fernando Lungsod Boundary
  useEffect(() => {
    if (!isMapReady || !municipalBorderGroupRef.current) return;
    const group = municipalBorderGroupRef.current;
    group.clearLayers();

    if (!showMunicipalBorder) return;

    // Google Maps Lungsod Border: Red and white alternating dashed outline
    // 1. Underlay white solid line (sharp contrast)
    // When offline, fill the municipal landmass with a clear fallback background
    const whiteUnderlay = L.polygon(SAN_FERNANDO_MUNICIPAL_BORDER, {
      color: '#ffffff',
      weight: 5,
      opacity: 0.95,
      fillColor: isBasemapUnavailable ? '#ffffff' : '#ea4335',
      fillOpacity: isBasemapUnavailable ? 0.92 : 0.035,
      interactive: false,
    });
    group.addLayer(whiteUnderlay);

    // 2. Overlay red dashed line (standard administrative boundary)
    const redOverlay = L.polygon(SAN_FERNANDO_MUNICIPAL_BORDER, {
      color: '#ea4335',
      weight: 4,
      opacity: 1,
      dashArray: '8, 8',
      fill: false,
      interactive: true,
    });
    redOverlay.bindTooltip(
      `<div style="font-size: 11px; line-height: 1.4;">
        <strong style="color: #dc2626;">San Fernando Lungsod (Official Boundary)</strong><br/>
        <span style="color: #475569;">Province of Bukidnon • Encloses all 24 Barangays</span>
      </div>`,
      { sticky: true, className: 'bgy-tooltip' }
    );
    group.addLayer(redOverlay);

    municipalPolygonRef.current = redOverlay;
  }, [isMapReady, showMunicipalBorder, isBasemapUnavailable]);

  // Render 24 Barangay Boundaries from san-fernando-barangays.geojson
  // Clicking the area of the barangay highlights only its border in blue
  useEffect(() => {
    if (!isMapReady || !barangaysLayerRef.current) return;
    const layer = barangaysLayerRef.current;
    layer.clearLayers();

    if (!showBarangayPolygons) return;

    const geoJsonLayer = L.geoJSON(sanFernandoBarangaysGeoJson, {
      style: (feature) => {
        const rawName = feature?.properties?.adm4_en || feature?.properties?.name || '';
        const matchedName =
          SAN_FERNANDO_BARANGAYS.find((b) => b.toLowerCase() === rawName.toLowerCase()) || rawName;
        const isSelected = Boolean(
          selectedBarangay &&
            selectedBarangay !== 'All Barangays' &&
            selectedBarangay.toLowerCase() === matchedName.toLowerCase()
        );

        return {
          color: isSelected ? '#1d4ed8' : '#64748b',
          weight: isSelected ? 3.5 : 1.5,
          dashArray: isSelected ? undefined : '3, 4',
          opacity: isSelected ? 1 : 0.65,
          fill: true, // Transparent fill so entire interior area is clickable
          fillColor: '#1d4ed8',
          fillOpacity: 0.001, // Completely transparent (only the border is visibly highlighted in blue)
          className: 'barangay-polygon',
        };
      },
      onEachFeature: (feature, polygon) => {
        const rawName = feature?.properties?.adm4_en || feature?.properties?.name || 'Barangay';
        const matchedName =
          SAN_FERNANDO_BARANGAYS.find((b) => b.toLowerCase() === rawName.toLowerCase()) || rawName;
        const psgc = feature?.properties?.adm4_psgc;
        const area = feature?.properties?.area_km2;

        const isSelected = Boolean(
          selectedBarangay &&
            selectedBarangay !== 'All Barangays' &&
            selectedBarangay.toLowerCase() === matchedName.toLowerCase()
        );

        if (isSelected) {
          polygon.bringToFront();
        }

        polygon.bindTooltip(
          `<div style="font-size: 11px; line-height: 1.4; padding: 2px 4px;">
            <strong style="color: #0369a1; font-weight: 700;">Brgy. ${matchedName}</strong><br/>
            <span style="color: #64748b;">San Fernando, Bukidnon</span>
            ${psgc ? `<br/><span style="color: #94a3b8; font-size: 10px;">PSGC: ${psgc}${area ? ` • Area: ${area} km²` : ''}</span>` : ''}
          </div>`,
          { sticky: true, className: 'bgy-tooltip' }
        );

        polygon.on('mouseover', function () {
          const currentIsSelected = Boolean(
            selectedBarangay &&
              selectedBarangay !== 'All Barangays' &&
              selectedBarangay.toLowerCase() === matchedName.toLowerCase()
          );
          if (!currentIsSelected) {
            this.setStyle({
              color: '#3b82f6',
              weight: 2,
              opacity: 0.9,
            });
          }
        });

        polygon.on('mouseout', function () {
          const currentIsSelected = Boolean(
            selectedBarangay &&
              selectedBarangay !== 'All Barangays' &&
              selectedBarangay.toLowerCase() === matchedName.toLowerCase()
          );
          if (!currentIsSelected) {
            this.setStyle({
              color: '#64748b',
              weight: 1.5,
              opacity: 0.65,
            });
          }
        });

        // Clicking the area toggles/selects the barangay with only the blue border highlighted
        polygon.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (onSelectBarangay) {
            const isAlreadySelected = Boolean(
              selectedBarangay &&
                selectedBarangay !== 'All Barangays' &&
                selectedBarangay.toLowerCase() === matchedName.toLowerCase()
            );
            skipNextFlyToRef.current = true;
            onSelectBarangay(isAlreadySelected ? 'All Barangays' : matchedName);
          }
        });
      },
    });

    layer.addLayer(geoJsonLayer);
  }, [isMapReady, showBarangayPolygons, selectedBarangay, onSelectBarangay]);

  // Click on base map deselects the highlighted barangay
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady) return;

    const handleMapClick = () => {
      if (onSelectBarangay && selectedBarangay && selectedBarangay !== 'All Barangays') {
        skipNextFlyToRef.current = true;
        onSelectBarangay('All Barangays');
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isMapReady, selectedBarangay, onSelectBarangay]);

  // Fly to selected Barangay: Preserves user's current zoom level so navigating between areas NEVER zooms out!
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady) return;

    if (skipNextFlyToRef.current) {
      skipNextFlyToRef.current = false;
      return;
    }

    if (selectedBarangay && selectedBarangay !== 'All Barangays') {
      const coords = BARANGAY_CENTROIDS[selectedBarangay];
      if (coords) {
        const currentZoom = map.getZoom();
        // If already zoomed in (e.g. 13, 14, 15, 16), stay at current zoom level! Never zoom out.
        const targetZoom = Math.max(currentZoom, 13);
        map.flyTo(coords, targetZoom, { duration: 0.65 });
      }
    }
  }, [selectedBarangay, isMapReady]);

  // Fly to selected Officer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady || !selectedOfficer) return;
    const currentZoom = map.getZoom();
    const targetZoom = Math.max(currentZoom, 14);
    if (selectedOfficer.lat && selectedOfficer.lng) {
      map.flyTo([selectedOfficer.lat, selectedOfficer.lng], targetZoom, { duration: 0.7 });
    }
  }, [selectedOfficer, isMapReady]);

  // Fly to selected Incident
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady || !selectedIncident) return;
    const lat = selectedIncident.lat;
    const lng = selectedIncident.lng;
    if (lat && lng) {
      const currentZoom = map.getZoom();
      const targetZoom = Math.max(currentZoom, 14);
      map.flyTo([lat, lng], targetZoom, { duration: 0.7 });
    }
  }, [selectedIncident, isMapReady]);

  // Render Incident Markers (clean pins without redundant text badges)
  useEffect(() => {
    if (!isMapReady || !incidentsLayerRef.current) return;
    const layer = incidentsLayerRef.current;
    layer.clearLayers();

    if (mode === 'Markers' || mode === 'Tracking') {
      incidents.forEach((incident) => {
        const lat = incident.lat;
        const lng = incident.lng;
        if (!lat || !lng) return;

        const isSelected = selectedIncident?.id === incident.id;
        let color = '#ef4444';
        let bg = '#fee2e2';
        let symbol = '●';
        let iconName = 'generic';

        switch (incident.type) {
          case 'Fire':
            color = '#ef4444';
            bg = '#fee2e2';
            symbol = '♨';
            iconName = 'fire';
            break;
          case 'Flood':
            color = '#0284c7';
            bg = '#e0f2fe';
            symbol = '≋';
            iconName = 'flood';
            break;
          case 'Vehicular Accident':
          case 'Accident':
            color = '#f59e0b';
            bg = '#fef3c7';
            symbol = '▱';
            iconName = 'accident';
            break;
          case 'Medical':
            color = '#10b981';
            bg = '#d1fae5';
            symbol = '✚';
            iconName = 'medical';
            break;
          case 'Landslide':
            color = '#b45309';
            bg = '#fef3c7';
            symbol = '⛰';
            iconName = 'landslide';
            break;
          default:
            break;
        }

        const customIcon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: `
            <div class="incident-pin-wrapper ${isSelected ? 'selected' : ''} ${iconName}">
              <div class="pin-pulse" style="border-color: ${color};"></div>
              <div class="pin-body" style="background-color: ${color}; color: #ffffff;">
                <span class="pin-symbol">${symbol}</span>
              </div>
            </div>
          `,
          iconSize: [36, 42],
          iconAnchor: [18, 38],
          popupAnchor: [0, -34],
        });

        const marker = L.marker([lat, lng], { icon: customIcon });

        marker.bindPopup(`
          <div class="map-popup-card">
            <div class="popup-badge" style="background: ${bg}; color: ${color}; font-weight: 700;">${incident.type}</div>
            <h4 style="margin: 6px 0 2px; font-size: 13px; color: #1e293b;">${incident.location}</h4>
            <p style="margin: 0 0 6px; font-size: 11px; color: #64748b;">${incident.text}</p>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 4px;">
              <span><b>ID:</b> ${incident.id}</span>
              <span><b>Barangay:</b> ${incident.barangay}</span>
            </div>
          </div>
        `);

        marker.on('click', () => {
          if (onSelectIncident) onSelectIncident(incident);
        });

        layer.addLayer(marker);
      });
    }
  }, [isMapReady, incidents, selectedIncident, mode, onSelectIncident]);

  // Render Live Authorized Officers (when supplied by the companion app integration)
  useEffect(() => {
    if (!isMapReady || !officersMarkersLayerRef.current || !officersTrailsLayerRef.current) return;
    const markersLayer = officersMarkersLayerRef.current;
    const trailsLayer = officersTrailsLayerRef.current;
    markersLayer.clearLayers();
    trailsLayer.clearLayers();

    if (mode === 'Tracking') {
      officers.forEach((officer) => {
        if (!officer.lat || !officer.lng) return;
        const isSelected = selectedOfficer?.id === officer.id;

        // Render breadcrumb trail if provided
        if (showBreadcrumbs && officer.trail && officer.trail.length > 1) {
          const polyline = L.polyline(officer.trail, {
            color: '#0284c7',
            weight: 3,
            opacity: 0.75,
            dashArray: '6, 6',
            lineCap: 'round',
          });
          trailsLayer.addLayer(polyline);
        }

        // APRS-derived responder pin, not authenticated by RF
        const officerIcon = L.divIcon({
          className: 'officer-leaflet-marker',
          html: `
            <div class="officer-pin-box ${isSelected ? 'selected' : ''}">
              <div class="officer-pulse-ring"></div>
              <div class="officer-badge">${escapeMapLabel(officer.name || 'Responder')}</div>
              <div class="officer-dot"><span class="officer-dot-center"></span></div>
            </div>
          `,
          iconSize: [52, 44],
          iconAnchor: [26, 32],
          popupAnchor: [0, -32],
        });

        const marker = L.marker([officer.lat, officer.lng], { icon: officerIcon });
        marker.bindPopup(`
          <div style="padding: 10px; font-size: 12px; line-height: 1.4;">
            <strong style="color: #0284c7;">${officer.name || 'DRRMO Officer'}</strong><br/>
            <span style="color: #64748b;">${escapeMapLabel(officer.unit || 'Field Responder')} • ${escapeMapLabel(officer.barangay || 'San Fernando')}</span>
          </div>
        `);

        marker.on('click', () => {
          if (onSelectOfficer) onSelectOfficer(officer);
        });

        markersLayer.addLayer(marker);
      });
    }
  }, [isMapReady, officers, selectedOfficer, mode, showBreadcrumbs, onSelectOfficer]);

  // Compute continuous Kernel Density Estimation (KDE) data points
  const kdePoints = useMemo(() => {
    return getIncidentHeatmapPoints(incidents);
  }, [incidents]);

  // Render Kernel Density Estimation (KDE) Heatmap Layer
  useEffect(() => {
    if (!isMapReady) return;
    const map = mapInstanceRef.current;
    if (!map) return;

    if (kdeHeatLayerRef.current) {
      map.removeLayer(kdeHeatLayerRef.current);
      kdeHeatLayerRef.current = null;
    }

    if (mode === 'Heatmap') {
      const kdeLayer = createKdeHeatmapLayer(kdePoints, {
        radius: kdeRadius,
        blur: 22,
        max: 1.0,
        minOpacity: 0.05,
      });
      kdeLayer.addTo(map);
      kdeHeatLayerRef.current = kdeLayer;
    }

    return () => {
      if (kdeHeatLayerRef.current && map) {
        map.removeLayer(kdeHeatLayerRef.current);
        kdeHeatLayerRef.current = null;
      }
    };
  }, [isMapReady, mode, kdePoints, kdeRadius]);

  return (
    <div className="leaflet-map-wrapper">
      {/* Basemap failures do not hide the local municipal and barangay overlays. */}
      <div
        ref={mapContainerRef}
        className={`leaflet-map-canvas ${isBasemapUnavailable ? 'offline-fallback-active' : ''}`}
        style={isBasemapUnavailable ? {
          backgroundColor: '#f1f5f9',
          backgroundImage: 'linear-gradient(to right, rgba(203, 213, 225, 0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(203, 213, 225, 0.45) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        } : undefined}
      />
      {basemapStatus && !noticeDismissed && (
        <div className="offline-map-fallback-banner" role="status" style={{
          position: 'absolute', bottom: '72px', left: '18px', zIndex: 910,
          background: 'rgba(255, 255, 255, 0.98)', border: '1px solid #cbd5e1',
          borderLeft: '4px solid #f59e0b', borderRadius: '8px', padding: '10px 14px',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)', maxWidth: '380px',
          fontSize: '12px', color: '#334155', lineHeight: 1.45,
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <AlertCircle size={16} aria-hidden="true" />
            <strong>Basemap status</strong>
            <button type="button" onClick={() => setNoticeDismissed(true)}
              aria-label="Dismiss basemap notice" style={{
                border: 0, marginLeft: 'auto', background: 'transparent',
                cursor: 'pointer', fontSize: '18px', color: '#64748b',
              }}>×</button>
          </div>
          <div style={{ marginTop: '4px' }}>{basemapStatus.message}</div>
        </div>
      )}

      {/* Google style choices and existing operational overlays */}
      <div className="google-style-map-type-bar" role="group" aria-label="Map Type & Overlays">
        {Object.entries(GOOGLE_STYLES).map(([key, config]) => {
          const IconComponent = config.icon;
          const isActive = mapType === key;
          return (
            <button
              key={key}
              type="button"
              className={`map-type-btn ${isActive ? 'active' : ''}`}
              onClick={() => switchMapType(key)}
              title={config.description}
            >
              <IconComponent size={15} />
              <span>{config.name}</span>
            </button>
          );
        })}

        {/* San Fernando Lungsod Boundary & 24 Barangay Borders Toggles */}
        <div className="map-layer-toggles">
          <button
            type="button"
            className={`map-layer-toggle-btn ${showMunicipalBorder ? 'active' : ''}`}
            onClick={() => setShowMunicipalBorder((prev) => !prev)}
            title="Toggle San Fernando municipal border"
          >
            <span style={{ color: showMunicipalBorder ? '#dc2626' : '#94a3b8', fontSize: '11px' }}>●</span>
            <span>Lungsod Border</span>
          </button>

          <button
            type="button"
            className={`map-layer-toggle-btn ${showBarangayPolygons ? 'bgy-active' : ''}`}
            onClick={() => setShowBarangayPolygons((prev) => !prev)}
            title="Toggle All 24 Barangay Boundary Lines"
          >
            <Building2 size={13} />
            <span>24 Barangays</span>
          </button>
        </div>
      </div>

      {tileSource === 'google' && (
        <div className="google-map-attribution" role="note">
          <strong>Google Maps</strong>
          <span>{googleAttribution || 'Map data attribution loading'}</span>
        </div>
      )}

      {/* Kernel Density Estimation (KDE) Heatmap Floating Controls */}
      {mode === 'Heatmap' && (
        <div className="kde-map-overlay-badge">
          <div className="kde-overlay-header">
            <span className="kde-pulse-dot" />
            <strong>Kernel Density Estimation (KDE)</strong>
            <span className="kde-points-count">{kdePoints.length} Mapped Incidents</span>
          </div>
          <div className="kde-gradient-bar-wrapper">
            <div className="kde-gradient-bar" />
            <div className="kde-gradient-labels">
              <span>Low Density</span>
              <span>Moderate</span>
              <span>High Density</span>
              <span>Highest Density</span>
            </div>
          </div>
          <div className="kde-bandwidth-control">
            <span className="kde-bandwidth-label">Kernel Bandwidth:</span>
            <div className="kde-radius-chips">
              {[26, 36, 48].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={kdeRadius === r ? 'active' : ''}
                  onClick={() => setKdeRadius(r)}
                  title={`Set Gaussian KDE bandwidth radius to ${r}px`}
                >
                  {r === 26 ? 'Compact' : r === 36 ? 'Standard' : 'Broad'} ({r}px)
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating Navigation Controls (Recenter + Fit Bounds + Zoom) */}
      <div className="google-style-nav-controls">
        <button
          type="button"
          className="fit-bounds-btn"
          title="Fit Entire San Fernando Lungsod (All 24 Barangays)"
          aria-label="Fit All Barangays"
          onClick={fitEntireLungsod}
        >
          <Maximize2 size={18} />
        </button>
        <button
          type="button"
          className="nav-control-btn"
          title="Recenter to Halapitan Poblacion (Municipal Hall / EOC)"
          aria-label="Recenter to Poblacion"
          onClick={recenterToHalapitan}
        >
          <LocateFixed size={18} />
        </button>
        <div className="zoom-btn-group">
          <button
            type="button"
            className="nav-control-btn"
            title="Zoom In"
            aria-label="Zoom In"
            onClick={handleZoomIn}
            disabled={currentZoom >= 18}
          >
            +
          </button>
          <button
            type="button"
            className="nav-control-btn"
            title={currentZoom <= allowedMinZoom ? "Minimum zoom reached (San Fernando Municipal Border)" : "Zoom Out"}
            aria-label="Zoom Out"
            onClick={handleZoomOut}
            disabled={currentZoom <= allowedMinZoom}
          >
            −
          </button>
        </div>
      </div>

      {/* Area Status Banner */}
      <div className="map-area-banner">
        <div className="badge-title">
          <span className="live-dot" />
          <strong>San Fernando, Bukidnon (Lungsod)</strong>
        </div>
        <div className="badge-details">
          <span><b>24 Barangays</b></span>
          <span>•</span>
          <span>DRRMO Operations Center</span>
          {officers.length > 0 && (
            <>
              <span>•</span>
              <span>{officers.length} Recent Responders</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
