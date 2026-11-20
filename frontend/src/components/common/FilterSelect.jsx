import React from 'react';

export default function FilterSelect({ label, value, onChange, options }) {
  return (
    <select
      className="mini-filter"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
