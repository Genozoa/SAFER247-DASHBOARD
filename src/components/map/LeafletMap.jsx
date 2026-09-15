import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
import { createKdeHeatmapLayer } from './KdeHeatmapLayer';

// Google Maps style tile configurations (clean embedded cartography)
const TILE_LAYERS = {
  default: {
    name: 'Default',
    icon: MapIcon,
    description: 'Google Maps Roadmap with clean roads and natural topography',
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
    description: 'Google Maps High-Res Satellite Imagery with embedded road & town labels',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    options: {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20,
      attribution: '&copy; Google Maps Imagery',
    },
  },
  terrain: {
    name: 'Terrain',
    icon: Mountain,
    description: 'Google Maps Topography & Hillshading with embedded contours',
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

  // Layer groups for clean management
  const incidentsLayerRef = useRef(null);
  const aprsMarkersLayerRef = useRef(null);
  const aprsTrailsLayerRef = useRef(null);
  const kdeHeatLayerRef = useRef(null);
  const municipalBorderGroupRef = useRef(null);
  const barangaysLayerRef = useRef(null);
  const municipalPolygonRef = useRef(null);

  // Map settings and feature toggles
  const [mapType, setMapType] = useState('default'); // 'default' | 'satellite' | 'terrain'
  const [showMunicipalBorder, setShowMunicipalBorder] = useState(true);
  const [showBarangayPolygons, setShowBarangayPolygons] = useState(true);
  const [kdeRadius, setKdeRadius] = useState(36);
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
      zoomControl: false, // Custom zoom buttons
    });

    // Add Base Tile Layer
    const baseConfig = TILE_LAYERS.default;
    const baseLayer = L.tileLayer(baseConfig.url, baseConfig.options).addTo(map);
    baseTileLayerRef.current = baseLayer;

    // Initialize Layer Groups in proper z-order
    municipalBorderGroupRef.current = L.layerGroup().addTo(map);
    barangaysLayerRef.current = L.layerGroup().addTo(map);
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

      const config = TILE_LAYERS[newType];
      const newBase = L.tileLayer(config.url, config.options).addTo(map);
      baseTileLayerRef.current = newBase;
    },
    []
  );

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
    // 1. Underlay white solid line (sharp contrast)
    const whiteUnderlay = L.polygon(SAN_FERNANDO_MUNICIPAL_BORDER, {
      color: '#ffffff',
      weight: 5,
      opacity: 0.95,
      fillColor: '#ea4335',
      fillOpacity: 0.035,
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
  }, [isMapReady, showMunicipalBorder]);

  // Render 24 Barangay Polygons & Selection Highlights (without redundant text overlays)
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
          <strong style="color: #0284c7;">Brgy. ${bgyName}</strong><br/>
          <span style="color: #64748b;">San Fernando, Bukidnon • PSGC: ${feature.properties.psgc}</span><br/>
          <small style="color: #0369a1;">Click to inspect incidents</small>
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

      polygon.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
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

  // Fly to selected Barangay: Preserves user's current zoom level so navigating between areas NEVER zooms out!
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady) return;

    if (selectedBarangay && selectedBarangay !== 'All Barangays') {
      const coords = BARANGAY_CENTROIDS[selectedBarangay] || BARANGAY_COORDINATES[selectedBarangay];
      if (coords) {
        const currentZoom = map.getZoom();
        // If already zoomed in (e.g. 13, 14, 15, 16), stay at current zoom level! Never zoom out.
        const targetZoom = Math.max(currentZoom, 13);
        map.flyTo(coords, targetZoom, { duration: 0.65 });
      }
    }
  }, [selectedBarangay, isMapReady]);

  // Fly to selected Station (APRS)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady || !selectedStation) return;
    const currentZoom = map.getZoom();
    const targetZoom = Math.max(currentZoom, 14);
    map.flyTo([selectedStation.lat, selectedStation.lng], targetZoom, { duration: 0.7 });
  }, [selectedStation, isMapReady]);

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
            color: '#0284c7',
            weight: 3,
            opacity: 0.75,
            dashArray: '6, 6',
            lineCap: 'round',
          });
          trailsLayer.addLayer(polyline);

          station.trail.forEach((point, idx) => {
            const isLast = idx === station.trail.length - 1;
            if (!isLast && idx % 2 === 0) {
              const dot = L.circleMarker(point, {
                radius: 3,
                color: '#0284c7',
                fillColor: '#ffffff',
                fillOpacity: 0.8,
                weight: 1.5,
              });
              trailsLayer.addLayer(dot);
            }
          });
        }

        // Animated APRS vehicle / responder marker
        const aprsIcon = L.divIcon({
          className: 'aprs-leaflet-marker',
          html: `
            <div class="aprs-pin-box ${isSelected ? 'selected' : ''}">
              <div class="aprs-pulse-ring"></div>
              <div class="aprs-callsign-badge">${station.callsign}</div>
              <div class="aprs-vehicle-dot">
                <span class="aprs-dot-center"></span>
              </div>
            </div>
          `,
          iconSize: [52, 44],
          iconAnchor: [26, 32],
          popupAnchor: [0, -32],
        });

        const marker = L.marker([station.lat, station.lng], { icon: aprsIcon });

        marker.bindPopup(`
          <div class="aprs-popup-card">
            <div class="aprs-popup-header">
              <span class="aprs-call">${station.callsign}</span>
              <span class="aprs-freq">144.390 MHz</span>
            </div>
            <div style="font-size: 12px; font-weight: 600; color: #334155; margin: 4px 0 2px;">${station.name}</div>
            <div class="aprs-telemetry-grid">
              <div><b>Speed:</b> ${station.speed} km/h</div>
              <div><b>Heading:</b> ${station.heading}°</div>
              <div><b>Altitude:</b> ${station.altitude} m</div>
              <div><b>Battery:</b> ${station.battery}%</div>
            </div>
            <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
              <b>Status:</b> ${station.comment || 'Patrol in progress'}
            </div>
          </div>
        `);

        marker.on('click', () => {
          if (onSelectStation) onSelectStation(station);
        });

        markersLayer.addLayer(marker);
      });
    }
  }, [isMapReady, aprsStations, selectedStation, mode, showBreadcrumbs, onSelectStation]);

  // Compute continuous Kernel Density Estimation (KDE) data points
  const kdePoints = useMemo(() => {
    const points = [];

    // 1. Convert active incidents into weighted KDE density points
    incidents.forEach((inc) => {
      let weight = 0.5;
      if (inc.severity === 'Critical') weight = 1.0;
      else if (inc.severity === 'High') weight = 0.8;
      else if (inc.severity === 'Moderate') weight = 0.55;
      else if (inc.severity === 'Low') weight = 0.35;

      if (inc.casualties && Number(inc.casualties) > 0) {
        weight = Math.min(1.0, weight + 0.15);
      }
      if (inc.type === 'Landslide' || inc.type === 'Flood') {
        weight = Math.min(1.0, weight + 0.1);
      }

      if (inc.lat && inc.lng) {
        points.push([inc.lat, inc.lng, weight]);
      }
    });

    // 2. Incorporate documented MDRRMO San Fernando disaster vulnerability hotspots
    // Little Baguio high landslide slip face and steep slope instability
    points.push([7.9245, 125.3001, 1.0]);
    points.push([7.9199, 125.2880, 0.9]);
    points.push([7.9280, 125.2930, 0.8]);

    // Tigwa Riverbank Flood Inundation basin (Poblacion / Halapitan)
    points.push([7.9186, 125.3286, 0.95]);
    points.push([7.9137, 125.3362, 0.9]);
    points.push([7.9220, 125.3315, 0.85]);

    // Kalagangan southern arterial highway collision & road collapse zone
    points.push([7.6922, 125.3900, 0.85]);
    points.push([7.7132, 125.3602, 0.8]);

    // Namnam low river crossing & flash floodway
    points.push([7.8340, 125.3780, 0.8]);

    // Kibongcog mountain landslide corridor
    points.push([7.9810, 125.2450, 0.75]);

    // Cabuling river overflow basin
    points.push([7.6686, 125.3761, 0.7]);

    return points;
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

        {/* San Fernando Lungsod Boundary & 24 Barangay Borders Toggles */}
        <div className="map-layer-toggles">
          <button
            type="button"
            className={`map-layer-toggle-btn ${showMunicipalBorder ? 'active' : ''}`}
            onClick={() => setShowMunicipalBorder((prev) => !prev)}
            title="Toggle Google Maps San Fernando Lungsod Municipal Border"
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
            <span className="kde-points-count">{kdePoints.length} Hazard Clusters</span>
          </div>
          <div className="kde-gradient-bar-wrapper">
            <div className="kde-gradient-bar" />
            <div className="kde-gradient-labels">
              <span>Low Density</span>
              <span>Moderate</span>
              <span>High Risk</span>
              <span>Critical</span>
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

      {/* Area Status Banner */}
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
