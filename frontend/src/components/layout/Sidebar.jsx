import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Monitor,
  MessageSquare,
  Map,
  ClipboardList,
  Settings,
} from 'lucide-react';
import LogoutControl from '../common/LogoutControl';

const NAV_LINKS = [
  { to: '/', icon: Monitor, label: 'Dashboard' },
  { to: '/messaging', icon: MessageSquare, label: 'Messaging' },
  { to: '/map', icon: Map, label: 'Map View' },
  { to: '/reports', icon: ClipboardList, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ onLogout }) {
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

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav" ref={navRef}>
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
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Icon size={20} className="nav-icon" />
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <LogoutControl onLogout={onLogout} buttonClassName="logout" />
    </aside>
  );
}
