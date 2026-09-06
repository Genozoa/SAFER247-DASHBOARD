import React, { useState } from 'react';
import {
  Radio,
  X,
  Compass,
  Gauge,
  Battery,
  Mountain,
  MapPin,
  Clock,
  Activity,
  Copy,
  Check,
  Navigation,
} from 'lucide-react';

export default function AprsTelemetryDrawer({ station, onClose, onFocusStation }) {
  const [copied, setCopied] = useState(false);

  if (!station) return null;

  const handleCopyPacket = () => {
    if (station.rawPacket) {
      navigator.clipboard?.writeText(station.rawPacket);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const knots = (station.speed * 0.539957).toFixed(1);
  const altitudeFeet = Math.round(station.altitude * 3.28084);

  return (
    <aside className="aprs-telemetry-drawer" aria-label="APRS Telemetry Panel">
      <div className="drawer-header">
        <div className="header-left">
          <div className="aprs-rf-tag">
            <Radio size={14} />
            <span>APRS 144.390 MHz</span>
          </div>
          <h3>{station.callsign}</h3>
          <span className="station-role-label">{station.role}</span>
        </div>
        <button
          type="button"
          className="drawer-close-btn"
          aria-label="Close APRS Drawer"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      <div className="drawer-body">
        {/* Status Pill */}
        <div className="aprs-status-banner">
          <span className="status-indicator live-pulse" />
          <div className="status-text-block">
            <strong>{station.status}</strong>
            <small>Heard {station.lastHeardSeconds || 8} seconds ago via DIGI-SFB</small>
          </div>
        </div>

        {/* Primary Gauges Grid */}
        <div className="telemetry-grid">
          {/* Speed */}
          <div className="telemetry-card">
            <div className="card-label">
              <Gauge size={14} />
              <span>Speed</span>
            </div>
            <div className="card-value">
              <span>{station.speed}</span>
              <small>km/h</small>
            </div>
            <div className="card-sub">{knots} knots</div>
          </div>

          {/* Heading */}
          <div className="telemetry-card">
            <div className="card-label">
              <Compass size={14} />
              <span>Heading</span>
            </div>
            <div className="card-value">
              <span>{station.heading}°</span>
              <small
                className="heading-arrow"
                style={{ display: 'inline-block', transform: `rotate(${station.heading}deg)` }}
              >
                ▲
              </small>
            </div>
            <div className="card-sub">Course Bearing</div>
          </div>

          {/* Altitude */}
          <div className="telemetry-card">
            <div className="card-label">
              <Mountain size={14} />
              <span>Altitude</span>
            </div>
            <div className="card-value">
              <span>{station.altitude}</span>
              <small>m ASL</small>
            </div>
            <div className="card-sub">{altitudeFeet} ft ASL</div>
          </div>

          {/* Battery */}
          <div className="telemetry-card">
            <div className="card-label">
              <Battery size={14} />
              <span>Power</span>
            </div>
            <div className="card-value">
              <span>{station.battery}</span>
            </div>
            <div className="card-sub">Telemetry VDC</div>
          </div>
        </div>

        {/* Position & Path Details */}
        <div className="telemetry-section">
          <h4>Position & RF Route</h4>
          <dl className="telemetry-dl">
            <div>
              <dt>Municipality</dt>
              <dd>San Fernando, Bukidnon</dd>
            </div>
            <div>
              <dt>Barangay</dt>
              <dd>{station.barangay}</dd>
            </div>
            <div>
              <dt>GPS Coordinates</dt>
              <dd>
                <code>{station.lat.toFixed(4)}°N, {station.lng.toFixed(4)}°E</code>
              </dd>
            </div>
            <div>
              <dt>APRS Unproto Path</dt>
              <dd>
                <code>{station.path}</code>
              </dd>
            </div>
            <div>
              <dt>Carrier Frequency</dt>
              <dd>{station.frequency}</dd>
            </div>
            <div>
              <dt>GPS Track History</dt>
              <dd>{station.trail ? `${station.trail.length} Breadcrumbs recorded` : 'Fixed Station'}</dd>
            </div>
          </dl>
        </div>

        {/* Raw APRS TNC Packet */}
        <div className="raw-packet-box">
          <div className="raw-packet-head">
            <span>Raw APRS AX.25 TNC Packet</span>
            <button
              type="button"
              className="copy-packet-btn"
              onClick={handleCopyPacket}
              title="Copy Raw Packet"
            >
              {copied ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="raw-packet-text">{station.rawPacket}</pre>
        </div>

        {/* Action Button */}
        {onFocusStation && (
          <button
            type="button"
            className="focus-station-btn"
            onClick={() => onFocusStation(station)}
          >
            <Navigation size={15} />
            <span>Center & Track Station on Map</span>
          </button>
        )}
      </div>
    </aside>
  );
}
