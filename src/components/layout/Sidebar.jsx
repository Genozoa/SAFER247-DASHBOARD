import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Monitor,
  MessageSquare,
  Map,
  ClipboardList,
  Settings,
  LogOut,
  AlertCircle,
  Check,
} from 'lucide-react';

const NAV_LINKS = [
  { to: '/', icon: Monitor, label: 'Dashboard' },
  { to: '/messaging', icon: MessageSquare, label: 'Messaging' },
  { to: '/map', icon: Map, label: 'Map View' },
  { to: '/reports', icon: ClipboardList, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutNotice, setLogoutNotice] = useState(false);

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    setLogoutNotice(true);
    setTimeout(() => {
      setLogoutNotice(false);
    }, 4000);
  };

  return (
    <>
      <aside className="sidebar">
        <nav>
          {NAV_LINKS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="logout"
          onClick={() => setShowLogoutModal(true)}
          title="End Command Center session"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </aside>

      {/* Toast Notice for logout */}
      {logoutNotice && (
        <div className="toast-notification">
          <Check size={16} className="toast-icon-success" />
          <span>Operator session ended. To sign back in, contact your DRRMO supervisor.</span>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="overlay" onClick={() => setShowLogoutModal(false)}>
          <div
            className="modal confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-dialog-header">
              <div className="confirm-dialog-icon-danger">
                <AlertCircle size={20} />
              </div>
              <h2 className="confirm-dialog-title">Confirm Log out</h2>
            </div>

            <p className="confirm-dialog-description">
              Are you sure you want to end your current operator shift session? Active radio frequencies
              and incoming reports will remain active in the command center.
            </p>

            <div className="confirm-dialog-actions">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="confirm-btn-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="confirm-btn-danger"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
