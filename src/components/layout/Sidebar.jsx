import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  const location = useLocation();
  const navRef = useRef(null);
  const [sliderPos, setSliderPos] = useState({ top: 0, height: 48, opacity: 0 });

  const updateSlider = useCallback(() => {
    if (!navRef.current) return;
    const activeLink = navRef.current.querySelector('.nav-link.active');
    if (activeLink) {
      setSliderPos({
        top: activeLink.offsetTop,
        height: activeLink.offsetHeight,
        opacity: 1,
      });
    } else {
      setSliderPos((prev) => ({ ...prev, opacity: 0 }));
    }
  }, []);

  useEffect(() => {
    // Schedule after React DOM flush
    const frameId = requestAnimationFrame(() => {
      updateSlider();
    });
    return () => cancelAnimationFrame(frameId);
  }, [location.pathname, updateSlider]);

  useEffect(() => {
    window.addEventListener('resize', updateSlider);
    return () => window.removeEventListener('resize', updateSlider);
  }, [updateSlider]);

  const handleNavClick = (e) => {
    const el = e.currentTarget;
    if (el) {
      setSliderPos({
        top: el.offsetTop,
        height: el.offsetHeight,
        opacity: 1,
      });
    }
  };

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
        <nav className="sidebar-nav" ref={navRef}>
          {/* Animated sliding background pill */}
          <div
            className="sidebar-nav-slider"
            style={{
              transform: `translateY(${sliderPos.top}px)`,
              height: `${sliderPos.height}px`,
              opacity: sliderPos.opacity,
            }}
            aria-hidden="true"
          />

          {NAV_LINKS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={handleNavClick}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} className="nav-icon" />
              <span className="nav-label">{label}</span>
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
          <span>Log out</span>
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
