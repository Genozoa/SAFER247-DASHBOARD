import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Eye, Image as ImageIcon, Map, Search, X, RotateCcw } from 'lucide-react';

import SelectDropdown from '../../components/common/SelectDropdown';
import IncidentDetailDrawer from './IncidentDetailDrawer';
import ExportReportModal from './ExportReportModal';
import {
  REPORT_DATE_RANGE_OPTIONS,
  REPORT_TYPE_OPTIONS,
  REPORT_BARANGAY_OPTIONS,
  INCIDENTS,
  isWithinDateRange,
} from '../../data/mockData';

const PAGE_SIZE = 6;

export default function ReportsPage() {
  const navigate = useNavigate();

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateRange, setSelectedDateRange] = useState('Last 30 days');
  const [selectedType, setSelectedType] = useState('All types');
  const [selectedBarangay, setSelectedBarangay] = useState('All 24 barangays');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Modals & Drawers
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Filter incidents based on search and active selections
  const filteredIncidents = useMemo(() => {
    return INCIDENTS.filter((item) => {
      // 1. Date Range Filter
      if (!isWithinDateRange(item.date, selectedDateRange)) {
        return false;
      }

      // 2. Incident Type Filter
      if (selectedType !== 'All types' && selectedType !== 'All Types') {
        if (item.type.toLowerCase() !== selectedType.toLowerCase()) {
          return false;
        }
      }

      // 3. Barangay Filter
      if (selectedBarangay !== 'All 24 barangays' && selectedBarangay !== 'All Barangays') {
        if (item.barangay.toLowerCase() !== selectedBarangay.toLowerCase()) {
          return false;
        }
      }

      // 4. Search Query Filter (report ID, sender, barangay, location, or text)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = item.id.toLowerCase().includes(q);
        const matchesSender = item.sender.toLowerCase().includes(q);
        const matchesBarangay = item.barangay.toLowerCase().includes(q);
        const matchesLocation = item.location.toLowerCase().includes(q);
        const matchesText = item.text.toLowerCase().includes(q);
        if (!matchesId && !matchesSender && !matchesBarangay && !matchesLocation && !matchesText) {
          return false;
        }
      }

      return true;
    });
  }, [selectedDateRange, selectedType, selectedBarangay, searchQuery]);

  // Calculate pagination
  const totalPages = Math.max(1, Math.ceil(filteredIncidents.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const currentItems = filteredIncidents.slice(startIndex, startIndex + PAGE_SIZE);

  // Handlers that reset page to 1 on filter changes
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleDateRangeChange = (val) => {
    setSelectedDateRange(val);
    setCurrentPage(1);
  };

  const handleTypeChange = (val) => {
    setSelectedType(val);
    setCurrentPage(1);
  };

  const handleBarangayChange = (val) => {
    setSelectedBarangay(val);
    setCurrentPage(1);
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedDateRange('Last 30 days');
    setSelectedType('All types');
    setSelectedBarangay('All 24 barangays');
    setCurrentPage(1);
  };

  // Format Date (YYYY-MM-DD)
  const formatReportDate = (isoString) => {
    if (!isoString) return '2026-09-21';
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '2026-09-21';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Format Time (HH:MMH)
  const format24HourTime = (isoString, timeStr) => {
    if (isoString) {
      const d = new Date(isoString);
      if (!Number.isNaN(d.getTime())) {
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${h}:${m}H`;
      }
    }
    if (timeStr) {
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = match[2];
        const ampm = match[3] ? match[3].toUpperCase() : '';
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return `${String(h).padStart(2, '0')}:${m}H`;
      }
      if (timeStr.endsWith('H')) return timeStr;
    }
    return timeStr || '00:00H';
  };

  // Helper for incident row styling
  const getTypeClassName = (type) => {
    switch (type.toLowerCase()) {
      case 'fire':
        return 'type-fire';
      case 'flood':
        return 'type-flood';
      case 'vehicular accident':
      case 'road accident':
        return 'type-vehicular-accident';
      case 'landslide':
        return 'type-landslide';
      case 'medical':
        return 'type-medical';
      default:
        return 'type-default';
    }
  };

  return (
    <div className="page reports-page-view">
      {/* Top Filter & Action Bar */}
      <div className="reports-top-bar">
        {/* Search Bar */}
        <div className="reports-search-box">
          <Search size={16} className="reports-search-icon" />
          <input
            type="text"
            className="reports-search-input"
            placeholder="Search report ID, sender or barangay"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="reports-search-clear"
              onClick={() => handleSearchChange('')}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Date Range Dropdown */}
        <div className="reports-filter-dropdown reports-date-dropdown">
          <SelectDropdown
            value={selectedDateRange}
            onChange={handleDateRangeChange}
            options={REPORT_DATE_RANGE_OPTIONS}
            searchable={false}
          />
        </div>

        {/* Incident Type Dropdown */}
        <div className="reports-filter-dropdown reports-type-dropdown">
          <SelectDropdown
            value={selectedType}
            onChange={handleTypeChange}
            options={REPORT_TYPE_OPTIONS}
            searchable={false}
          />
        </div>

        {/* Barangays Dropdown */}
        <div className="reports-filter-dropdown reports-bgy-dropdown">
          <SelectDropdown
            value={selectedBarangay}
            onChange={handleBarangayChange}
            options={REPORT_BARANGAY_OPTIONS}
            searchable={true}
          />
        </div>

        {/* Export Button */}
        <button
          type="button"
          className="reports-export-btn"
          onClick={() => setIsExporting(true)}
          title={`Export ${filteredIncidents.length} reports`}
        >
          <Download size={16} />
          <span>Export {filteredIncidents.length} reports</span>
        </button>
      </div>

      {/* Reports Data Table Card */}
      <div className="reports-table-card">
        {/* Table Header */}
        <div className="reports-table-header">
          <span className="col-type">TYPE</span>
          <span className="col-datetime">DATE &amp; TIME</span>
          <span className="col-sender">SENDER</span>
          <span className="col-location">LOCATION</span>
          <span className="col-description">DESCRIPTION</span>
          <span className="col-actions">ACTIONS</span>
        </div>

        {/* Table Body Rows */}
        {currentItems.length > 0 ? (
          <div className="reports-table-body">
            {currentItems.map((item) => {
              const typeClass = getTypeClassName(item.type);
              return (
                <div key={item.id} className="reports-table-row">
                  {/* TYPE Column */}
                  <div className="col-type reports-type-cell">
                    <span className={`reports-type-pill ${typeClass}`}>
                      {item.type}
                    </span>
                    <span className="reports-id-text">{item.id}</span>
                  </div>

                  {/* DATE & TIME Column */}
                  <div className="col-datetime reports-datetime-cell">
                    <span className="reports-date-val">{formatReportDate(item.date)}</span>
                    <span className="reports-time-val">{format24HourTime(item.date, item.time)}</span>
                  </div>

                  {/* SENDER Column */}
                  <div className="col-sender reports-sender-cell">
                    <strong>{item.sender}</strong>
                  </div>

                  {/* LOCATION Column */}
                  <div className="col-location reports-location-cell">
                    <span>{item.location}</span>
                  </div>

                  {/* DESCRIPTION Column */}
                  <div className="col-description reports-description-cell">
                    <span className="reports-desc-text">{item.text}</span>
                    {item.hasImage && (
                      <span className="reports-photo-tag" title="Image attachment available">
                        <ImageIcon size={12} />
                        <span>PHOTO</span>
                      </span>
                    )}
                  </div>

                  {/* ACTIONS Column */}
                  <div className="col-actions reports-actions-cell">
                    <button
                      type="button"
                      className="reports-action-btn"
                      onClick={() => navigate(`/map?incident=${item.id}&mode=Markers`)}
                      title="View on Map"
                    >
                      <Map size={13} />
                      <span>Map</span>
                    </button>

                    <button
                      type="button"
                      className="reports-action-btn"
                      onClick={() => setSelectedIncident(item)}
                      title="View full report"
                    >
                      <Eye size={13} />
                      <span>View</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="reports-empty-state">
            <p>No incident reports match the active filters.</p>
            <small>
              Filter: <b>{selectedType}</b> • <b>{selectedDateRange}</b> • <b>{selectedBarangay}</b>
              {searchQuery && <> • Search: "<b>{searchQuery}</b>"</>}
            </small>
            <button type="button" onClick={resetAllFilters} className="reports-reset-btn">
              <RotateCcw size={14} />
              <span>Reset Filters</span>
            </button>
          </div>
        )}

        {/* Table Footer with Showing count & Pagination */}
        <div className="reports-table-footer">
          <span className="reports-footer-summary">
            Showing {currentItems.length} of {filteredIncidents.length} reports · {selectedDateRange.toLowerCase()}
          </span>

          <div className="reports-pagination-controls">
            <button
              type="button"
              className="reports-page-btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              title={currentPage <= 1 ? 'No previous page' : 'Previous page'}
            >
              Previous
            </button>

            <button
              type="button"
              className="reports-page-btn"
              disabled={currentPage >= totalPages || filteredIncidents.length === 0}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              title={currentPage >= totalPages ? 'No next page' : 'Next page'}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Incident Detail Slide-Over Drawer */}
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
