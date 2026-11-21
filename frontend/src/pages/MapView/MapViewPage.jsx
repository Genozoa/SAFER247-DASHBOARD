import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  RotateCcw,
  X,
  Eye,
  Navigation,
  Search,
  MapPin,
  Flame,
} from 'lucide-react';
import SelectDropdown from '../../components/common/SelectDropdown';
import LeafletMap from '../../components/map/LeafletMap';
import {
  BARANGAY_OPTIONS,
  INCIDENT_TYPES,
  DATE_RANGE_OPTIONS,
  normalizeBarangay,
} from '../../data/referenceData';
import { useOperationalData } from '../../data/OperationalDataContext';
import {
  filterIncidentRecords,
  getIncidentCountsByBarangay,
  getIncidentHeatmapPoints,
} from '../../utils/incidentData';

export default function MapViewPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { incidents, officers } = useOperationalData();
  const initialMode = searchParams.get('mode') || location?.state?.mode || 'Markers';
  const incidentIdParam = searchParams.get('incident') || location?.state?.selectedIncidentId;
  const initialTypeParam = searchParams.get('type') || location?.state?.selectedType || 'All Types';
  const initialBarangayParam = searchParams.get('barangay') || location?.state?.selectedBarangay || 'All Barangays';

  const [mode, setMode] = useState(initialMode);
  const [selectedType, setSelectedType] = useState(initialTypeParam);
  const [selectedDateRange, setSelectedDateRange] = useState('Last 30 Days');
  const [selectedBarangay, setSelectedBarangay] = useState(
    initialBarangayParam !== 'All Barangays' ? normalizeBarangay(initialBarangayParam) : 'All Barangays'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedOfficer, setSelectedOfficer] = useState(null);
  const [showBreadcrumbs, setShowBreadcrumbs] = useState(true);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  // Sync state if navigation occurs with new params
  useEffect(() => {
    const t = searchParams.get('type') || location?.state?.selectedType;
    if (t && t !== selectedType) {
      setSelectedType(t);
    }
    const b = searchParams.get('barangay') || location?.state?.selectedBarangay;
    if (b && b !== selectedBarangay) {
      setSelectedBarangay(normalizeBarangay(b));
    }
    const m = searchParams.get('mode') || location?.state?.mode;
    if (m && m !== mode) {
      setMode(m);
    }
  }, [searchParams, location?.state]);

  // Reset dismissal state whenever filter criteria change so empty state shows again if new criteria has 0 matches
  useEffect(() => {
    setIsBannerDismissed(false);
  }, [selectedType, selectedDateRange, selectedBarangay, searchQuery]);

  // Auto-select incident if passed in search params
  useEffect(() => {
    if (incidentIdParam) {
      const found = incidents.find((i) => i.id === incidentIdParam);
      if (found) {
        setSelectedIncident(found);
      }
    }
  }, [incidentIdParam, incidents]);

  // Filter incidents based on active criteria
  const filteredIncidents = filterIncidentRecords(incidents, {
    type: selectedType,
    barangay: selectedBarangay,
    dateRange: selectedDateRange,
    searchQuery,
  });
  const hotspotBarangays = getIncidentCountsByBarangay(filteredIncidents).slice(0, 5);
  const mappableIncidentCount = getIncidentHeatmapPoints(filteredIncidents).length;

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
        <div className="filter-label search-field">
          <label htmlFor="map-search-input">Search Incident</label>
          <div className="search-input-box">
            <Search size={14} className="search-icon" />
            <input
              id="map-search-input"
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
        </div>

        <div className="filter-label dropdown-field">
          <span>Incident Type</span>
          <SelectDropdown
            value={selectedType}
            onChange={setSelectedType}
            options={INCIDENT_TYPES}
            searchable={false}
          />
        </div>

        <div className="filter-label dropdown-field">
          <span>Date Range</span>
          <SelectDropdown
            value={selectedDateRange}
            onChange={setSelectedDateRange}
            options={DATE_RANGE_OPTIONS}
            searchable={false}
          />
        </div>

        <div className="filter-label dropdown-field bgy-field">
          <span>Barangays</span>
          <SelectDropdown
            value={selectedBarangay}
            onChange={setSelectedBarangay}
            options={BARANGAY_OPTIONS}
            searchable={true}
          />
        </div>

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
          officers={officers}
          selectedIncident={selectedIncident}
          selectedOfficer={selectedOfficer}
          selectedBarangay={selectedBarangay}
          onSelectIncident={handleSelectIncident}
          onSelectOfficer={handleSelectOfficer}
          onSelectBarangay={setSelectedBarangay}
          showBreadcrumbs={showBreadcrumbs}
        />

        {mode === 'Tracking' && (
          <div className="tracking-unavailable-card" role="status">
            <div className="tracking-unavailable-content">
              <h4>{officers.length ? 'Recent responder radio positions' : 'No recent responder positions'}</h4>
              <p>
                {officers.length
                  ? 'Positions originate from APRS radio traffic within the past 24 hours. APRS call signs are not authenticated. Treat these locations as unverified and confirm with personnel before dispatch.'
                  : 'No position beacons were received in the past 24 hours. Tracking is not continuous without responder radio or companion-app updates.'}
              </p>
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

        {mappableIncidentCount === 0 && mode === 'Heatmap' && (
          <div className="map-empty-state heatmap-empty-state" role="status">
            <p>No mappable incidents match the selected criteria.</p>
            <span>The heatmap uses only incident records with valid coordinates.</span>
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
            <h2>Incident Density by Barangay</h2>
            <p>Counts include only incidents in the current filters with valid coordinates.</p>
            {hotspotBarangays.length ? hotspotBarangays.map(({ barangay, count }) => (
              <article key={barangay}>
                <b>Brgy. {barangay}</b>
                <p><strong>{count}</strong> {count === 1 ? 'mappable incident' : 'mappable incidents'}</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBarangay(barangay);
                    setMode('Markers');
                  }}
                >
                  View {barangay} incidents
                </button>
              </article>
            )) : (
              <p>No barangays have mappable incidents for these filters.</p>
            )}
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
