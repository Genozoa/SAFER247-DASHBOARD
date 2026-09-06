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
} from 'lucide-react';
import SelectDropdown from '../../components/common/SelectDropdown';
import LeafletMap from '../../components/map/LeafletMap';
import AprsTelemetryDrawer from '../../components/map/AprsTelemetryDrawer';
import {
  INCIDENT_TYPES,
  BARANGAY_OPTIONS,
  DATE_RANGE_OPTIONS,
  INCIDENTS,
  APRS_RESPONDERS,
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
  const [selectedStation, setSelectedStation] = useState(null);
  const [showBreadcrumbs, setShowBreadcrumbs] = useState(true);
  const [aprsList, setAprsList] = useState(APRS_RESPONDERS);

  // Auto-select incident if passed in search params
  useEffect(() => {
    if (incidentIdParam) {
      const found = INCIDENTS.find((i) => i.id === incidentIdParam);
      if (found) {
        setSelectedIncident(found);
      }
    }
  }, [incidentIdParam]);

  // Periodic APRS ticker simulation: updates "last heard" counter to simulate real VHF telemetry
  useEffect(() => {
    const timer = setInterval(() => {
      setAprsList((prev) =>
        prev.map((station) => {
          const delta = Math.floor(Math.random() * 2) + 1;
          const nextSec = (station.lastHeardSeconds || 5) + delta;
          // Every ~45-60s reset beacon packet
          if (nextSec > 60) {
            return {
              ...station,
              lastHeardSeconds: Math.floor(Math.random() * 5) + 1,
            };
          }
          return {
            ...station,
            lastHeardSeconds: nextSec,
          };
        })
      );
    }, 3000);

    return () => clearInterval(timer);
  }, []);

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
    setSelectedStation(null);
  }, []);

  const handleSelectStation = useCallback((station) => {
    setSelectedStation(station);
    setSelectedIncident(null);
  }, []);

  return (
    <div className="page map-page">
      {/* Filters & Mode Tabs Bar */}
      <div className="filter-row">
        <label>
          <span>Search Incident / Call</span>
          <input
            type="text"
            placeholder="⌕ Search incidents or APRS callsigns..."
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
              onClick={() => {
                setMode(m);
                setSelectedStation(null);
              }}
            >
              {m === 'Tracking' ? 'APRS Tracking' : m}
            </button>
          ))}
        </div>
      </div>

      {/* APRS Quick Status Bar for Tracking Mode */}
      {mode === 'Tracking' && (
        <div className="aprs-top-bar">
          <div className="aprs-bar-title">
            <Radio size={16} className="radio-pulse-icon" />
            <span>VHF APRS 144.390 MHz Live Telemetry</span>
            <small>({aprsList.length} Units Active)</small>
          </div>
          <div className="aprs-station-chips">
            {aprsList.map((st) => {
              const isSelected = selectedStation?.callsign === st.callsign;
              return (
                <button
                  key={st.callsign}
                  type="button"
                  className={`aprs-chip ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectStation(st)}
                >
                  <span className="chip-dot" />
                  <strong>{st.callsign}</strong>
                  <small>{st.speed > 0 ? `${st.speed} km/h` : 'Fixed'}</small>
                </button>
              );
            })}
          </div>
          <label className="breadcrumbs-toggle">
            <input
              type="checkbox"
              checked={showBreadcrumbs}
              onChange={(e) => setShowBreadcrumbs(e.target.checked)}
            />
            <span>Breadcrumbs</span>
          </label>
        </div>
      )}

      {/* Real Open-Source Leaflet Map Container */}
      <div className="map-canvas leaflet-wrapper-container">
        <LeafletMap
          mode={mode}
          incidents={filteredIncidents}
          aprsStations={aprsList}
          selectedIncident={selectedIncident}
          selectedStation={selectedStation}
          selectedBarangay={selectedBarangay}
          onSelectIncident={handleSelectIncident}
          onSelectStation={handleSelectStation}
          onSelectBarangay={setSelectedBarangay}
          showBreadcrumbs={showBreadcrumbs}
        />

        {/* Empty State Banner */}
        {filteredIncidents.length === 0 && mode === 'Markers' && (
          <div className="map-empty-state">
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
            <h2>Heatmap Risk Density</h2>
            <b>San Fernando, Bukidnon</b>
            <article>
              <b>Brgy. Little Baguio (Sitio Dayag)</b>
              <p>
                <strong>12 reports</strong> recorded (high landslide & flood risk corridors)
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
                <strong>8 reports</strong> recorded (river water surge & evacuation staging)
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
                <strong>6 reports</strong> recorded (high collision & junction incidents)
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

        {/* APRS Station Telemetry Drawer */}
        {selectedStation && (
          <AprsTelemetryDrawer
            station={selectedStation}
            onClose={() => setSelectedStation(null)}
            onFocusStation={(station) => {
              if (window.leafletMapInstance) {
                window.leafletMapInstance.flyTo([station.lat, station.lng], 15);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

