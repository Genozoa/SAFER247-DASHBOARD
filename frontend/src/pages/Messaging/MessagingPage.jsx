import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Image, MapPin, Send, RotateCw, AlertCircle, Search } from 'lucide-react';
import { INCIDENT_TYPES } from '../../data/referenceData';
import { useOperationalData } from '../../data/OperationalDataContext';
import { useAuth } from '../../auth/AuthContext';
import { formatDayDividerLabel, formatFullDateTimeTooltip, formatMessageTimestamp } from './messageTime.js';
import { canRetryMessage, getMessageStatus } from './messageStatus.js';

const MAX_MESSAGE_LENGTH = 67;

// Calendar date key for day grouping: "YYYY-MM-DD"
function getCalendarDateKey(isoStringOrDate) {
  const d = new Date(isoStringOrDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Re-evaluate timestamp labels on interval ticks as messages age.
function MessageTimestamp({ sentAt, currentTime }) {
  const now = useMemo(() => new Date(currentTime), [currentTime]);
  const timestampLabel = useMemo(() => formatMessageTimestamp(sentAt, now), [sentAt, now]);
  const tooltipText = useMemo(() => formatFullDateTimeTooltip(sentAt), [sentAt]);

  return (
    <div className="msg-time-container">
      <time
        dateTime={sentAt}
        className="msg-timestamp-link"
        tabIndex={0}
        aria-label={`Sent at ${tooltipText}`}
      >
        {timestampLabel}
      </time>
      <div className="custom-tooltip" role="tooltip">
        {tooltipText}
      </div>
    </div>
  );
}

export default function MessagingPage() {
  const { operator } = useAuth();
  const canTransmit = operator?.call_sign?.toLowerCase() !== 'demo';
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    messages: transmissions,
    sendMessage,
    retryMessage,
    error: dataError,
  } = useOperationalData();
  const isReportsOnly = searchParams.get('channel') === 'incidents';

  const [selectedType, setSelectedType] = useState('All Types');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sendError, setSendError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messageInputRef = useRef(null);

  const resizeMessageInput = useCallback(() => {
    const textarea = messageInputRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const maxHeight = Number.parseFloat(window.getComputedStyle(textarea).maxHeight);
    const contentHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(contentHeight, maxHeight)}px`;
    textarea.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useLayoutEffect(() => {
    resizeMessageInput();
  }, [messageText, resizeMessageInput]);

  useEffect(() => {
    window.addEventListener('resize', resizeMessageInput);
    return () => window.removeEventListener('resize', resizeMessageInput);
  }, [resizeMessageInput]);

  // Refresh timestamp labels every 30 seconds.
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
        const matchesSender = (item.sender || '').toLowerCase().includes(q);
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

  const [retryingMessageId, setRetryingMessageId] = useState(null);

  // Handle Tab Switch
  const handleTabChange = (reportsOnly) => {
    if (reportsOnly) {
      setSearchParams({ channel: 'incidents' });
    } else {
      setSearchParams({});
    }
  };

  // Keep manually composed drafts visible without claiming they were transmitted.
  const handleTransmit = useCallback(async () => {
    const trimmed = messageText.trim();
    if (!trimmed || isSending || !canTransmit) return;

    setIsSending(true);
    setSendError('');
    try {
      await sendMessage(trimmed);
      setMessageText('');
    } catch (error) {
      setSendError(error.message);
    } finally {
      setIsSending(false);
    }
  }, [isSending, messageText, sendMessage, canTransmit]);

  const handleRetry = useCallback(async (message) => {
    if (!canTransmit || !retryMessage || retryingMessageId) return;
    if (message.status === 'delivery_unknown'
      && !window.confirm('Delivery is unknown. Retrying may send a duplicate. Continue?')) {
      return;
    }

    setRetryingMessageId(message.id);
    setSendError('');
    try {
      await retryMessage(message.id);
    } catch (error) {
      setSendError(error.message);
    } finally {
      setRetryingMessageId(null);
    }
  }, [retryMessage, retryingMessageId, canTransmit]);

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

              const status = msg.isOutgoing ? getMessageStatus(msg) : null;
              const isFailed = ['failed', 'delivery_unknown'].includes(msg.status);

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
                      <div className="message-header">
                        <b>{msg.sender?.replace(/^⌁\s*/, '')}</b>
                        <MessageTimestamp sentAt={msg.sentAt} currentTime={currentTime} />
                      </div>

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
                      <p className="message-content">{msg.content}</p>

                      {/* Image Media Preview */}
                      {msg.image && (
                        <div className="image-placeholder">
                          {msg.image.originalUrl ? (
                            <a href={msg.image.originalUrl} target="_blank" rel="noreferrer">
                              <img src={msg.image.originalUrl} alt={msg.image.filename || 'Radio image'} style={{ maxWidth: '320px', maxHeight: '256px', objectFit: 'contain' }} />
                            </a>
                          ) : (
                            <>
                              <Image size={34} />
                              <span>{msg.image.filename}</span>
                            </>
                          )}
                        </div>
                      )}
                    </article>

                    {status && (
                      <div className={`message-status-row status-${msg.status || 'sample'}`}>
                        {isFailed && <AlertCircle size={15} className="message-status-icon" />}
                        <div>
                          <span className="message-status-label" aria-live="polite">{status.label}</span>
                          {status.detail && <small className="message-status-detail">{status.detail}</small>}
                        </div>
                        {canTransmit && canRetryMessage(msg) && (
                          <button
                            type="button"
                            className="retry-action-btn"
                            disabled={Boolean(retryingMessageId)}
                            onClick={() => handleRetry(msg)}
                            aria-label={`Retry message ${msg.id}`}
                          >
                            <RotateCw size={12} />
                            <span>{retryingMessageId === msg.id ? 'Retrying…' : 'Retry'}</span>
                          </button>
                        )}
                        {msg.attempts?.length > 0 && (
                          <details className="message-attempt-history">
                            <summary>Attempts ({msg.attempts.length})</summary>
                            <ol>
                              {msg.attempts.map((attempt) => (
                                <li key={attempt.attemptNumber || attempt.attempt_number}>
                                  <b>{attempt.status}</b>
                                  {attempt.attemptedAt || attempt.attempted_at
                                    ? ` · ${new Date(attempt.attemptedAt || attempt.attempted_at).toLocaleString()}`
                                    : ''}
                                  {(attempt.resultDetails || attempt.result_details)
                                    && <span>{attempt.resultDetails || attempt.result_details}</span>}
                                </li>
                              ))}
                            </ol>
                          </details>
                        )}
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
        {dataError && <p className="auth-alert" role="alert">{dataError}</p>}
        {sendError && <p className="auth-alert" role="alert">{sendError}</p>}
        <textarea
          ref={messageInputRef}
          rows={1}
          placeholder={canTransmit ? "Broadcast to all units..." : "Demo account cannot transmit."}
          value={messageText}
          disabled={!canTransmit}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              handleTransmit();
            }
          }}
          className="composer-textarea"
          aria-label="Broadcast message text"
        />
        <span className="transmit-btn-tooltip" title="Please enter to send">
          <span className="composer-char-count" aria-live="polite">
            {messageText.length}/{MAX_MESSAGE_LENGTH}
          </span>
          <button
            type="button"
            className="transmit-btn"
            disabled={!canTransmit || !messageText.trim() || isSending}
            onClick={handleTransmit}
            aria-label="Send broadcast message"
          >
            <span>{isSending ? 'Queuing…' : 'Send'}</span>
            <Send size={15} />
          </button>
        </span>
        <small>{canTransmit ? 'Text-only APRS broadcast. Shift+Enter inserts a new line. All sent messages reach the outgoing radio queue; RF delivery is unconfirmed.' : 'Demo account: outgoing broadcasts are disabled.'}</small>
      </div>
    </div>
  );
}
