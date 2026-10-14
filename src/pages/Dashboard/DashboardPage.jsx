import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, MapPin, Camera, ArrowRight, Layers, PieChart } from 'lucide-react';
import {
  INCIDENTS,
  TIMELINE_DATASETS,
  HOURLY_COUNTS_ALL,
  TYPE_SCALING,
  DAILY_COUNTS_ALL,
  MONTHLY_COUNTS_ALL,
  MONTH_LABELS,
  INCIDENT_TYPE_DISTRIBUTION,
  BARANGAY_REPORTS_DATA,
  REPORT_TYPE_OPTIONS,
  normalizeBarangay,
} from '../../data/mockData';

// Helper to format ISO date or relative time string into "08:15H"
function formatToHTime(incident) {
  if (incident.time) {
    // If format is like "08:15 AM" or "10:42 AM"
    const match = incident.time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const meridiem = (match[3] || '').toUpperCase();
      if (meridiem === 'PM' && hours < 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:${minutes}H`;
    }
  }
  if (incident.date) {
    const d = new Date(incident.date);
    if (!Number.isNaN(d.getTime())) {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}H`;
    }
  }
  return '08:15H';
}

// Helper to determine pill class based on category
function getPillClass(type) {
  const norm = (type || '').toLowerCase();
  if (norm.includes('fire')) return 'latest-report-pill fire';
  if (norm.includes('flood')) return 'latest-report-pill flood';
  if (norm.includes('vehicular') || norm.includes('accident') || norm.includes('road')) {
    return 'latest-report-pill vehicular-accident';
  }
  if (norm.includes('medical')) return 'latest-report-pill medical';
  if (norm.includes('landslide')) return 'latest-report-pill landslide';
  return 'latest-report-pill fire';
}

export default function DashboardPage() {
  const navigate = useNavigate();

  // Filters for cards
  const [timelineType, setTimelineType] = useState('All incident types');
  const [distributionView, setDistributionView] = useState('Hour'); // 'Hour' | 'Day' | 'Month'
  const [distributionType, setDistributionType] = useState('All');

  // Hover state for interactive SVG charts
  const [timelineHover, setTimelineHover] = useState(null); // { x, y, label, value }
  const [distributionHover, setDistributionHover] = useState(null); // { x, y, label, count }

  // 1) Timeline Chart Calculations
  const timelinePoints = useMemo(() => {
    return TIMELINE_DATASETS[timelineType] || TIMELINE_DATASETS['All incident types'];
  }, [timelineType]);

  // Dimensions for SVG Line Chart
  const svgWidth = 620;
  const svgHeight = 220;
  const chartPadLeft = 40;
  const chartPadRight = 40;
  const chartPadTop = 20;
  const chartPadBottom = 40;
  const innerWidth = svgWidth - chartPadLeft - chartPadRight;
  const innerHeight = svgHeight - chartPadTop - chartPadBottom;
  const yMax = 60;

  // Grid line levels: 15, 30, 45, 60
  const gridLevels = [15, 30, 45, 60];

  // Coordinates for timeline points
  const calculatedTimelinePoints = useMemo(() => {
    const count = timelinePoints.length;
    return timelinePoints.map((pt, idx) => {
      const x = chartPadLeft + (idx / (count - 1)) * innerWidth;
      const y = chartPadTop + innerHeight - (pt.value / yMax) * innerHeight;
      return { ...pt, x, y, isToday: idx === count - 1 };
    });
  }, [timelinePoints, innerWidth, innerHeight]);

  // Generate SVG path for line
  const timelinePathD = useMemo(() => {
    if (calculatedTimelinePoints.length === 0) return '';
    return calculatedTimelinePoints.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
    }, '');
  }, [calculatedTimelinePoints]);

  // 2) Incident Distribution Calculations
  const distributionData = useMemo(() => {
    const factor = TYPE_SCALING[distributionType] ?? 1;

    if (distributionView === 'Hour') {
      const rawCounts = HOURLY_COUNTS_ALL.map((val) =>
        factor === 1 ? val : Math.max(0, Math.round(val * factor))
      );
      const total = rawCounts.reduce((a, b) => a + b, 0);

      // Find indices of top 2 values
      const indexed = rawCounts.map((v, i) => ({ v, i }));
      indexed.sort((a, b) => b.v - a.v);
      const topIndices = new Set([indexed[0]?.i, indexed[1]?.i]);

      const items = rawCounts.map((count, hour) => {
        const hourStr = String(hour).padStart(2, '0');
        let color = '#C3D1E8'; // lowest
        if (topIndices.has(hour)) {
          color = '#1B57D6'; // top 2
        } else if (count >= 8) {
          color = '#9DB3D4'; // mid-height
        }
        return {
          key: hourStr,
          label: hourStr,
          tooltipText: `${hourStr}:00 · ${count} reports`,
          count,
          color,
          showLabel: hour % 3 === 0, // 00, 03, 06, 09, 12, 15, 18, 21
        };
      });

      return {
        items,
        totalText: `${total.toLocaleString()} reports`,
        dateText: '22 Sep 2026 · Today',
        subtitle: 'Reports per hour',
      };
    }

    if (distributionView === 'Day') {
      const rawCounts = DAILY_COUNTS_ALL.map((val) =>
        factor === 1 ? val : Math.max(0, Math.round(val * factor))
      );
      const total = rawCounts.reduce((a, b) => a + b, 0);

      const indexed = rawCounts.map((v, i) => ({ v, i }));
      indexed.sort((a, b) => b.v - a.v);
      const topIndices = new Set([indexed[0]?.i, indexed[1]?.i]);

      const items = rawCounts.map((count, dayIdx) => {
        const dayNum = dayIdx + 1;
        let color = '#C3D1E8';
        if (topIndices.has(dayIdx)) {
          color = '#1B57D6';
        } else if (count >= 48) {
          color = '#9DB3D4';
        }
        return {
          key: `day-${dayNum}`,
          label: `D${dayNum}`,
          tooltipText: `Day ${dayNum} · ${count} reports`,
          count,
          color,
          showLabel: dayIdx % 5 === 0 || dayIdx === rawCounts.length - 1,
        };
      });

      return {
        items,
        totalText: `${total.toLocaleString()} reports`,
        dateText: 'Last 30 Days · Overview',
        subtitle: 'Reports per day',
      };
    }

    // Month view
    const rawCounts = MONTHLY_COUNTS_ALL.map((val) =>
      factor === 1 ? val : Math.max(0, Math.round(val * factor))
    );
    const total = rawCounts.reduce((a, b) => a + b, 0);

    const indexed = rawCounts.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => b.v - a.v);
    const topIndices = new Set([indexed[0]?.i, indexed[1]?.i]);

    const items = rawCounts.map((count, mIdx) => {
      const label = MONTH_LABELS[mIdx];
      let color = '#C3D1E8';
      if (topIndices.has(mIdx)) {
        color = '#1B57D6';
      } else if (count >= 1400) {
        color = '#9DB3D4';
      }
      return {
        key: label,
        label,
        tooltipText: `${label} · ${count.toLocaleString()} reports`,
        count,
        color,
        showLabel: true,
      };
    });

    return {
      items,
      totalText: `${total.toLocaleString()} reports`,
      dateText: 'Past 12 Months · Overview',
      subtitle: 'Reports per month',
    };
  }, [distributionView, distributionType]);

  // Distribution Bar Chart SVG Calculations
  const barChartWidth = 620;
  const barChartHeight = 180;
  const barPadLeft = 16;
  const barPadRight = 16;
  const barPadTop = 15;
  const barPadBottom = 30;
  const barInnerWidth = barChartWidth - barPadLeft - barPadRight;
  const barInnerHeight = barChartHeight - barPadTop - barPadBottom;

  const maxBarValue = useMemo(() => {
    const max = Math.max(...distributionData.items.map((i) => i.count), 1);
    return Math.ceil(max * 1.1);
  }, [distributionData]);

  const barCount = distributionData.items.length;
  const barGap = 6;
  const barWidth = Math.max(4, (barInnerWidth - (barCount - 1) * barGap) / barCount);

  // 3) Interactive Type Selection & Filtered Reports List
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('All');

  const handleTypeSelect = (type) => {
    if (selectedTypeFilter === type) {
      setSelectedTypeFilter('All');
      setTimelineType('All incident types');
    } else {
      setSelectedTypeFilter(type);
      setTimelineType(type);
    }
  };

  const displayedReports = useMemo(() => {
    if (selectedTypeFilter === 'All') {
      return INCIDENTS.slice(0, 10);
    }
    return INCIDENTS.filter((r) => r.type === selectedTypeFilter);
  }, [selectedTypeFilter]);

  // 4) Type Distribution State & Calculations
  const [typeDistRange, setTypeDistRange] = useState('Last 30 Days');
  const typeDistributionData = useMemo(() => {
    let factor = 1;
    if (typeDistRange === 'Today') factor = 0.28;
    else if (typeDistRange === 'Last 7 Days') factor = 0.55;
    else if (typeDistRange === 'All Time') factor = 2.4;

    const items = INCIDENT_TYPE_DISTRIBUTION.map((item) => {
      const count = Math.max(1, Math.round(item.count * factor));
      return { ...item, count };
    });

    const total = items.reduce((acc, curr) => acc + curr.count, 0);
    const withPerc = items.map((item) => ({
      ...item,
      percentage: Math.round((item.count / total) * 100),
    }));

    return { items: withPerc, total };
  }, [typeDistRange]);

  // Donut chart path generation (SVG circle stroke-dasharray)
  const donutRadius = 40;
  const donutCircumference = 2 * Math.PI * donutRadius; // ~251.33
  const donutSegments = useMemo(() => {
    let accumulatedOffset = 0;
    return typeDistributionData.items.map((item) => {
      const strokeLength = (item.percentage / 100) * donutCircumference;
      const strokeOffset = -accumulatedOffset;
      accumulatedOffset += strokeLength;
      return {
        ...item,
        strokeDasharray: `${strokeLength} ${donutCircumference - strokeLength}`,
        strokeDashoffset: strokeOffset,
      };
    });
  }, [typeDistributionData, donutCircumference]);

  // 5) Report by Barangay State & Calculations (all 24 barangays, ranked highest to lowest)
  const [barangayReportType, setBarangayReportType] = useState('All types');

  const barangayReportItems = useMemo(() => {
    const list = BARANGAY_REPORTS_DATA.map((item) => {
      const cleanName = normalizeBarangay(item.barangay);
      const count =
        barangayReportType === 'All types'
          ? item.count
          : (item.byType?.[barangayReportType] ?? 0);
      return {
        barangay: cleanName,
        count,
        lat: item.lat,
        lng: item.lng,
      };
    });

    // Rank from highest to lowest all 24 barangays
    return list.sort((a, b) => b.count - a.count);
  }, [barangayReportType]);

  const maxBarangayCount = useMemo(() => {
    return Math.max(...barangayReportItems.map((b) => b.count), 1);
  }, [barangayReportItems]);

  const getBarColor = (count, max) => {
    const ratio = max > 0 ? count / max : 0;
    if (ratio >= 0.92) return '#1B57D6';
    if (ratio >= 0.78) return '#4C7DE0';
    if (ratio >= 0.65) return '#7FA3E9';
    if (ratio >= 0.45) return '#A8C1F0';
    return '#C3D1E8';
  };

  return (
    <div className="dashboard">
      {/* LEFT COLUMN (approx 2/3 width) */}
      <div className="dashboard-left-col">
        {/* ROW OF 2 STAT CARDS */}
        <div className="dashboard-stats-row">
          {/* Card 1: Total Reports Today */}
          <div className="dashboard-card stat-card">
            <span className="stat-card-label">TOTAL REPORTS TODAY</span>
            <span className="stat-card-number">47</span>
          </div>

          {/* Card 2: Most Reported Type */}
          <div className="dashboard-card stat-card">
            <span className="stat-card-label">MOST REPORTED TYPE</span>
            <div className="stat-card-type-row">
              <span className="stat-card-type-dot" />
              <span className="stat-card-type-title">Fire</span>
              <span className="stat-card-type-ratio">18 of 47</span>
            </div>
          </div>
        </div>

        {/* INCIDENT TIMELINE CARD */}
        <div className="dashboard-card dashboard-chart-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-titles">
              <h2 className="dashboard-card-title">Incident Timeline</h2>
              <p className="dashboard-card-subtitle">Reports per day · last 7 days</p>
            </div>

            <div className="dashboard-controls-group">
              <div className="dashboard-select-wrapper">
                <select
                  className="dashboard-select"
                  value={timelineType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTimelineType(val);
                    if (val === 'All incident types') {
                      setSelectedTypeFilter('All');
                    } else {
                      setSelectedTypeFilter(val);
                    }
                  }}
                  aria-label="Filter timeline by incident type"
                >
                  <option value="All incident types">All incident types</option>
                  <option value="Fire">Fire</option>
                  <option value="Flood">Flood</option>
                  <option value="Vehicular Accident">Vehicular Accident</option>
                  <option value="Medical">Medical</option>
                  <option value="Landslide">Landslide</option>
                </select>
                <ChevronDown size={14} className="dashboard-select-icon" />
              </div>
            </div>
          </div>

          {/* Line Chart */}
          <div className="chart-container-rel">
            <svg
              className="chart-svg"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Four faint horizontal grid lines at 15, 30, 45, 60 */}
              {gridLevels.map((lvl) => {
                const yPos = chartPadTop + innerHeight - (lvl / yMax) * innerHeight;
                return (
                  <line
                    key={lvl}
                    x1={chartPadLeft}
                    y1={yPos}
                    x2={svgWidth - chartPadRight}
                    y2={yPos}
                    stroke="#E3E9F1"
                    strokeWidth="1"
                    strokeDasharray="none"
                  />
                );
              })}

              {/* Blue 3px line (no area fill) */}
              <path
                d={timelinePathD}
                fill="none"
                stroke="#1B57D6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points */}
              {calculatedTimelinePoints.map((pt, idx) => {
                const isToday = pt.isToday;
                return (
                  <g
                    key={pt.label}
                    className="chart-interactive-node"
                    onMouseEnter={() =>
                      setTimelineHover({
                        x: pt.x,
                        y: pt.y,
                        label: pt.label,
                        value: pt.value,
                      })
                    }
                    onMouseLeave={() => setTimelineHover(null)}
                  >
                    {/* Hover touch target */}
                    <circle cx={pt.x} cy={pt.y} r={14} fill="transparent" />

                    {/* Point Circle: hollow for past, solid blue for TODAY */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={5}
                      fill={isToday ? '#1B57D6' : '#FFFFFF'}
                      stroke="#1B57D6"
                      strokeWidth={2}
                    />

                    {/* X-axis labels in IBM Plex Mono, 13px, muted, uppercase. TODAY is bold blue */}
                    <text
                      x={pt.x}
                      y={svgHeight - 12}
                      textAnchor="middle"
                      fontFamily="IBM Plex Mono, monospace"
                      fontSize="13"
                      fontWeight={isToday ? '700' : '500'}
                      fill={isToday ? '#1B57D6' : '#6B7A90'}
                    >
                      {pt.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Interactive Tooltip for Timeline Point */}
            {timelineHover && (
              <div
                className="chart-tooltip"
                style={{
                  '--tt-left': `${(timelineHover.x / svgWidth) * 100}%`,
                  '--tt-top': `${(timelineHover.y / svgHeight) * 100}%`,
                }}
              >
                {timelineHover.label} · {timelineHover.value} reports
              </div>
            )}
          </div>
        </div>

        {/* INCIDENT DISTRIBUTION CARD */}
        <div className="dashboard-card dashboard-chart-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-titles">
              <h2 className="dashboard-card-title">Incident Distribution</h2>
              <p className="dashboard-card-subtitle">{distributionData.subtitle}</p>
            </div>

            <div className="dashboard-controls-group">
              {/* Segmented Toggle [Hour | Day | Month] in light grey-blue pill */}
              <div className="segmented-toggle" role="group" aria-label="Distribution time grouping">
                {['Hour', 'Day', 'Month'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`segmented-toggle-btn ${distributionView === mode ? 'active' : ''}`}
                    onClick={() => setDistributionView(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {/* Small select dropdown for incident type */}
              <div className="dashboard-select-wrapper">
                <select
                  className="dashboard-select"
                  value={distributionType}
                  onChange={(e) => setDistributionType(e.target.value)}
                  aria-label="Filter distribution by incident type"
                >
                  <option value="All">All</option>
                  <option value="Fire">Fire</option>
                  <option value="Flood">Flood</option>
                  <option value="Vehicular Accident">Vehicular Accident</option>
                </select>
                <ChevronDown size={14} className="dashboard-select-icon" />
              </div>
            </div>
          </div>

          {/* Subheader info line */}
          <div className="distribution-sub-bar">
            <span className="distribution-date-label">{distributionData.dateText}</span>
            <span className="distribution-count-label">{distributionData.totalText}</span>
          </div>

          {/* Thin divider line above chart */}
          <div className="distribution-divider" />

          {/* Bar Chart */}
          <div className="chart-container-rel">
            <svg
              className="chart-svg"
              viewBox={`0 0 ${barChartWidth} ${barChartHeight}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {distributionData.items.map((bar, index) => {
                const x = barPadLeft + index * (barWidth + barGap);
                const barHeight = Math.max(3, (bar.count / maxBarValue) * barInnerHeight);
                const y = barPadTop + barInnerHeight - barHeight;

                return (
                  <g
                    key={bar.key}
                    className="chart-interactive-node"
                    onMouseEnter={() =>
                      setDistributionHover({
                        x: x + barWidth / 2,
                        y,
                        text: bar.tooltipText,
                      })
                    }
                    onMouseLeave={() => setDistributionHover(null)}
                  >
                    {/* Invisible expanded touch hit target */}
                    <rect
                      x={x - barGap / 2}
                      y={barPadTop}
                      width={barWidth + barGap}
                      height={barInnerHeight + barPadBottom}
                      fill="transparent"
                    />

                    {/* Bar with 3px corner radius */}
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx={3}
                      ry={3}
                      fill={bar.color}
                      transition="height 0.2s ease"
                    />

                    {/* X-axis label in IBM Plex Mono font */}
                    {bar.showLabel && (
                      <text
                        x={x + barWidth / 2}
                        y={barChartHeight - 8}
                        textAnchor="middle"
                        fontFamily="IBM Plex Mono, monospace"
                        fontSize="12"
                        fontWeight="500"
                        fill="#6B7A90"
                      >
                        {bar.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Tooltip for distribution bar */}
            {distributionHover && (
              <div
                className="chart-tooltip"
                style={{
                  '--tt-left': `${(distributionHover.x / barChartWidth) * 100}%`,
                  '--tt-top': `${(distributionHover.y / barChartHeight) * 100}%`,
                }}
              >
                {distributionHover.text}
              </div>
            )}
          </div>
        </div>

        {/* SUB-GRID: TYPE DISTRIBUTION & REPORT BY BARANGAY */}
        <div className="dashboard-sub-grid">
          {/* TYPE DISTRIBUTION CARD */}
          <div className="dashboard-card type-dist-card">
            <div className="dashboard-card-header">
              <div className="dashboard-card-titles">
                <h2 className="dashboard-card-title">Type Distribution</h2>
                <p className="dashboard-card-subtitle">
                  {selectedTypeFilter !== 'All'
                    ? `Filtered by ${selectedTypeFilter} · Click slice to reset`
                    : 'Reports by category · San Fernando'}
                </p>
              </div>

              <div className="dashboard-controls-group">
                <div className="dashboard-select-wrapper">
                  <select
                    className="dashboard-select"
                    value={typeDistRange}
                    onChange={(e) => setTypeDistRange(e.target.value)}
                    aria-label="Filter type distribution timeframe"
                  >
                    <option value="Today">Today</option>
                    <option value="Last 7 Days">Last 7 Days</option>
                    <option value="Last 30 Days">Last 30 Days</option>
                    <option value="All Time">All Time</option>
                  </select>
                  <ChevronDown size={14} className="dashboard-select-icon" />
                </div>
              </div>
            </div>

            {/* Visual Row: Donut + Detailed Breakdown */}
            <div className="type-dist-visual-row">
              <div className="type-dist-donut-wrap">
                <svg viewBox="0 0 120 120" className="chart-svg">
                  <circle
                    cx="60"
                    cy="60"
                    r={donutRadius}
                    fill="none"
                    stroke="#EEF2F8"
                    strokeWidth="20"
                  />
                  {donutSegments.map((seg) => {
                    const isSelected = selectedTypeFilter === seg.type;
                    const isDimmed = selectedTypeFilter !== 'All' && !isSelected;

                    return (
                      <circle
                        key={seg.type}
                        cx="60"
                        cy="60"
                        r={donutRadius}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={isSelected ? 24 : 20}
                        strokeDasharray={seg.strokeDasharray}
                        strokeDashoffset={seg.strokeDashoffset}
                        strokeLinecap="butt"
                        transform="rotate(-90 60 60)"
                        className={`type-dist-slice ${isSelected ? 'active' : ''} ${isDimmed ? 'dimmed' : ''}`}
                        onClick={() => handleTypeSelect(seg.type)}
                      >
                        <title>{`${seg.type}: ${seg.count} reports (${seg.percentage}%) - Click to filter`}</title>
                      </circle>
                    );
                  })}
                </svg>
                <div className="type-dist-donut-center">
                  {selectedTypeFilter !== 'All' ? (
                    <>
                      <span
                        className="type-dist-total-num"
                        style={{
                          color:
                            typeDistributionData.items.find((i) => i.type === selectedTypeFilter)?.color ||
                            '#1B57D6',
                        }}
                      >
                        {typeDistributionData.items.find((i) => i.type === selectedTypeFilter)?.count || 0}
                      </span>
                      <span className="type-dist-total-lbl">{selectedTypeFilter}</span>
                      <button
                        type="button"
                        className="type-dist-reset-btn"
                        onClick={() => handleTypeSelect(selectedTypeFilter)}
                        title="Reset filter"
                      >
                        Clear
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="type-dist-total-num">{typeDistributionData.total}</span>
                      <span className="type-dist-total-lbl">INCIDENTS</span>
                    </>
                  )}
                </div>
              </div>

              <div className="type-dist-breakdown">
                {typeDistributionData.items.map((item) => {
                  const isSelected = selectedTypeFilter === item.type;
                  const isDimmed = selectedTypeFilter !== 'All' && !isSelected;

                  return (
                    <div
                      key={item.type}
                      className={`type-dist-item ${isSelected ? 'active' : ''} ${isDimmed ? 'dimmed' : ''}`}
                      onClick={() => handleTypeSelect(item.type)}
                      title={`Click to filter: ${item.type} (${item.count} reports)`}
                    >
                      <div className="type-dist-item-top">
                        <div className="type-dist-item-left">
                          <span className="type-dist-dot" style={{ backgroundColor: item.color }} />
                          <span className="type-dist-type-name">{item.type}</span>
                        </div>
                        <div className="type-dist-item-right">
                          <span className="type-dist-count-bold">{item.count}</span>
                          <span>({item.percentage}%)</span>
                        </div>
                      </div>
                      <div className="type-dist-bar-track">
                        <div
                          className="type-dist-bar-fill"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Map Action when filtered by type */}
            {selectedTypeFilter !== 'All' && (
              <div className="barangay-density-footer">
                <span className="barangay-density-footer-note">
                  Filtering timeline, reports & map by {selectedTypeFilter}
                </span>
                <button
                  type="button"
                  className="barangay-density-map-btn"
                  onClick={() =>
                    navigate('/map', {
                      state: { selectedType: selectedTypeFilter },
                    })
                  }
                  title={`View ${selectedTypeFilter} incidents on Map`}
                >
                  <span>View on Map</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            )}
          </div>

          {/* REPORT BY BARANGAY CARD (Formerly Density by Barangay) */}
          <div className="dashboard-card barangay-report-card">
            <div className="dashboard-card-header">
              <div className="dashboard-card-titles">
                <h2 className="dashboard-card-title">Report by Barangay</h2>
                <p className="dashboard-card-subtitle">
                  All 24 barangays · Time Period: Today (22 Sep 2026)
                </p>
              </div>

              <div className="dashboard-controls-group">
                <div className="dashboard-select-wrapper">
                  <select
                    className="dashboard-select"
                    value={barangayReportType}
                    onChange={(e) => setBarangayReportType(e.target.value)}
                    aria-label="Filter barangay reports by incident type"
                  >
                    {REPORT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="dashboard-select-icon" />
                </div>
              </div>
            </div>

            {/* Scrollable list of ALL 24 barangays, ranked highest to lowest */}
            <div className="barangay-reports-scroll">
              {barangayReportItems.map((item) => {
                const barWidthPerc = Math.max(3, Math.round((item.count / maxBarangayCount) * 100));
                const barColor = getBarColor(item.count, maxBarangayCount);

                return (
                  <div
                    key={item.barangay}
                    className="barangay-report-row"
                    onClick={() =>
                      navigate('/map', {
                        state: {
                          selectedBarangay: item.barangay,
                          selectedType:
                            barangayReportType !== 'All types' ? barangayReportType : 'All Types',
                        },
                      })
                    }
                    title={`Click to view ${item.barangay} on Map (${item.count} reports)`}
                  >
                    <span className="barangay-report-name">{item.barangay}</span>
                    <div className="barangay-report-track">
                      <div
                        className="barangay-report-fill"
                        style={{
                          width: `${barWidthPerc}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                    <span className="barangay-report-val">{item.count}</span>
                  </div>
                );
              })}
            </div>

            {/* Card Footer linking to Map */}
            <div className="barangay-density-footer">
              <span className="barangay-density-footer-note">
                KDE Spatial Heatmap active in Map View
              </span>
              <button
                type="button"
                className="barangay-density-map-btn"
                onClick={() =>
                  navigate('/map?mode=Heatmap', {
                    state: {
                      mode: 'Heatmap',
                      selectedType:
                        barangayReportType !== 'All types' ? barangayReportType : 'All Types',
                    },
                  })
                }
                title="Open edge-to-edge KDE Heatmap mode"
              >
                <span>Heatmap View</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN (approx 1/3 width, sticky internally scrolling) */}
      <div className="dashboard-right-col">
        <div className="dashboard-card latest-reports-card">
          {/* Header Bar */}
          <div className="latest-reports-header">
            <h2 className="latest-reports-title">Latest Reports</h2>
            <button
              type="button"
              className="latest-reports-view-all"
              onClick={() =>
                navigate(
                  selectedTypeFilter !== 'All'
                    ? `/reports?type=${encodeURIComponent(selectedTypeFilter)}`
                    : '/reports'
                )
              }
            >
              <span>View all</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Active Filter Banner when filtered by Type Distribution slice */}
          {selectedTypeFilter !== 'All' && (
            <div className="latest-reports-filter-banner">
              <span className="latest-reports-filter-text">
                <span>Filtering by</span>
                <strong>{selectedTypeFilter}</strong>
                <span>
                  ({displayedReports.length} {displayedReports.length === 1 ? 'report' : 'reports'})
                </span>
              </span>
              <button
                type="button"
                className="latest-reports-filter-clear"
                onClick={() => handleTypeSelect(selectedTypeFilter)}
                title="Clear filter"
              >
                ✕ Clear
              </button>
            </div>
          )}

          {/* Internally scrollable list with 12px padding and gap */}
          <div className="latest-reports-scroll">
            {displayedReports.length === 0 ? (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: '#6B7A90',
                  fontSize: '13px',
                }}
              >
                No recent {selectedTypeFilter} reports logged.
              </div>
            ) : (
              displayedReports.map((report) => {
                const pillClass = getPillClass(report.type);
                const timeDisplay = formatToHTime(report);
                const photoCount = report.hasImage ? 2 : 0;

                return (
                  <div key={report.id} className="latest-report-box">
                    {/* Top row: category pill on left, time on right in mono font */}
                    <div className="latest-report-top">
                      <span className={pillClass}>{report.type}</span>
                      <span className="latest-report-time">{timeDisplay}</span>
                    </div>

                    {/* Responder Name */}
                    <div className="latest-report-responder">
                      {report.sender || 'Responder Unit'}
                    </div>

                    {/* Location line with pin icon and barangay name */}
                    <div className="latest-report-location">
                      <MapPin size={14} />
                      <span>{report.location || report.barangay}</span>
                    </div>

                    {/* Description text */}
                    <p className="latest-report-desc">{report.text}</p>

                    {/* Footer row: photo pill on left, Map button on right */}
                    <div className="latest-report-footer">
                      {photoCount > 0 ? (
                        <span className="latest-report-photo-pill">
                          <Camera size={13} />
                          <span>{photoCount} photos</span>
                        </span>
                      ) : (
                        <span />
                      )}

                      <button
                        type="button"
                        className="latest-report-map-link"
                        onClick={() =>
                          navigate('/map', {
                            state: {
                              selectedIncidentId: report.id,
                              selectedType: report.type,
                              selectedBarangay: report.barangay,
                            },
                          })
                        }
                        title={`Locate ${report.id} on map`}
                      >
                        <span>Map</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
