import React from 'react';
import { isActive } from '../../utils/navHelpers';

export default function NavItem({ label, path, icon }) {
  const active = isActive(path);

  return (
    <a
      href={path}
      className={`cc-nav-item ${active ? 'active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <span className="cc-nav-icon" aria-hidden>{icon}</span>
      <span className="cc-nav-label">{label}</span>
    </a>
  );
}
