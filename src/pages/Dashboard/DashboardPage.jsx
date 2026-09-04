import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, BellRing } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import MetricCard from '../../components/common/MetricCard';
import ChartCard from '../../components/common/ChartCard';
import FilterSelect from '../../components/common/FilterSelect';
import {
  INCIDENTS,
  TIMELINE_DATA,
  HOURLY_DATA,
  DAILY_DATA,
  MONTHLY_DATA,
  INCIDENT_TYPE_DATA,
  CHART_COLORS,
  INCIDENT_TYPES,
  MONTH_OPTIONS,
  TYPE_FACTORS,
  MONTH_FACTORS,
  BARANGAYS,
} from '../../data/mockData';

export default function DashboardPage() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    timeline: 'All Types',
    hourly: 'All Types',
    daily: 'All Types',
    monthly: 'All Types',
    density: 'All Types',
  });

  const [selectedMonth, setSelectedMonth] = useState('All Months');

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const renderTypeFilter = (key) => (
    <FilterSelect
      label={`Filter ${key} by incident type`}
      value={filters[key]}
      onChange={(value) => handleFilterChange(key, value)}
      options={INCIDENT_TYPES}
    />
  );

  const getScaledData = (data, filterKey) => {
    const factor = TYPE_FACTORS[filters[filterKey]] ?? 1;
    return data.map((row) => ({
      ...row,
      v: Math.max(0, Math.round(row.v * factor)),
    }));
  };

  const monthIndex = MONTH_OPTIONS.indexOf(selectedMonth);
  const monthFactor = MONTH_FACTORS[monthIndex] ?? 1;

  const distributionData = INCIDENT_TYPE_DATA.map((item) => ({
    ...item,
    value: Math.max(1, Math.round(item.value * monthFactor)),
  }));

  const densityFactor = TYPE_FACTORS[filters.density] ?? 1;

  return (
    <div className="dashboard">
      <main className="dash-main">
        <h1>Monitoring Dashboard</h1>

        {/* Top Metric Cards */}
        <div className="metrics">
          <MetricCard icon={Activity} value="47" label="Total Reports Today" />
          <MetricCard icon={Activity} value="23" label="Active Incidents" />
          <MetricCard icon={BellRing} value="Fire" label="Most Reported Type" />
          <MetricCard icon={Activity} value="8" label="Pending Review" />
        </div>

        {/* Incident Timeline */}
        <ChartCard title="Incident Timeline" filter={renderTypeFilter('timeline')}>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={getScaledData(TIMELINE_DATA, 'timeline')}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="d" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="v"
                stroke="#334155"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Hourly Distribution */}
        <ChartCard
          title="Hourly Incident Distribution"
          filter={renderTypeFilter('hourly')}
        >
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={getScaledData(HOURLY_DATA, 'hourly')}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="h" interval={1} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="v" fill="#64748b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Daily & Monthly Frequency Pair */}
        <div className="chart-pair">
          <ChartCard
            title="Daily Incident Frequency"
            filter={renderTypeFilter('daily')}
          >
            <ResponsiveContainer width="100%" height={175}>
              <BarChart data={getScaledData(DAILY_DATA, 'daily')}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="n" />
                <YAxis />
                <Bar dataKey="v" fill="#475569" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Monthly Incident Frequency"
            filter={renderTypeFilter('monthly')}
          >
            <ResponsiveContainer width="100%" height={175}>
              <BarChart data={getScaledData(MONTHLY_DATA, 'monthly')}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="n" />
                <YAxis />
                <Bar dataKey="v" fill="#94a3b8" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Type Distribution & Barangay Density Pair */}
        <div className="chart-pair">
          <ChartCard
            title="Incident Type Distribution"
            filter={
              <FilterSelect
                label="Filter incident type distribution by month"
                value={selectedMonth}
                onChange={setSelectedMonth}
                options={MONTH_OPTIONS}
              />
            }
          >
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie
                  data={distributionData}
                  dataKey="value"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {distributionData.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.name}`}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Incident Density by Barangay"
            filter={renderTypeFilter('density')}
          >
            <div className="density">
              {BARANGAYS.map((name, index) => {
                const widthPercent = Math.max(
                  16,
                  Math.round((88 - index * 11) * densityFactor)
                );
                return (
                  <div key={name}>
                    <span>{name}</span>
                    <i style={{ width: `${widthPercent}%` }} />
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </div>
      </main>

      {/* Sidebar: Recent Incidents */}
      <aside className="recent">
        <div className="recent-heading">
          <h2>Recent Incident Reports</h2>
          <button
            type="button"
            className="link-button"
            onClick={() => navigate('/reports')}
          >
            View All
          </button>
        </div>

        {INCIDENTS.slice(0, 4).map((item) => (
          <article className="incident-card" key={item.id}>
            <div>
              <em>{item.type}</em>
              <small>{item.time}</small>
            </div>
            <b>{item.sender}</b>
            <code>{item.id}</code>
            <span>⌖ {item.location}</span>
            <p>{item.text}</p>
            <button
              type="button"
              onClick={() => navigate('/map?mode=Markers')}
            >
              ⌖ &nbsp; View on Map
            </button>
          </article>
        ))}
      </aside>
    </div>
  );
}
