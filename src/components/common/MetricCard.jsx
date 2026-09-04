import React from 'react';

export default function MetricCard({ icon: Icon, value, label }) {
  return (
    <article className="metric">
      <Icon size={21} />
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}
