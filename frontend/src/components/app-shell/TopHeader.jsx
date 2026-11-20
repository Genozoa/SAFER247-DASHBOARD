import React from 'react';
import useDateTime from '../../hooks/useDateTime';
import OperatorProfile from './OperatorProfile';

export default function TopHeader() {
  const dateTime = useDateTime();

  return (
    <header className="cc-top-header" role="banner">
      <div className="cc-top-left">
        <img src="/images/LDRRMO_SAFER247_Logo.svg" alt="SAFER 247 logo" className="cc-logo" />
        <div className="cc-title">
          <div className="cc-name">Command Center</div>
          <div className="cc-sub">Operational Dashboard</div>
        </div>
      </div>

      <div className="cc-top-right">
        <div className="cc-datetime" aria-live="polite">{dateTime}</div>
        <OperatorProfile />
      </div>
    </header>
  );
}
