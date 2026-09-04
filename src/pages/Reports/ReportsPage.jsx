import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Eye, Map, MapPin, RotateCcw } from 'lucide-react';

import SelectDropdown from '../../components/common/SelectDropdown';
import IncidentDetailDrawer from './IncidentDetailDrawer';
import ExportReportModal from './ExportReportModal';
import {
  INCIDENT_TYPES,
  BARANGAY_OPTIONS,
  DATE_RANGE_OPTIONS,
  INCIDENTS,
  isWithinDateRange,
} from '../../data/mockData';

export default function ReportsPage() {
  const navigate = useNavigate();
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const [selectedType, setSelectedType] = useState('All Types');
  const [selectedDateRange, setSelectedDateRange] = useState('Last 30 Days');
  const [selectedBarangay, setSelectedBarangay] = useState('All Barangays');

  // Filter incidents based on active selections
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
    return true;
  });

  const resetFilters = () => {
    setSelectedType('All Types');
    setSelectedDateRange('Last 30 Days');
    setSelectedBarangay('All Barangays');
  };

  const formatReportDateTime = (isoString, timeStr) => {
    if (!isoString) return `2026-09-04 ${timeStr}`;
    const d = new Date(isoString);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}H`;
  };

  return (
    <div className="page reports">
      {/* Header Section */}
      <div className="page-heading">
        <div>
          <h1>Incident Reports</h1>
          <p className="sub-heading">
            Official logs for the Municipality of San Fernando, Bukidnon (LDRRMO SAFER 24/7)
          </p>
        </div>
        <button
          type="button"
          className="dark"
          onClick={() => setIsExporting(true)}
        >
          <Download size={18} />
          <span>Generate Report ({filteredIncidents.length})</span>
        </button>
      </div>

      {/* Filter Row */}
      <div className="report-filters">
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
          <span>Incident Type</span>
          <SelectDropdown
            value={selectedType}
            onChange={setSelectedType}
            options={INCIDENT_TYPES}
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
      </div>

      {/* Reports Data Table */}
      <div className="report-table">
        <div className="table-head">
          <span>Report ID</span>
          <span>Date & Time</span>
          <span>Type</span>
          <span>Sender</span>
          <span>Location</span>
          <span>Description</span>
          <span>Image</span>
          <span>Actions</span>
        </div>

        {filteredIncidents.length > 0 ? (
          filteredIncidents.map((item) => (
            <div className="table-row" key={item.id}>
              <code>{item.id}</code>
              <span>{formatReportDateTime(item.date, item.time)}</span>
              <em>{item.type}</em>
              <span>{item.sender}</span>
              <span>
                <MapPin size={14} />
                {item.location}
              </span>
              <p>{item.text}</p>
              <span className={item.hasImage ? 'yes' : 'no'}>
                {item.hasImage ? '▧ Yes' : 'No'}
              </span>
              <span className="actions">
                <button
                  type="button"
                  title="View on map"
                  onClick={() => navigate(`/map?incident=${item.id}&mode=Markers`)}
                >
                  <Map size={18} />
                </button>
                <button
                  type="button"
                  title="View details"
                  onClick={() => setSelectedIncident(item)}
                >
                  <Eye size={18} />
                </button>
              </span>
            </div>
          ))
        ) : (
          <div className="table-empty">
            <p>No incident reports match the active filters.</p>
            <small>
              Filter: <b>{selectedType}</b> • <b>{selectedDateRange}</b> • <b>{selectedBarangay}</b>
            </small>
            <button type="button" onClick={resetFilters} className="reset-btn">
              <RotateCcw size={14} />
              <span>Reset Filters</span>
            </button>
          </div>
        )}

        <footer>
          <span>
            Showing 1 to {filteredIncidents.length} of {filteredIncidents.length} results
          </span>
          <span>Previous　<b>1</b>　Next</span>
        </footer>
      </div>

      {/* Incident Detail Drawer */}
      {selectedIncident && (
        <IncidentDetailDrawer
          item={selectedIncident}
          onClose={() => setSelectedIncident(null)}
        />
      )}

      {/* Export Report Modal */}
      {isExporting && (
        <ExportReportModal
          count={filteredIncidents.length}
          onClose={() => setIsExporting(false)}
        />
      )}
    </div>
  );
}
