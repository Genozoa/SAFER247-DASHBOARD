import React from 'react';

export default function ChartCard({ title, filter, children }) {
  return (
    <section className="chart-card">
      <div className="card-title">
        <span>{title}</span>
        {filter}
      </div>
      {children}
    </section>
  );
}
