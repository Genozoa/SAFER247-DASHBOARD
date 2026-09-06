import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  Layers,
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
  Tag,
} from 'lucide-react';
import {
  SAN_FERNANDO_CENTER,
  SAN_FERNANDO_POBLACION,
  SAN_FERNANDO_BOUNDS,
  BARANGAY_COORDINATES,
} from '../../data/mockData';
import {
  SAN_FERNANDO_MUNICIPAL_BORDER,
  SAN_FERNANDO_BARANGAYS_GEOJSON,
  BARANGAY_CENTROIDS,
  SAN_FERNANDO_MAP_BOUNDS,
} from '../../data/sanFernandoBoundary';

// Google Maps style tile configurations (authentic Google green and cartography)
const TILE_LAYERS = {
  default: {
    name: 'Default',
    icon: MapIcon,
    description: 'Google Maps Roadmap with iconic green vegetation & clean roads',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    options: {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20,
      attribution: '&copy; Google Maps',
    },
  },
  satellite: {
    name: 'Satellite',
    icon: Satellite,
    description: 'Google Maps High-Res Satellite Imagery with Road & Town Labels',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    urlNoLabels: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    options: {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20,
      attribution: '&copy; Google Maps Imagery',
    },
  },
  terrain: {
    name: 'Terrain',
    icon: Mountain,
    description: 'Google Maps Topography & Hillshading with Forest Greenery',
    url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    options: {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20,
      attribution: '&copy; Google Maps Terrain',
    },
  },
};

export default function LeafletMap({
  mode = 'Markers',
  incidents = [],
  aprsStations = [],
  selectedIncident = null,
  selectedStation = null,
  selectedBarangay = 'All Barangays',
  onSelectIncident,
  onSelectStation,
  onSelectBarangay,
  showBreadcrumbs = true,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const baseTileLayerRef = useRef(null);
  const overlayTileLayerRef = useRef(null);

  // Layer groups for clean management
  const incidentsLayerRef = useRef(null);
  const aprsMarkersLayerRef = useRef(null);
  const aprsTrailsLayerRef = useRef(null);
  const heatmapLayerRef = useRef(null);
  const municipalBorderGroupRef = useRef(null);
  const barangaysLayerRef = useRef(null);
  const barangayLabelsLayerRef = useRef(null);
  const municipalPolygonRef = useRef(null);

  // Map settings and feature toggles
  const [mapType, setMapType] = useState('default'); // 'default' | 'satellite' | 'terrain'
  const [showSatelliteLabels, setShowSatelliteLabels] = useState(true);
  const [showMunicipalBorder, setShowMunicipalBorder] = useState(true);
  const [showBarangayPolygons, setShowBarangayPolygons] = useState(true);
  const [showBarangayLabels, setShowBarangayLabels] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Create Map instance centered on San Fernando, Bukidnon (encompassing all 24 barangays)
    const map = L.map(mapContainerRef.current, {
      center: SAN_FERNANDO_CENTER,
      zoom: 11,
      minZoom: 9,
      maxZoom: 18,
      maxBounds: SAN_FERNANDO_BOUNDS,
      maxBoundsViscosity: 0.9,
      zoomControl: false, // Custom Google-like zoom buttons
    });

    // Add Base Tile Layer
    const baseConfig = TILE_LAYERS.default;
    const baseLayer = L.tileLayer(baseConfig.url, baseConfig.options).addTo(map);
    baseTileLayerRef.current = baseLayer;

    // Initialize Layer Groups in proper z-order
    municipalBorderGroupRef.current = L.layerGroup().addTo(map);
    barangaysLayerRef.current = L.layerGroup().addTo(map);
    barangayLabelsLayerRef.current = L.layerGroup().addTo(map);
    heatmapLayerRef.current = L.layerGroup().addTo(map);
    aprsTrailsLayerRef.current = L.layerGroup().addTo(map);
    incidentsLayerRef.current = L.layerGroup().addTo(map);
    aprsMarkersLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    window.leafletMapInstance = map;
    setIsMapReady(true);

    // Ensure map tiles stretch to all corners and sides on render & resize
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }
    const initialTimer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 120);

    return () => {
      clearTimeout(initialTimer);
      resizeObserver.disconnect();
      window.leafletMapInstance = null;
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Switch Base Tile Layer (Default, Satellite, Terrain)
  const switchMapType = useCallback(
    (newType) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      setMapType(newType);

      // Remove existing base layer
      if (baseTileLayerRef.current) {
        map.removeLayer(baseTileLayerRef.current);
      }
      if (overlayTileLayerRef.current) {
        map.removeLayer(overlayTileLayerRef.current);
        overlayTileLayerRef.current = null;
      }

      const config = TILE_LAYERS[newType];
      let tileUrl = config.url;
      if (newType === 'satellite' && !showSatelliteLabels && config.urlNoLabels) {
        tileUrl = config.urlNoLabels;
      }

      const newBase = L.tileLayer(tileUrl, config.options).addTo(map);
      baseTileLayerRef.current = newBase;
    },
    [showSatelliteLabels]
  );

  // Toggle Satellite Labels (instant update via setUrl)
  useEffect(() => {
    if (mapType !== 'satellite' || !baseTileLayerRef.current) return;
    const config = TILE_LAYERS.satellite;
    const targetUrl = showSatelliteLabels ? config.url : config.urlNoLabels;
    baseTileLayerRef.current.setUrl(targetUrl);
  }, [showSatelliteLabels, mapType]);

  // Fit Entire San Fernando Lungsod (enclosing all 24 barangays)
  const fitEntireLungsod = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (municipalPolygonRef.current) {
      map.fitBounds(municipalPolygonRef.current.getBounds(), {
        padding: [24, 24],
        maxZoom: 12,
      });
    } else {
      map.fitBounds(SAN_FERNANDO_MAP_BOUNDS, { padding: [24, 24] });
    }
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
    // 1. Underlay white solid line (provides sharp white contrast against satellite and terrain)
    const whiteUnderlay = L.polygon(SAN_FERNANDO_MUNICIPAL_BORDER, {
      color: '#ffffff',
      weight: 5,
      opacity: 0.95,
      fillColor: '#ea4335',
      fillOpacity: 0.035,
      interactive: false,
    });
    group.addLayer(whiteUnderlay);

    // 2. Overlay red dashed line (standard Google Maps administrative boundary)
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
  }, [isMapReady, showMunicipalBorder]);

  // Render 24 Barangay Polygons & Selection Highlights
  useEffect(() => {
    if (!isMapReady || !barangaysLayerRef.current) return;
    const layer = barangaysLayerRef.current;
    layer.clearLayers();

    if (!showBarangayPolygons) return;

    SAN_FERNANDO_BARANGAYS_GEOJSON.features.forEach((feature) => {
      const bgyName = feature.properties.name;
      const isSelected = selectedBarangay === bgyName;

      // In GeoJSON polygon coordinates are [lng, lat]; Leaflet expects [lat, lng]
      const latLngs = feature.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);

      const polygon = L.polygon(latLngs, {
        color: isSelected ? '#1d4ed8' : '#64748b',
        weight: isSelected ? 3 : 1.2,
        dashArray: isSelected ? undefined : '3, 4',
        opacity: isSelected ? 1 : 0.65,
        fillColor: isSelected ? '#2563eb' : '#64748b',
        fillOpacity: isSelected ? 0.28 : 0.03,
      });

      polygon.bindTooltip(
        `<div style="font-size: 11px; line-height: 1.4;">
          <strong style="color: #38bdf8;">Brgy. ${bgyName}</strong><br/>
          <span style="color: #94a3b8;">San Fernando, Bukidnon • PSGC: ${feature.properties.psgc}</span><br/>
          <small style="color: #cbd5e1;">Click to filter incidents in this barangay</small>
        </div>`,
        { sticky: true, className: 'bgy-tooltip' }
      );

      polygon.on('mouseover', function () {
        if (selectedBarangay !== bgyName) {
          this.setStyle({
            color: '#2563eb',
            weight: 2.2,
            dashArray: undefined,
            fillColor: '#3b82f6',
            fillOpacity: 0.18,
          });
        }
      });

      polygon.on('mouseout', function () {
        if (selectedBarangay !== bgyName) {
          this.setStyle({
            color: '#64748b',
            weight: 1.2,
            dashArray: '3, 4',
            fillColor: '#64748b',
            fillOpacity: 0.03,
          });
        }
      });

      polygon.on('click', () => {
        if (onSelectBarangay) {
          onSelectBarangay(bgyName);
        }
      });

      layer.addLayer(polygon);

      // If this is the active barangay, bring to front
      if (isSelected) {
        polygon.bringToFront();
      }
    });
  }, [isMapReady, showBarangayPolygons, selectedBarangay, onSelectBarangay]);

  // Render Google Maps Style Barangay Labels & Regional Markers
  useEffect(() => {
    if (!isMapReady || !barangayLabelsLayerRef.current) return;
    const layer = barangayLabelsLayerRef.current;
    layer.clearLayers();

    if (!showBarangayLabels) return;

    const labelThemeClass = mapType === 'satellite' ? 'satellite-label' : 'roadmap-label';

    // 1. Render Labels for all 24 Barangays at their geographic centroids
    Object.entries(BARANGAY_CENTROIDS).forEach(([name, [lat, lng]]) => {
      const isSelected = selectedBarangay === name;
      const labelIcon = L.divIcon({
        className: `google-map-bgy-label ${labelThemeClass}`,
        html: `<span style="${isSelected ? 'color: #2563eb !important; font-size: 11px; font-weight: 900;' : ''}">${name.toUpperCase()}</span>`,
        iconSize: [120, 20],
        iconAnchor: [60, 10],
      });

      const marker = L.marker([lat, lng], {
        icon: labelIcon,
        interactive: true,
      });

      marker.on('click', () => {
        if (onSelectBarangay) onSelectBarangay(name);
      });

      layer.addLayer(marker);
    });

    // 2. Render Regional Boundary Indicators (as seen on Google Maps San Fernando lungsod)
    const regionalMarkers = [
      { text: 'NORTHERN MINDANAO', lat: 7.632, lng: 125.375, rotate: -8 },
      { text: 'DAVAO REGION', lat: 7.745, lng: 125.440, rotate: -70 },
      { text: 'NORTHERN MINDANAO', lat: 7.765, lng: 125.418, rotate: -70 },
    ];

    regionalMarkers.forEach((rm) => {
      const regIcon = L.divIcon({
        className: `regional-boundary-label ${labelThemeClass}`,
        html: `<span style="transform: rotate(${rm.rotate}deg);">${rm.text}</span>`,
        iconSize: [180, 24],
        iconAnchor: [90, 12],
      });
      const regMarker = L.marker([rm.lat, rm.lng], {
        icon: regIcon,
        interactive: false,
      });
      layer.addLayer(regMarker);
    });
  }, [isMapReady, showBarangayLabels, mapType, selectedBarangay, onSelectBarangay]);

  // Fly to selected Barangay
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady) return;

    if (selectedBarangay && selectedBarangay !== 'All Barangays') {
      const coords = BARANGAY_CENTROIDS[selectedBarangay] || BARANGAY_COORDINATES[selectedBarangay];
      if (coords) {
        map.flyTo(coords, 13, { duration: 0.9 });
      }
    }
  }, [selectedBarangay, isMapReady]);

  // Fly to selected Station (APRS)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady || !selectedStation) return;
    map.flyTo([selectedStation.lat, selectedStation.lng], 15, { duration: 0.8 });
  }, [selectedStation, isMapReady]);

  // Fly to selected Incident
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady || !selectedIncident) return;
    const lat = selectedIncident.lat || 7.838;
    const lng = selectedIncident.lng || 125.214;
    map.flyTo([lat, lng], 15, { duration: 0.8 });
  }, [selectedIncident, isMapReady]);

  // Render Incident Markers
  useEffect(() => {
    if (!isMapReady || !incidentsLayerRef.current) return;
    const layer = incidentsLayerRef.current;
    layer.clearLayers();

    if (mode === 'Markers' || mode === 'Heatmap') {
      incidents.forEach((incident) => {
        const isSelected = selectedIncident?.id === incident.id;
        const lat = incident.lat || 7.838;
        const lng = incident.lng || 125.214;

        // Visual theme by type
        let color = '#ef4444';
        let bg = '#fee2e2';
        let symbol = '♨';
        let iconName = 'fire';

        switch (incident.type) {
          case 'Flood':
            color = '#0284c7';
            bg = '#e0f2fe';
            symbol = '≋';
            iconName = 'flood';
            break;
          case 'Vehicular Accident':
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
              <div class="pin-label-tag">${incident.barangay}</div>
            </div>
          `,
          iconSize: [38, 44],
          iconAnchor: [19, 40],
          popupAnchor: [0, -36],
        });

        const marker = L.marker([lat, lng], { icon: customIcon });

        marker.bindPopup(`
          <div class="map-popup-card">
            <div class="popup-badge" style="background: ${bg}; color: ${color}; font-weight: 700;">${incident.type}</div>
            <h4 style="margin: 6px 0 2px; font-size: 13px; color: #1e293b;">${incident.location}</h4>
            <p style="margin: 0 0 6px; font-size: 11px; color: #64748b;">${incident.text}</p>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 4px;">
              <span><b>ID:</b> ${incident.id}</span>
              <span><b>Time:</b> ${incident.time}</span>
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

  // Render APRS Responders and Breadcrumb Trails
  useEffect(() => {
    if (!isMapReady || !aprsMarkersLayerRef.current || !aprsTrailsLayerRef.current) return;
    const markersLayer = aprsMarkersLayerRef.current;
    const trailsLayer = aprsTrailsLayerRef.current;
    markersLayer.clearLayers();
    trailsLayer.clearLayers();

    if (mode === 'Tracking' || mode === 'Markers') {
      aprsStations.forEach((station) => {
        const isSelected = selectedStation?.callsign === station.callsign;

        // Render breadcrumb trail
        if (showBreadcrumbs && station.trail && station.trail.length > 1) {
          const polyline = L.polyline(station.trail, {
            color: isSelected ? '#2563eb' : '#3b82f6',
            weight: isSelected ? 4 : 3,
            opacity: isSelected ? 0.9 : 0.65,
            dashArray: isSelected ? undefined : '5, 8',
          });
          trailsLayer.addLayer(polyline);
        }

        // APRS Station Icon
        let iconGlyph = '🚑';
        if (station.iconType === 'truck') iconGlyph = '🛻';
        if (station.iconType === 'command') iconGlyph = '📡';
        if (station.iconType === 'search') iconGlyph = '🥾';
        if (station.iconType === 'base') iconGlyph = '🏛';
        if (station.iconType === 'weather') iconGlyph = '⛅';

        const aprsIcon = L.divIcon({
          className: 'custom-aprs-marker',
          html: `
            <div class="aprs-station-pin ${isSelected ? 'selected' : ''} ${station.speed > 0 ? 'moving' : 'fixed'}">
              <div class="aprs-callsign-tag">${station.callsign}</div>
              <div class="aprs-pin-core">
                <span class="aprs-glyph">${iconGlyph}</span>
                ${
                  station.speed > 0
                    ? `<div class="aprs-heading-arrow" style="transform: rotate(${station.heading}deg)">▲</div>`
                    : ''
                }
              </div>
              ${
                station.speed > 0
                  ? `<div class="aprs-speed-tag">${station.speed} km/h</div>`
                  : `<div class="aprs-speed-tag fixed-tag">${station.altitude}m</div>`
              }
            </div>
          `,
          iconSize: [48, 54],
          iconAnchor: [24, 46],
          popupAnchor: [0, -42],
        });

        const marker = L.marker([station.lat, station.lng], { icon: aprsIcon });

        marker.bindPopup(`
          <div class="map-popup-card aprs-popup">
            <div class="aprs-popup-head">
              <span class="aprs-tag">APRS VHF 144.390</span>
              <strong style="color: #1e293b; font-size: 14px;">${station.callsign}</strong>
            </div>
            <div style="font-size: 12px; font-weight: 600; color: #334155; margin: 4px 0 2px;">${station.name}</div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">${station.role}</div>
            <div class="aprs-popup-grid">
              <div><span>Speed</span><b>${station.speed} km/h</b></div>
              <div><span>Heading</span><b>${station.heading}°</b></div>
              <div><span>Altitude</span><b>${station.altitude} m</b></div>
              <div><span>Battery</span><b>${station.battery}</b></div>
            </div>
            <div class="aprs-raw-snippet"><code>${station.rawPacket}</code></div>
          </div>
        `);

        marker.on('click', () => {
          if (onSelectStation) onSelectStation(station);
        });

        markersLayer.addLayer(marker);
      });
    }
  }, [isMapReady, aprsStations, selectedStation, mode, showBreadcrumbs, onSelectStation]);

  // Render Heatmap Hotspots across northern, central, and southern corridors
  useEffect(() => {
    if (!isMapReady || !heatmapLayerRef.current) return;
    const layer = heatmapLayerRef.current;
    layer.clearLayers();

    if (mode === 'Heatmap') {
      // 1. Little Baguio (High Landslide & flash flood risk zone in the northwest)
      const c1 = L.circle([7.9199, 125.2880], {
        radius: 1200,
        color: '#b45309',
        fillColor: '#ef4444',
        fillOpacity: 0.35,
        weight: 1,
      });
      c1.bindTooltip('<b>High Risk Zone</b>: Brgy. Little Baguio (Landslide / Flood Corridors)', {
        direction: 'top',
        permanent: false,
      });
      layer.addLayer(c1);

      // Inner core
      const c1Core = L.circle([7.9250, 125.2980], {
        radius: 600,
        color: '#b91c1c',
        fillColor: '#b91c1c',
        fillOpacity: 0.5,
        weight: 0,
      });
      layer.addLayer(c1Core);

      // 2. Halapitan Tigwa Riverbank (Flood Inundation basin in Poblacion)
      const c2 = L.circle([7.9137, 125.3362], {
        radius: 1000,
        color: '#0284c7',
        fillColor: '#0284c7',
        fillOpacity: 0.35,
        weight: 1,
      });
      c2.bindTooltip('<b>Critical Surge Zone</b>: Tigwa Riverbank / Poblacion Evacuation Area', {
        direction: 'top',
        permanent: false,
      });
      layer.addLayer(c2);

      // 3. Kalagangan Corridor (Accident & response cluster in southern corridor)
      const c3 = L.circle([7.7132, 125.3602], {
        radius: 950,
        color: '#f59e0b',
        fillColor: '#f59e0b',
        fillOpacity: 0.3,
        weight: 1,
      });
      c3.bindTooltip('<b>Incident Cluster</b>: Brgy. Kalagangan Southern Highway Corridor', {
        direction: 'top',
        permanent: false,
      });
      layer.addLayer(c3);

      // 4. Cabuling / Matupe Southern Gateway cluster
      const c4 = L.circle([7.6686, 125.3761], {
        radius: 1100,
        color: '#0284c7',
        fillColor: '#0284c7',
        fillOpacity: 0.28,
        weight: 1,
      });
      c4.bindTooltip('<b>Waterway Monitoring</b>: Brgy. Cabuling / Southern Davao Approach', {
        direction: 'top',
        permanent: false,
      });
      layer.addLayer(c4);
    }
  }, [isMapReady, mode]);

  return (
    <div className="leaflet-map-wrapper">
      {/* Real Open-Source Leaflet Container */}
      <div ref={mapContainerRef} className="leaflet-map-canvas" />

      {/* Google Maps Style Layer Switcher & Feature Toggles Bar */}
      <div className="google-style-map-type-bar" role="group" aria-label="Map Type & Overlays">
        {Object.entries(TILE_LAYERS).map(([key, config]) => {
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

        {/* Labels checkbox if Satellite is active */}
        {mapType === 'satellite' && (
          <label className="satellite-labels-toggle" title="Toggle Road and Town Labels">
            <input
              type="checkbox"
              checked={showSatelliteLabels}
              onChange={(e) => setShowSatelliteLabels(e.target.checked)}
            />
            <span>Labels</span>
          </label>
        )}

        {/* San Fernando Lungsod Boundary & Layer Toggles */}
        <div className="map-layer-toggles">
          <button
            type="button"
            className={`map-layer-toggle-btn ${showMunicipalBorder ? 'active' : ''}`}
            onClick={() => setShowMunicipalBorder((prev) => !prev)}
            title="Toggle Google Maps San Fernando Lungsod Municipal Border"
          >
            <span style={{ color: showMunicipalBorder ? '#dc2626' : '#94a3b8' }}>●</span>
            <span>Lungsod Border</span>
          </button>

          <button
            type="button"
            className={`map-layer-toggle-btn ${showBarangayPolygons ? 'bgy-active' : ''}`}
            onClick={() => setShowBarangayPolygons((prev) => !prev)}
            title="Toggle All 24 Barangay Boundary Polygons"
          >
            <Building2 size={13} />
            <span>24 Barangays</span>
          </button>

          <button
            type="button"
            className={`map-layer-toggle-btn ${showBarangayLabels ? 'bgy-active' : ''}`}
            onClick={() => setShowBarangayLabels((prev) => !prev)}
            title="Toggle Barangay Name Labels on Map"
          >
            <Tag size={13} />
            <span>Names</span>
          </button>
        </div>
      </div>

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
          >
            +
          </button>
          <button
            type="button"
            className="nav-control-btn"
            title="Zoom Out"
            aria-label="Zoom Out"
            onClick={handleZoomOut}
          >
            −
          </button>
        </div>
      </div>

      {/* APRS Station & Area Status Banner */}
      <div className="map-area-banner">
        <div className="badge-title">
          <span className="live-dot" />
          <strong>San Fernando, Bukidnon (Lungsod)</strong>
        </div>
        <div className="badge-details">
          <span><b>24 Barangays</b></span>
          <span>•</span>
          <span>APRS: <b>144.390 MHz</b></span>
          <span>•</span>
          <span>{aprsStations.length} Responders</span>
        </div>
      </div>
    </div>
  );
}
