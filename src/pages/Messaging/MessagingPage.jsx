import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Image, MapPin, Send, RotateCw, AlertCircle, Search } from 'lucide-react';
import { INCIDENT_TYPES } from '../../data/mockData';

// Format 12-hour time: "10:42 AM", "3:05 PM", "12:00 PM", "12:30 AM"
// No leading zero on hour. Minutes two digits. Uppercase AM/PM separated by non-breaking space (\u00A0).
function format12HourTime(isoStringOrDate) {
  if (!isoStringOrDate) return '';
  const d = new Date(isoStringOrDate);
  if (Number.isNaN(d.getTime())) return '';
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes}\u00A0${ampm}`;
}

// Tooltip full date & time: "22 Sep 2026 · 10:42 AM"
function formatFullDateTimeTooltip(isoStringOrDate) {
  if (!isoStringOrDate) return '';
  const d = new Date(isoStringOrDate);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const time = format12HourTime(d);
  return `${day} ${month} ${year} · ${time}`;
}

// Calendar date key for day grouping: "YYYY-MM-DD"
function getCalendarDateKey(isoStringOrDate) {
  const d = new Date(isoStringOrDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Day divider label:
// "TODAY · 22 SEP 2026", "YESTERDAY · 21 SEP 2026", "MON · 19 SEP 2026", or plain "14 SEP 2026"
function formatDayDividerLabel(isoStringOrDate, now = new Date()) {
  const d = new Date(isoStringOrDate);
  if (Number.isNaN(d.getTime())) return '';

  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const dateFormatted = `${day} ${month} ${year}`;

  const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((nowMidnight.getTime() - dMidnight.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `TODAY · ${dateFormatted}`;
  }
  if (diffDays === 1) {
    return `YESTERDAY · ${dateFormatted}`;
  }
  if (diffDays > 1 && diffDays < 7) {
    const weekday = weekdays[d.getDay()];
    return `${weekday} · ${dateFormatted}`;
  }
  return dateFormatted;
}

// Relative message time:
// "Just now" (under 1 min), "N min ago" (1 to 59 min), "N h ago" (1 to 23 hours).
// Messages older than today: absolute 12-hour time (e.g. "10:42 AM").
function getRelativeOrAbsoluteTime(isoStringOrDate, now = new Date()) {
  const d = new Date(isoStringOrDate);
  if (Number.isNaN(d.getTime())) return '';

  const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isToday = dMidnight.getTime() === nowMidnight.getTime();

  if (!isToday) {
    return format12HourTime(d);
  }

  const diffMs = Math.max(0, now.getTime() - d.getTime());
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) {
    return 'Just now';
  }
  if (diffMins < 60) {
    return `${diffMins} min ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} h ago`;
  }
  return format12HourTime(d);
}

// Generates dynamic initial sample data relative to the current local device time
function generateInitialTransmissions() {
  const now = new Date();

  // Yesterday morning (10:42 AM yesterday)
  const yesterdayMorning = new Date(now);
  yesterdayMorning.setDate(now.getDate() - 1);
  yesterdayMorning.setHours(10, 42, 0, 0);

  // Yesterday afternoon (3:15 PM yesterday)
  const yesterdayAfternoon = new Date(now);
  yesterdayAfternoon.setDate(now.getDate() - 1);
  yesterdayAfternoon.setHours(15, 15, 0, 0);

  // Today hours ago (2 hours ago)
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  // Today minutes ago (35 min ago, 14 min ago, 4 min ago, 40 sec ago)
  const thirtyFiveMinsAgo = new Date(now.getTime() - 35 * 60 * 1000);
  const fourteenMinsAgo = new Date(now.getTime() - 14 * 60 * 1000);
  const fourMinsAgo = new Date(now.getTime() - 4 * 60 * 1000);
  const fortySecsAgo = new Date(now.getTime() - 40 * 1000);

  return [
    {
      id: 'tx-001',
      sender: 'Responder Bravo',
      isOutgoing: false,
      type: 'Flood',
      incidentReport: {
        code: 'RPT-2026-001228',
        type: 'Flood',
        location: 'Brgy. Kalagangan, Riverbank Zone',
        coordinates: '7.7123, 125.3074',
        details: 'Water level at Salug River monitoring post reached Alert Level 2 (3.1m). Pre-emptive advisories distributed to puroks 1 and 2.',
      },
      content: 'Salug River level rising. Low-lying riverside clusters notified of potential pre-emptive evacuation.',
      sentAt: yesterdayMorning.toISOString(),
      status: 'sent',
    },
    {
      id: 'tx-002',
      sender: 'Command Center',
      isOutgoing: true,
      content: 'Received, Responder Bravo. Continue 30-minute water logging intervals. Rescue Boat 02 and life vests staged at Poblacion EOC.',
      sentAt: yesterdayAfternoon.toISOString(),
      status: 'sent',
    },
    {
      id: 'tx-003',
      sender: 'Responder Alpha',
      isOutgoing: false,
      type: 'Fire',
      incidentReport: {
        code: 'RPT-2026-001234',
        type: 'Fire',
        location: 'Brgy. Halapitan, Purok 4 Residential',
        coordinates: '7.9137, 125.3362',
        details: 'Large structural fire involving two residential wooden structures. BFP San Fernando Engine 1 engaged.',
      },
      content: 'Large fire reported at residential area. Multiple structures affected. Requesting additional water tankers and PNP crowd cordon.',
      sentAt: twoHoursAgo.toISOString(),
      status: 'sent',
    },
    {
      id: 'tx-004',
      sender: 'Command Center',
      isOutgoing: true,
      content: 'Copy that, Responder Alpha. BFP Water Tanker 2 and PNP Station 3 units dispatched to Purok 4 intersection.',
      sentAt: thirtyFiveMinsAgo.toISOString(),
      status: 'sent',
    },
    {
      id: 'tx-005',
      sender: 'Responder Alpha',
      isOutgoing: false,
      type: 'Fire',
      content: 'Evacuation in progress. Approximately 20 families relocated to Halapitan Multi-Purpose Gym. Need ambulance support for minor smoke inhalation.',
      sentAt: fourteenMinsAgo.toISOString(),
      status: 'sent',
    },
    {
      id: 'tx-006',
      sender: 'Command Center',
      isOutgoing: true,
      content: 'Ambulance support and medical triage team routed to Halapitan Gym. ETA 6 minutes.',
      sentAt: fourMinsAgo.toISOString(),
      status: 'failed',
      retryAttempts: 1,
    },
    {
      id: 'tx-007',
      sender: 'Responder Alpha',
      isOutgoing: false,
      type: 'Fire',
      content: 'Perimeter secured. Fire contained at south flank. Awaiting paramedic team arrival.',
      sentAt: fortySecsAgo.toISOString(),
      status: 'sent',
      image: {
        filename: 'halapitan_fire_scene.jpg',
        label: 'Field photo · Halapitan Purok 4',
      },
    },
  ];
}

// Lightweight timestamp component that re-evaluates its relative label on interval ticks
function MessageTimestamp({ sentAt, currentTime }) {
  const now = useMemo(() => new Date(currentTime), [currentTime]);
  const relativeOrAbsolute = useMemo(() => getRelativeOrAbsoluteTime(sentAt, now), [sentAt, now]);
  const tooltipText = useMemo(() => formatFullDateTimeTooltip(sentAt), [sentAt]);

  return (
    <div className="msg-time-container">
      <time
        dateTime={sentAt}
        className="msg-timestamp-link"
        tabIndex={0}
        aria-label={`Sent at ${tooltipText}`}
      >
        {relativeOrAbsolute}
      </time>
      <div className="custom-tooltip" role="tooltip">
        {tooltipText}
      </div>
    </div>
  );
}

export default function MessagingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isReportsOnly = searchParams.get('channel') === 'incidents';

  const [selectedType, setSelectedType] = useState('All Types');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Real data model of transmissions
  const [transmissions, setTransmissions] = useState(() => generateInitialTransmissions());

  // Auto-refresh relative timestamps every 30 seconds
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Filter messages based on active tab and toolbar filters
  const filteredMessages = useMemo(() => {
    return transmissions.filter((item) => {
      // 1) Channel filter (All Messages vs Incident Reports)
      if (isReportsOnly && !item.incidentReport) {
        return false;
      }

      // 2) Incident Type filter (active in both channels)
      if (selectedType !== 'All Types') {
        const itemType = item.type || item.incidentReport?.type;
        if (itemType !== selectedType) {
          return false;
        }
      }

      // 3) Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesContent = item.content.toLowerCase().includes(q);
        const matchesSender = item.sender.toLowerCase().includes(q);
        const matchesCode = item.incidentReport?.code?.toLowerCase().includes(q);
        const matchesLocation = item.incidentReport?.location?.toLowerCase().includes(q);
        if (!matchesContent && !matchesSender && !matchesCode && !matchesLocation) {
          return false;
        }
      }

      // 4) Date filter (active in both channels)
      if (dateFilter) {
        const itemDateKey = getCalendarDateKey(item.sentAt);
        if (itemDateKey !== dateFilter) {
          return false;
        }
      }

      return true;
    });
  }, [transmissions, isReportsOnly, selectedType, searchQuery, dateFilter]);

  // Derive the ID of the single most recent outgoing message
  const latestOutgoingId = useMemo(() => {
    for (let i = filteredMessages.length - 1; i >= 0; i--) {
      if (filteredMessages[i].isOutgoing) {
        return filteredMessages[i].id;
      }
    }
    return null;
  }, [filteredMessages]);

  // Handle Tab Switch
  const handleTabChange = (reportsOnly) => {
    if (reportsOnly) {
      setSearchParams({ channel: 'incidents' });
    } else {
      setSearchParams({});
    }
  };

  // Transmit new message
  const handleTransmit = useCallback(() => {
    const trimmed = messageText.trim();
    if (!trimmed || isSending) return;

    const newId = `tx-${Date.now()}`;
    const newMsg = {
      id: newId,
      sender: 'Command Center',
      isOutgoing: true,
      content: trimmed,
      sentAt: new Date().toISOString(),
      status: 'sending',
    };

    setTransmissions((prev) => [...prev, newMsg]);
    setMessageText('');
    setIsSending(true);

    // Simulate realistic radio dispatch completion
    setTimeout(() => {
      setTransmissions((prev) =>
        prev.map((m) => (m.id === newId ? { ...m, status: 'sent' } : m))
      );
      setIsSending(false);
    }, 1100);
  }, [messageText, isSending]);

  // Handle Retry Transmission for failed messages
  const handleRetry = useCallback((msgId) => {
    setTransmissions((prev) =>
      prev.map((m) => {
        if (m.id === msgId) {
          return { ...m, isRetrying: true };
        }
        return m;
      })
    );

    // Realistic retry transmission
    setTimeout(() => {
      setTransmissions((prev) =>
        prev.map((m) => {
          if (m.id === msgId) {
            const currentAttempts = m.retryAttempts || 1;
            // On attempt 1, demonstrate the attempt 2 failure; on attempt 2, succeed!
            if (currentAttempts === 1) {
              return {
                ...m,
                status: 'failed',
                retryAttempts: 2,
                isRetrying: false,
              };
            }
            // Resolve successfully
            return {
              ...m,
              status: 'sent',
              isRetrying: false,
            };
          }
          return m;
        })
      );
    }, 1300);
  }, []);

  const now = useMemo(() => new Date(currentTime), [currentTime]);

  return (
    <div className="page messaging">
      {/* Fixed / Non-scrolling Compact Header & Toolbar */}
      <div className="messaging-header-compact">
        <h1>Radio Broadcast Channel</h1>

        <div className="messaging-compact-bar">
          {/* Compact Segmented Tabs (ALL / REPORTS) matching Image 2 */}
          <div className="messaging-segment-tabs" role="tablist" aria-label="Channel selection">
            <button
              type="button"
              role="tab"
              aria-selected={!isReportsOnly}
              className={!isReportsOnly ? 'active' : ''}
              onClick={() => handleTabChange(false)}
            >
              ALL
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isReportsOnly}
              className={isReportsOnly ? 'active' : ''}
              onClick={() => handleTabChange(true)}
            >
              REPORTS
            </button>
          </div>

          {/* Compact Search Bar with Search icon matching Image 2 */}
          <div className="messaging-search-wrapper">
            <Search size={16} />
            <input
              type="text"
              className="messaging-search-input"
              placeholder="Search transmissions"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search transmissions"
            />
          </div>

          {/* Date Filter (present in both channels with 'Date' label above it) */}
          <div className="messaging-filter-field">
            <span className="messaging-filter-label">Date</span>
            <div className="messaging-date-wrapper">
              <input
                type="date"
                className="messaging-date-input"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                aria-label="Filter by date"
                title="Filter transmissions by date"
              />
              {dateFilter && (
                <button
                  type="button"
                  className="messaging-date-clear-btn"
                  onClick={() => setDateFilter('')}
                  title="Clear date filter"
                  aria-label="Clear date filter"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Incident Type Filter (present in both channels with 'Incident Type' label above it) */}
          <div className="messaging-filter-field">
            <span className="messaging-filter-label">Incident Type</span>
            <select
              className="messaging-type-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              aria-label="Filter by incident type"
            >
              {INCIDENT_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Message Feed Container (Scrolls independently) */}
      <div className="feed-container">
        <div className="feed" role="log" aria-live="polite">
          {filteredMessages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
              <p>No transmissions match the selected filters.</p>
            </div>
          ) : (
            filteredMessages.map((msg, idx) => {
              const prevMsg = filteredMessages[idx - 1];
              const currentDateKey = getCalendarDateKey(msg.sentAt);
              const prevDateKey = prevMsg ? getCalendarDateKey(prevMsg.sentAt) : null;
              const showDivider = idx === 0 || currentDateKey !== prevDateKey;
              const dividerLabel = showDivider ? formatDayDividerLabel(msg.sentAt, now) : '';

              const isLatestOutgoing = msg.id === latestOutgoingId;
              const isFailed = msg.status === 'failed';
              const isSendingMsg = msg.status === 'sending';
              const isRetryingMsg = Boolean(msg.isRetrying);

              return (
                <React.Fragment key={msg.id}>
                  {/* Time Divider (Embedded in Page) */}
                  {showDivider && (
                    <div className="time-divider-container" aria-label={`Date: ${dividerLabel}`}>
                      <div className="time-divider-line" />
                      <div className="time-divider-pill">{dividerLabel}</div>
                      <div className="time-divider-line" />
                    </div>
                  )}

                  {/* Message Bubble & Status Rows */}
                  <div className="message-wrapper">
                    <article
                      className={`message ${msg.isOutgoing ? 'outgoing' : 'incoming'} ${
                        isFailed ? 'failed-bubble' : ''
                      } ${msg.image ? 'image-message' : ''}`}
                    >
                      <b>{msg.sender?.replace(/^⌁\s*/, '')}</b>

                      {/* 5. Relative / 12-Hour Absolute Timestamp with Tooltip */}
                      <MessageTimestamp sentAt={msg.sentAt} currentTime={currentTime} />

                      {/* Incident Report Card */}
                      {msg.incidentReport && (
                        <div className="report-box">
                          <code>{msg.incidentReport.code}</code>
                          <span>
                            Type: <b>{msg.incidentReport.type}</b>
                          </span>
                          <p>
                            <MapPin size={14} /> Location: {msg.incidentReport.location}
                          </p>
                          <p>Coordinates: {msg.incidentReport.coordinates}</p>
                        </div>
                      )}

                      {/* Message Content */}
                      <p>{msg.content}</p>

                      {/* Image Media Preview */}
                      {msg.image && (
                        <div className="image-placeholder">
                          <Image size={34} />
                          <span>{msg.image.filename}</span>
                        </div>
                      )}
                    </article>

                    {/* 3. Message Status Indicator: "Not transmitted" & Retry Row */}
                    {isFailed && (
                      <div className="failed-status-row" role="alert">
                        <AlertCircle size={15} className="alert-icon" />
                        <span className="status-label">
                          {isRetryingMsg
                            ? 'Transmitting…'
                            : msg.retryAttempts && msg.retryAttempts > 1
                            ? `Not transmitted · attempt ${msg.retryAttempts}`
                            : 'Not transmitted'}
                        </span>
                        <button
                          type="button"
                          className="retry-action-btn"
                          disabled={isRetryingMsg}
                          onClick={() => handleRetry(msg.id)}
                          aria-label="Retry message transmission"
                        >
                          {isRetryingMsg ? (
                            <>
                              <span className="spinner-12" />
                              <span>Retrying…</span>
                            </>
                          ) : (
                            <>
                              <RotateCw size={12} />
                              <span>Retry</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* 4. SENT / TRANSMITTING indicator ONLY under the single latest outgoing message */}
                    {isLatestOutgoing && !isFailed && (
                      <div className="latest-outgoing-indicator" aria-live="polite">
                        {isSendingMsg ? 'TRANSMITTING…' : 'SENT'}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Broadcast Composer with Transmit Button */}
      <div className="composer">
        <button type="button" className="icon-action-btn" title="Attach Image" aria-label="Attach Image">
          <Image size={18} />
        </button>
        <button type="button" className="icon-action-btn" title="Attach Location" aria-label="Attach Location">
          <MapPin size={18} />
        </button>
        <textarea
          rows={1}
          placeholder="Broadcast to all units..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleTransmit();
            }
          }}
          className="composer-textarea"
          aria-label="Broadcast message text"
        />
        <button
          type="button"
          className="transmit-btn"
          disabled={!messageText.trim() || isSending}
          onClick={handleTransmit}
          aria-label="Transmit broadcast message"
        >
          {isSending ? (
            <>
              <span className="spinner-16" />
              <span>Transmitting…</span>
            </>
          ) : (
            <>
              <span>Transmit</span>
              <Send size={15} />
            </>
          )}
        </button>
        <small>Enter sends, Shift+Enter inserts a new line. All messages are broadcast to all units.</small>
      </div>
    </div>
  );
}
