import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Monitor,
  MessageSquare,
  Map,
  ClipboardList,
  Settings,
  LogOut,
} from 'lucide-react';

const NAV_LINKS = [
  { to: '/', icon: Monitor, label: 'Dashboard' },
  { to: '/messaging', icon: MessageSquare, label: 'Messaging' },
  { to: '/map', icon: Map, label: 'Map View' },
  { to: '/reports', icon: ClipboardList, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  return (
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

      <button type="button" className="logout" onClick={() => {}}>
        <LogOut size={20} />
        <span>Logout</span>
      </button>
    </aside>
  );
}
