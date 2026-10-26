import React, { useState, useEffect } from 'react';
import { Clock, UserRound } from 'lucide-react';

export default function Header() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDateTime = (date) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = date.toLocaleDateString('en-US', options);
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const hoursStr = String(hours).padStart(2, '0');
    return `${dateStr} - ${hoursStr}:${minutes}:${seconds} ${ampm}`;
  };

  return (
    <header className="header">
      <div className="brand">
        <img
          src="/images/LDRRMO_SAFER247_Logo.svg"
          alt="SAFER 247 Logo"
          className="brand-logo"
        />
        <b>Command Center</b>
      </div>

      <div className="header-right">
        <span className="live-clock" title="Live Command Center Time">
          <Clock size={15} />
          <span>{formatDateTime(currentTime)}</span>
        </span>
        <span className="operator">
          <UserRound size={16} />
          <span>Command Center Operator</span>
        </span>
      </div>
    </header>
  );
}
