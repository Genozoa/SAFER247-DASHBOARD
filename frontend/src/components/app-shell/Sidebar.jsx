import React, { useState } from 'react';
import NavItem from './NavItem';
import '../../styles/app-shell.css';

const NAV_ITEMS = [
  { label: 'Overview', path: '/overview', icon: '📊' },
  { label: 'Incidents', path: '/incidents', icon: '🚨' },
  { label: 'Map', path: '/map', icon: '🗺️' },
  { label: 'Reports', path: '/reports', icon: '📄' },
  { label: 'Settings', path: '/settings', icon: '⚙️' },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className={`cc-sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
      <button
        className="cc-sidebar-toggle"
        aria-expanded={open}
        aria-controls="cc-nav-list"
        onClick={() => setOpen((s) => !s)}
      >
        <span className="sr-only">Toggle navigation</span>
        ☰
      </button>

      <ul id="cc-nav-list" className="cc-nav-list">
        {NAV_ITEMS.map((item) => (
          <li key={item.path}>
            <NavItem label={item.label} path={item.path} icon={item.icon} />
          </li>
        ))}
      </ul>

      <div className="cc-sidebar-footer">v1.0</div>
    </nav>
  );
}
