import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Image, MapPin, Send } from 'lucide-react';
import { INCIDENT_TYPES } from '../../data/mockData';

export default function MessagingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isReportsOnly = searchParams.get('channel') === 'incidents';

  const [date, setDate] = useState('2026-05-03');
  const [selectedType, setSelectedType] = useState('All Types');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isRetried, setIsRetried] = useState(false);

  const handleTabChange = (reportsOnly) => {
    if (reportsOnly) {
      setSearchParams({ channel: 'incidents' });
    } else {
      setSearchParams({});
    }
  };

  const matchesType = (type) => selectedType === 'All Types' || selectedType === type;

  return (
    <div className="page messaging">
      <h1>
        <i />
        <span>Radio Broadcast Channel</span>
      </h1>

      <p className="muted">
        {isReportsOnly
          ? 'Incident reports transmitted by all units'
          : 'All transmissions are visible to all units'}
      </p>

      {/* Message Tabs */}
      <div className="message-tabs" style={{ display: 'flex' }}>
        <button
          type="button"
          className={!isReportsOnly ? 'selected' : ''}
          onClick={() => handleTabChange(false)}
        >
          All Messages
        </button>
        <button
          type="button"
          className={isReportsOnly ? 'selected' : ''}
          onClick={() => handleTabChange(true)}
        >
          Incident Reports
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="toolbar">
        <input
          type="text"
          placeholder="⌕  Search transmissions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <label className="date-filter">
          <span>Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <label className="type-filter">
          <span>Incident Type</span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            {INCIDENT_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Message Feed */}
      <div className="feed">
        {/* Incident Report Message */}
        {matchesType('Fire') && (
          <article className="message incoming">
            <b>⌁ Responder Alpha</b>
            <small>10:42 AM</small>
            <div className="report-box">
              <code>RPT-2026-001234</code>
              <span>
                Type: <b>Fire</b>
              </span>
              <p>
                <MapPin size={14} /> Location: Brgy. San Antonio
              </p>
              <p>Coordinates: 14.5995, 120.9842</p>
            </div>
            <p>
              Large fire reported at residential area. Multiple structures affected.
              Requesting additional units.
            </p>
          </article>
        )}

        {/* Regular Transmission Messages (Visible in All Messages) */}
        {!isReportsOnly && (
          <>
            {matchesType('All Types') && (
              <article className="message outgoing">
                <b>Command Center</b>
                <small>10:43 AM</small>
                <p>Copy that, Responder Alpha. What is the current status of evacuations?</p>
              </article>
            )}

            <article className="message incoming">
              <b>⌁ Responder Alpha</b>
              <small>10:44 AM</small>
              <p>
                Evacuation in progress. Approximately 20 families affected. Need
                ambulance support.
              </p>
            </article>

            {/* Outgoing Message with Failure / Retry Simulation */}
            {!isRetried ? (
              <article className="message outgoing failed">
                <b>Command Center</b>
                <small>10:46 AM</small>
                <p>Ambulance support is being coordinated.</p>
                <div className="retry-status">
                  <button
                    type="button"
                    aria-label="Retry message transmission"
                    onClick={() => setIsRetried(true)}
                  >
                    ↻
                  </button>
                  <span>ⓘ &nbsp; Not Transmitted</span>
                </div>
              </article>
            ) : (
              <article className="message outgoing">
                <b>Command Center</b>
                <small>10:46 AM</small>
                <p>Ambulance support is being coordinated.</p>
              </article>
            )}

            {/* Incoming Media Transmission */}
            <article className="message incoming image-message">
              <b>⌁ Responder Alpha</b>
              <small>10:45 AM</small>
              <div className="image-placeholder">
                <Image size={36} />
                <span>incident_photo.jpg</span>
              </div>
            </article>
          </>
        )}
      </div>

      {/* Broadcast Composer */}
      <div className="composer">
        <button type="button" title="Attach Image">
          <Image size={19} />
        </button>
        <button type="button" title="Attach Location">
          <MapPin size={19} />
        </button>
        <input
          type="text"
          placeholder="Broadcast to all units..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && messageText.trim()) {
              setMessageText('');
            }
          }}
        />
        <button
          type="button"
          className="send"
          onClick={() => {
            if (messageText.trim()) setMessageText('');
          }}
        >
          <Send size={20} />
        </button>
        <small>All messages are broadcast to all active units</small>
      </div>
    </div>
  );
}
