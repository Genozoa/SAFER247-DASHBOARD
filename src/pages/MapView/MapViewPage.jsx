import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  LocateFixed,
  RotateCcw,
  X,
  Eye,
  Radio,
  Navigation,
  Activity,
  Layers,
  Search,
  MapPin,
  Flame,
} from 'lucide-react';
import SelectDropdown from '../../components/common/SelectDropdown';
import LeafletMap from '../../components/map/LeafletMap';
import {
  INCIDENT_TYPES,
  BARANGAY_OPTIONS,
  DATE_RANGE_OPTIONS,
  INCIDENTS,
  LIVE_OFFICERS,
  BARANGAY_COORDINATES,
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
  const [selectedOfficer, setSelectedOfficer] = useState(null);
  const [showBreadcrumbs, setShowBreadcrumbs] = useState(true);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  // Reset dismissal state whenever filter criteria change so empty state shows again if new criteria has 0 matches
  useEffect(() => {
    setIsBannerDismissed(false);
  }, [selectedType, selectedDateRange, selectedBarangay, searchQuery]);

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

  const resetFilters = () => {
    setSelectedType('All Types');
    setSelectedDateRange('Last 30 Days');
    setSelectedBarangay('All Barangays');
    setSearchQuery('');
  };

  const handleSelectIncident = useCallback((incident) => {
    setSelectedIncident(incident);
    setSelectedOfficer(null);
  }, []);

  const handleSelectOfficer = useCallback((officer) => {
    setSelectedOfficer(officer);
    setSelectedIncident(null);
  }, []);

  const hasActiveFilters =
    selectedType !== 'All Types' ||
    selectedDateRange !== 'Last 30 Days' ||
    selectedBarangay !== 'All Barangays' ||
    searchQuery.trim() !== '';

  return (
    <div className="page map-page">
      {/* Filters & Mode Tabs Bar */}
      <div className="filter-row map-filter-toolbar">
        <label className="filter-label search-field">
          <span>Search Incident</span>
          <div className="search-input-box">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search incidents or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-input-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </label>

        <label className="filter-label dropdown-field">
          <span>Incident Type</span>
          <SelectDropdown
            value={selectedType}
            onChange={setSelectedType}
            options={INCIDENT_TYPES}
            searchable={false}
          />
        </label>

        <label className="filter-label dropdown-field">
          <span>Date Range</span>
          <SelectDropdown
            value={selectedDateRange}
            onChange={setSelectedDateRange}
            options={DATE_RANGE_OPTIONS}
            searchable={false}
          />
        </label>

        <label className="filter-label dropdown-field bgy-field">
          <span>Barangays</span>
          <SelectDropdown
            value={selectedBarangay}
            onChange={setSelectedBarangay}
            options={BARANGAY_OPTIONS}
            searchable={true}
          />
        </label>

        {hasActiveFilters && (
          <button
            type="button"
            className="filter-reset-btn"
            onClick={resetFilters}
            title="Reset filters to default"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        )}

        <div className="map-tabs">
          <button
            type="button"
            className={mode === 'Markers' ? 'active' : ''}
            onClick={() => {
              setMode('Markers');
              setSelectedOfficer(null);
            }}
            title="Incident markers view"
          >
            <MapPin size={14} />
            <span>Markers</span>
          </button>
          <button
            type="button"
            className={mode === 'Tracking' ? 'active' : ''}
            onClick={() => {
              setMode('Tracking');
              setSelectedOfficer(null);
            }}
            title="DRRMO officer live location tracking"
          >
            <Navigation size={14} />
            <span>Officer Tracking</span>
          </button>
          <button
            type="button"
            className={mode === 'Heatmap' ? 'active' : ''}
            onClick={() => {
              setMode('Heatmap');
              setSelectedOfficer(null);
            }}
            title="Incident risk density heatmap"
          >
            <Flame size={14} />
            <span>Heatmap</span>
          </button>
        </div>
      </div>

      {/* Real Open-Source Leaflet Map Container */}
      <div className="map-canvas leaflet-wrapper-container">
        <LeafletMap
          mode={mode}
          incidents={filteredIncidents}
          officers={LIVE_OFFICERS}
          selectedIncident={selectedIncident}
          selectedOfficer={selectedOfficer}
          selectedBarangay={selectedBarangay}
          onSelectIncident={handleSelectIncident}
          onSelectOfficer={handleSelectOfficer}
          onSelectBarangay={setSelectedBarangay}
          showBreadcrumbs={showBreadcrumbs}
        />

        {/* Officer Tracking "Not Available Yet" State Banner */}
        {mode === 'Tracking' && (
          <div className="tracking-unavailable-card" role="status" aria-live="polite">
            <div className="tracking-unavailable-icon">
              <Navigation size={20} />
            </div>
            <div className="tracking-unavailable-content">
              <div className="tracking-unavailable-badge-row">
                <span className="tracking-status-badge">
                  Under Active Development
                </span>
                <span className="tracking-scope-badge">DRRMO Companion Mobile App</span>
              </div>
              <h4>Officer Live Tracking Integration Not Available Yet</h4>
              <p>
                Live GPS location tracking is reserved for authenticated DRRMO field officers using the companion mobile app currently being developed by another team member. Once released, authorized field officers' real-time coordinates, breadcrumbs, and dispatch statuses will stream directly to this map.
              </p>
              <div className="tracking-features-list">
                <div className="tracking-feature-item">
                  <span className="tracking-feature-bullet" />
                  <span>Authenticated DRRMO Officer GPS</span>
                </div>
                <div className="tracking-feature-item">
                  <span className="tracking-feature-bullet" />
                  <span>Secure Municipal Dispatch Telemetry</span>
                </div>
                <div className="tracking-feature-item">
                  <span className="tracking-feature-bullet" />
                  <span>Real-time On-Scene Patrol Breadcrumbs</span>
                </div>
                <div className="tracking-feature-item">
                  <span className="tracking-feature-bullet" />
                  <span>Zero Simulated or Fabricated Signals</span>
                </div>
              </div>
              <div className="tracking-unavailable-actions">
                <button
                  type="button"
                  className="tracking-switch-btn"
                  onClick={() => setMode('Markers')}
                >
                  <MapPin size={13} />
                  <span>Switch to Incident Markers</span>
                </button>
                <button
                  type="button"
                  className="tracking-switch-btn secondary"
                  onClick={() => setMode('Heatmap')}
                >
                  <Flame size={13} />
                  <span>View Risk Heatmap</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State Banner */}
        {filteredIncidents.length === 0 && mode === 'Markers' && !isBannerDismissed && (
          <div className="map-empty-state" role="status" aria-live="polite">
            <button
              type="button"
              className="map-empty-state-close-btn"
              onClick={() => setIsBannerDismissed(true)}
              aria-label="Dismiss no results message"
              title="Dismiss no results message"
            >
              <X size={16} />
            </button>
            <p>No incidents match the selected criteria.</p>
            <span>
              Type: <b>{selectedType}</b> • Range: <b>{selectedDateRange}</b> • Location:{' '}
              <b>{selectedBarangay}</b>
            </span>
            <button type="button" onClick={resetFilters}>
              <RotateCcw size={14} />
              <span>Reset Filters</span>
            </button>
          </div>
        )}

        {/* Map Legend (Markers & Tracking mode) */}
        {mode !== 'Heatmap' && (
          <div className="legend">
            <b>Incident Legend</b>
            <span>♨ Fire</span>
            <span>≋ Flood</span>
            <span>▱ Vehicular Accident</span>
            <span>✚ Medical Emergency</span>
            <span>⛰ Landslide</span>
          </div>
        )}

        {/* Kernel Density (KDE) Insights Sidebar */}
        {mode === 'Heatmap' && (
          <aside className="heat-insights">
            <h2>Kernel Density (KDE) Hotspots</h2>
            <b>San Fernando, Bukidnon</b>
            <article>
              <b>Brgy. Little Baguio (Sitio Dayag)</b>
              <p>
                <strong>12 hazard points</strong> (steep slope landslide & flood risk corridors)
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedBarangay('Little Baguio');
                  setMode('Markers');
                }}
              >
                Inspect Little Baguio Incidents
              </button>
            </article>
            <article>
              <b>Brgy. Halapitan (Tigwa River Basin)</b>
              <p>
                <strong>8 hazard points</strong> (river surge & central evacuation staging)
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedBarangay('Halapitan');
                  setMode('Markers');
                }}
              >
                Inspect Halapitan Incidents
              </button>
            </article>
            <article>
              <b>Brgy. Kalagangan (Sayre Highway)</b>
              <p>
                <strong>6 hazard points</strong> (arterial junction & road slip hazards)
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedBarangay('Kalagangan');
                  setMode('Markers');
                }}
              >
                Inspect Kalagangan Incidents
              </button>
            </article>
          </aside>
        )}

        {/* Incident Detail Card */}
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
              Sender / Unit
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

