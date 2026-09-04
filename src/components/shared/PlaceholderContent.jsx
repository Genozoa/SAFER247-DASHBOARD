import React from 'react';

export default function PlaceholderContent({ title = 'Module content will be added here.' }) {
  return (
    <section className="cc-placeholder">
      <img src="/images/incident-placeholder.png" alt="placeholder" className="cc-placeholder-img" />
      <h2>{title}</h2>
      <p className="muted">Use this area to render module-specific UI. Replace PlaceholderContent when the real component is ready.</p>
    </section>
  );
}
