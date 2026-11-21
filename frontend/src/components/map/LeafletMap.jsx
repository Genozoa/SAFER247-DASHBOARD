import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import {
  Map as MapIcon,
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
import { ONLINE_TILES, OFFLINE_TILES, OSM_ATTRIBUTION, RECOVERY_INTERVAL_MS, PROVIDER_BACKOFF_MS, currentTileCoordinates, tileUrl, probeTile } from './mapBasemap.js';

// The legacy V11 styling and controls remain, but the default basemap is
// documented OSM raster imagery rather than unauthorized Google tile URLs.
const MAP_STYLES = {
  roadmap: { name: 'Roadmap', icon: MapIcon, description: 'OpenStreetMap roads and geographic features' },
};
const TILE_OPTIONS = { maxZoom: 18, maxNativeZoom: 18 };

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

  // Only actual, licensed map styles appear in the selector. Operational layers
  // remain independent of connectivity and provider choices.
  const [mapType, setMapType] = useState('roadmap');
  const [showMunicipalBorder, setShowMunicipalBorder] = useState(true);
  const [showBarangayPolygons, setShowBarangayPolygons] = useState(true);
  const [kdeRadius, setKdeRadius] = useState(36);
  const [isMapReady, setIsMapReady] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(11);
  const [allowedMinZoom, setAllowedMinZoom] = useState(10);
  const [basemapStatus, setBasemapStatus] = useState(null);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const sourceRef = useRef('online');
  const revisionRef = useRef(0);
  const handledFailureRef = useRef(-1);
  const retryAfterRef = useRef(0);
  const pendingCheckRef = useRef(null);
  const fallbackHandlerRef = useRef(null);
  const unmountedRef = useRef(false);
  const isBasemapUnavailable = basemapStatus?.kind === 'unavailable';

  const createBaseTileLayer = useCallback((source, map, revision) => {
    const layer = L.tileLayer(source === 'online' ? ONLINE_TILES : OFFLINE_TILES, {
      ...TILE_OPTIONS,
      attribution: source === 'online' ? OSM_ATTRIBUTION : 'Locally licensed offline map tiles',
    });
    let success = 0;
    let errors = 0;
    layer.on('tileload', () => {
      success += 1;
      if (revision !== revisionRef.current || source !== sourceRef.current) return;
      handledFailureRef.current = -1;
      setBasemapStatus(null);
      setNoticeDismissed(false);
    });
    layer.on('tileerror', () => { errors += 1; });
    layer.on('load', () => {
      if (revision !== revisionRef.current || source !== sourceRef.current) return;
      if (errors > 0 && success === 0) {
        if (handledFailureRef.current !== revision) {
          handledFailureRef.current = revision;
          fallbackHandlerRef.current?.(source, revision);
        }
      } else if (errors > 0) {
        setBasemapStatus({
          kind: 'partial',
          message: source === 'online'
            ? 'Some online map tiles could not be loaded.'
            : 'Some local offline tiles are missing for this area or zoom.',
        });
        setNoticeDismissed(false);
      }
      success = 0;
      errors = 0;
    });
    layer.addTo(map);
    return layer;
  }, []);

  const replaceBaseLayer = useCallback((source) => {
    const map = mapInstanceRef.current;
    if (!map || unmountedRef.current) return;
    pendingCheckRef.current?.abort();
    pendingCheckRef.current = null;
    const revision = ++revisionRef.current;
    handledFailureRef.current = -1;
    if (baseTileLayerRef.current) map.removeLayer(baseTileLayerRef.current);
    sourceRef.current = source;
    setBasemapStatus(null);
    setNoticeDismissed(false);
    baseTileLayerRef.current = createBaseTileLayer(source, map, revision);
  }, [createBaseTileLayer]);

  const localTileAvailable = useCallback(async (map, signal) => (
    (await probeTile(tileUrl(OFFLINE_TILES, currentTileCoordinates(map)), {offline: true, signal})).ok
  ), []);

  const statusFor = (reason, usingOffline) => {
    const cause = {
      missing: 'Online map tiles are missing.',
      access: 'The online tile service denied access.',
      rate_limit: 'The online tile service temporarily limited requests.',
      timeout: 'The online tile request timed out.',
      network: 'The online tile request failed. Check the internet connection or provider availability.',
      provider: 'The online tile service could not return an image.',
    }[reason] || 'The online map tiles are unavailable.';
    return usingOffline
      ? `${cause} Using licensed local offline tiles.`
      : `${cause} No local tiles cover this view. Municipal and barangay boundaries remain visible.`;
  };

  // Each transition has one abortable probe and a revision guard. No infinite
  // online/offline alternation is initiated by a tile load callback.
  fallbackHandlerRef.current = (source, revision) => {
    if (source === 'offline') {
      setBasemapStatus({
        kind: 'unavailable',
        message: 'Local offline tiles are missing for this area. Operational overlays remain visible.',
      });
      setNoticeDismissed(false);
      return;
    }
    const map = mapInstanceRef.current;
    if (!map || unmountedRef.current) return;
    pendingCheckRef.current?.abort();
    const controller = new AbortController();
    pendingCheckRef.current = controller;
    void (async () => {
      const result = await probeTile(
        tileUrl(ONLINE_TILES, currentTileCoordinates(map)), {signal: controller.signal}
      );
      if (controller.signal.aborted || revision !== revisionRef.current || unmountedRef.current) return;
      if (result.ok) {
        // A working center tile indicates the provider is reachable. Leaflet
        // preserves all existing successfully loaded tiles and vector overlays.
        setBasemapStatus({kind: 'partial', message: 'Some online tiles failed. The online map is still reachable.'});
        setNoticeDismissed(false);
        return;
      }
      if (['rate_limit', 'access'].includes(result.reason)) {
        retryAfterRef.current = Date.now() + PROVIDER_BACKOFF_MS;
      }
      const available = await localTileAvailable(map, controller.signal);
      if (controller.signal.aborted || revision !== revisionRef.current || unmountedRef.current) return;
      if (available) {
        replaceBaseLayer('offline');
        setBasemapStatus({kind: 'partial', message: statusFor(result.reason, true)});
      } else {
        setBasemapStatus({kind: 'unavailable', message: statusFor(result.reason, false)});
      }
      setNoticeDismissed(false);
    })();
  };

  // Real online responses, not navigator.onLine alone, control recovery. A
  // browser 'online' event accelerates the bounded periodic availability check.
  useEffect(() => {
    if (!isMapReady) return undefined;
    let checking = false;
    const controller = new AbortController();
    const probeRecovery = async () => {
      const map = mapInstanceRef.current;
      if (checking || controller.signal.aborted || !map || unmountedRef.current ||
          (sourceRef.current !== 'offline' && basemapStatus?.kind !== 'unavailable') ||
          Date.now() < retryAfterRef.current ||
          document.visibilityState === 'hidden') return;
      checking = true;
      const revision = revisionRef.current;
      const result = await probeTile(
        tileUrl(ONLINE_TILES, currentTileCoordinates(map)), {signal: controller.signal}
      );
      checking = false;
      if (controller.signal.aborted || unmountedRef.current || revision !== revisionRef.current) return;
      if (result.ok) replaceBaseLayer('online');
      else if (['rate_limit', 'access'].includes(result.reason)) {
        retryAfterRef.current = Date.now() + PROVIDER_BACKOFF_MS;
      }
    };
    const timer = window.setInterval(() => { void probeRecovery(); }, RECOVERY_INTERVAL_MS);
    const onOnline = () => { void probeRecovery(); };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onOnline);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onOnline);
    };
  }, [isMapReady, basemapStatus?.kind, replaceBaseLayer]);

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

    // Start with key-free, attributed OSM Roadmap. Fallback is automatic only.
    unmountedRef.current = false;
    sourceRef.current = 'online';
    const baseLayer = createBaseTileLayer('online', map, ++revisionRef.current);
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
      pendingCheckRef.current?.abort();
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

  // Render San Fernando municipal boundary independently of tile provider
  useEffect(() => {
    if (!isMapReady || !municipalBorderGroupRef.current) return;
    const group = municipalBorderGroupRef.current;
    group.clearLayers();

    if (!showMunicipalBorder) return;

    // San Fernando boundary: Red and white alternating dashed outline
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

      {/* V11-style map controls, showing only the supported Roadmap layer */}
      <div className="google-style-map-type-bar" role="group" aria-label="Map Type & Overlays">
        {Object.entries(MAP_STYLES).map(([key, config]) => {
          const IconComponent = config.icon;
          const isActive = mapType === key;
          return (
            <button
              key={key}
              type="button"
              className={`map-type-btn ${isActive ? 'active' : ''}`}
              onClick={() => setMapType(key)}
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
