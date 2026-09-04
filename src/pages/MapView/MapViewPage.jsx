import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LocateFixed, RotateCcw, X, Eye } from 'lucide-react';
import SelectDropdown from '../../components/common/SelectDropdown';
import {
  INCIDENT_TYPES,
  BARANGAY_OPTIONS,
  DATE_RANGE_OPTIONS,
  INCIDENTS,
  isWithinDateRange,
} from '../../data/mockData';

const MAP_MODES = ['Markers', 'Tracking', 'Heatmap'];

export default function MapViewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialMode = searchParams.get('mode') || 'Markers';
  const incidentIdParam = searchParams.get('incident');

  const [mode, setMode] = useState(initialMode);
  const [selectedType, setSelectedType] = useState('All Types');
  const [selectedDateRange, setSelectedDateRange] = useState('Last 30 Days');
  const [selectedBarangay, setSelectedBarangay] = useState('All Barangays');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Auto-select incident if passed in search params
  useEffect(() => {
    if (incidentIdParam) {
      const found = INCIDENTS.find((i) => i.id === incidentIdParam);
      if (found) {
        setSelectedIncident(found);
      }
    }
  }, [incidentIdParam]);

  // Filter incidents based on active criteria
  const filteredIncidents = INCIDENTS.filter((item) => {
    if (selectedType !== 'All Types' && item.type !== selectedType) {
      return false;
    }
    if (selectedBarangay !== 'All Barangays' && item.barangay !== selectedBarangay) {
      return false;
    }
    if (!isWithinDateRange(item.date, selectedDateRange)) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        item.id.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        item.barangay.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.text.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const getMarkerClass = (type) => {
    switch (type) {
      case 'Fire':
        return 'fire';
      case 'Flood':
        return 'flood';
      case 'Vehicular Accident':
        return 'vehicle';
      case 'Medical':
        return 'medical';
      case 'Landslide':
        return 'landslide';
      default:
        return 'fire';
    }
  };

  const getMarkerSymbol = (type) => {
    switch (type) {
      case 'Fire':
        return '♨';
      case 'Flood':
        return '≋';
      case 'Vehicular Accident':
        return '▱';
      case 'Medical':
        return '✚';
      case 'Landslide':
        return '⛰';
      default:
        return '●';
    }
  };

  const resetFilters = () => {
    setSelectedType('All Types');
    setSelectedDateRange('Last 30 Days');
    setSelectedBarangay('All Barangays');
    setSearchQuery('');
  };

  return (
    <div className="page map-page">
      {/* Filters & Mode Tabs Bar */}
      <div className="filter-row">
        <label>
          <span>Search</span>
          <input
            type="text"
            placeholder="⌕  Search incidents in San Fernando..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>

        <label>
          <span>Incident Type</span>
          <SelectDropdown
            value={selectedType}
            onChange={setSelectedType}
            options={INCIDENT_TYPES}
            searchable={false}
          />
        </label>

        <label>
          <span>Date Range</span>
          <SelectDropdown
            value={selectedDateRange}
            onChange={setSelectedDateRange}
            options={DATE_RANGE_OPTIONS}
            searchable={false}
          />
        </label>

        <label>
          <span>Barangay (San Fernando, Bukidnon)</span>
          <SelectDropdown
            value={selectedBarangay}
            onChange={setSelectedBarangay}
            options={BARANGAY_OPTIONS}
            searchable={true}
          />
        </label>

        <div className="map-tabs">
          {MAP_MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={mode === m ? 'active' : ''}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Map Canvas */}
      <div className="map-canvas">
        {/* Navigation Controls */}
        <div className="map-controls">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoomLevel((z) => Math.min(z + 0.15, 1.6))}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoomLevel((z) => Math.max(z - 0.15, 0.85))}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Recenter map"
            title="Recenter to San Fernando, Bukidnon"
            onClick={() => {
              setZoomLevel(1);
              setSelectedIncident(null);
            }}
          >
            <LocateFixed size={20} />
          </button>
        </div>

        {/* Municipality Badge */}
        <div className="map-area-badge">
          <span>Municipality of San Fernando, Bukidnon</span>
          <small>{filteredIncidents.length} active marker{filteredIncidents.length === 1 ? '' : 's'}</small>
        </div>

        {/* Incident Markers */}
        <div
          className="map-layer"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease-out',
            width: '100%',
            height: '100%',
            position: 'absolute',
            inset: 0,
          }}
        >
          {filteredIncidents.map((incident) => {
            const isSelected = selectedIncident?.id === incident.id;
            return (
              <div
                key={incident.id}
                className={`marker ${getMarkerClass(incident.type)} ${
                  isSelected ? 'selected-marker' : ''
                }`}
                style={{
                  top: incident.mapPos.top,
                  left: incident.mapPos.left,
                }}
                role="button"
                tabIndex={0}
                title={`${incident.type} in ${incident.barangay} (${incident.id})`}
                onClick={() => setSelectedIncident(incident)}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedIncident(incident)}
              >
                <span>{getMarkerSymbol(incident.type)}</span>
                <b className="marker-label">{incident.barangay}</b>
              </div>
            );
          })}

          {/* Tracking Mode Responders */}
          {mode === 'Tracking' && (
            <>
              <div className="responder alpha">
                ♙<span>Responder Alpha-01 (Kawayan)</span>
              </div>
              <div className="responder bravo">
                ♙<span>Responder Bravo-02 (Halapitan)</span>
              </div>
            </>
          )}

          {/* Heatmap Mode Overlays */}
          {mode === 'Heatmap' && (
            <>
              <div className="heat high" />
              <div className="heat medium" />
              <div className="heat low" />
            </>
          )}
        </div>

        {/* Empty State Banner */}
        {filteredIncidents.length === 0 && (
          <div className="map-empty-state">
            <p>No incidents match the selected criteria.</p>
            <span>Type: <b>{selectedType}</b> • Range: <b>{selectedDateRange}</b> • Location: <b>{selectedBarangay}</b></span>
            <button type="button" onClick={resetFilters}>
              <RotateCcw size={14} />
              <span>Reset Filters</span>
            </button>
          </div>
        )}

        {/* Map Context Note */}
        <div className="map-note">
          {mode === 'Heatmap'
            ? 'Heatmap shows concentration of incident reports in San Fernando.'
            : 'Click on any marker to inspect incident details'}
        </div>

        {/* Map Legend */}
        <div className="legend">
          <b>Incident Legend</b>
          <span>♨ Fire</span>
          <span>≋ Flood</span>
          <span>▱ Vehicular Accident</span>
          <span>✚ Medical Emergency</span>
          <span>⛰ Landslide</span>
        </div>

        {/* Heatmap Insights Sidebar */}
        {mode === 'Heatmap' && (
          <aside className="heat-insights">
            <h2>Heatmap Insights</h2>
            <b>San Fernando, Bukidnon</b>
            <article>
              <b>Brgy. Little Baguio (Sitio Dayag)</b>
              <p>
                <strong>12 reports</strong> recorded (high landslide & flood risk)
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedBarangay('Little Baguio');
                  setMode('Markers');
                }}
              >
                Filter Little Baguio Markers
              </button>
            </article>
            <article>
              <b>Brgy. Halapitan (Tigwa Basin)</b>
              <p>
                <strong>8 reports</strong> recorded (river water surge)
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedBarangay('Halapitan');
                  setMode('Markers');
                }}
              >
                Filter Halapitan Markers
              </button>
            </article>
          </aside>
        )}

        {/* Marker Detail Popup */}
        {selectedIncident && (
          <div className="marker-detail">
            <button
              type="button"
              aria-label="Close details"
              onClick={() => setSelectedIncident(null)}
            >
              <X size={17} />
            </button>
            <em>{selectedIncident.type}</em>
            <label>
              Report ID
              <code>{selectedIncident.id}</code>
            </label>
            <label>
              Sender
              <b>{selectedIncident.sender}</b>
            </label>
            <label>
              Barangay / Location
              <b>{selectedIncident.location}</b>
            </label>
            <label>
              Coordinates
              <code>{selectedIncident.coordinates}</code>
            </label>
            <label>
              Time
              <b>{selectedIncident.time}</b>
            </label>
            <label>
              Summary
              <span>{selectedIncident.text}</span>
            </label>
            <button
              type="button"
              className="dark"
              onClick={() => {
                navigate('/reports');
              }}
            >
              <Eye size={15} />
              <span>View in Reports Table</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
