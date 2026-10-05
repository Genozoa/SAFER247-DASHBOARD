import React, { useState } from 'react';
import { LogOut, Check, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const [beaconActive, setBeaconActive] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutNotice, setLogoutNotice] = useState(false);

  const handleToggleBeacon = () => {
    setBeaconActive((prev) => !prev);
  };

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    setLogoutNotice(true);
    setTimeout(() => {
      setLogoutNotice(false);
    }, 4000);
  };

  return (
    <div className="page settings">
      {/* Toast Notice for actions */}
      {logoutNotice && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            right: '24px',
            zIndex: 1000,
            background: '#0f172a',
            color: '#f8fafc',
            padding: '12px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 8px 24px rgba(15,23,42,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Check size={16} color="#4ade80" />
          <span>Operator session ended. To sign back in, contact your DRRMO supervisor.</span>
        </div>
      )}

      {/* Card 1: Radio & APRS */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3>Radio &amp; APRS</h3>
          <p>Channel used for all broadcasts and tracking</p>
        </div>
        <div className="settings-card-body">
          <div className="settings-row">
            <span className="settings-row-label">APRS frequency</span>
            <span className="settings-freq-value">144.390 MHz</span>
          </div>

          <div className="settings-row">
            <span className="settings-row-label">Channel status</span>
            <div className="settings-row-value">
              <span className="settings-status-badge">
                <span className="settings-status-dot" />
                Listening
              </span>
            </div>
          </div>

          <div className="settings-row">
            <span className="settings-row-label">Beacon</span>
            <div className="settings-row-value">
              <button
                type="button"
                className={`settings-pill-btn ${beaconActive ? 'active' : ''}`}
                onClick={handleToggleBeacon}
                title="Toggle periodic RF beacon transmission"
              >
                {beaconActive ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: Command Center */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3>Command Center</h3>
          <p>Coverage and operator on duty</p>
        </div>
        <div className="settings-card-body">
          <div className="settings-row">
            <span className="settings-row-label">Municipality</span>
            <span className="settings-row-value">San Fernando, Bukidnon · 24 barangays</span>
          </div>

          <div className="settings-row">
            <span className="settings-row-label">Office</span>
            <span className="settings-row-value">LDRRMO SAFER 24/7</span>
          </div>

          <div className="settings-row">
            <span className="settings-row-label">Operator on duty</span>
            <div className="settings-row-value">
              <div className="settings-operator-info">
                <span className="settings-avatar">CC</span>
                <span className="settings-operator-name">Command Center Operator</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Session */}
      <div className="settings-card">
        <div className="settings-session-card">
          <div className="settings-session-info">
            <h3>Session</h3>
            <p>Signed in since 21 Sep 2026 · 0600H</p>
          </div>

          <button
            type="button"
            className="settings-logout-btn"
            onClick={() => setShowLogoutModal(true)}
          >
            <LogOut size={16} />
            <span>Log out</span>
          </button>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="overlay" onClick={() => setShowLogoutModal(false)}>
          <div
            className="modal"
            style={{ maxWidth: '420px', minHeight: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#fef2f2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertCircle size={20} />
              </div>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Confirm Log out</h2>
            </div>

            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
              Are you sure you want to end your current operator shift session? Active radio frequencies
              and incoming reports will remain active in the command center.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                style={{
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                style={{
                  border: '0',
                  background: '#dc2626',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
