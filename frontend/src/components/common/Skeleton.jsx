import React from 'react';

/**
 * Reusable loading skeleton elements for cards, text rows, and table loaders.
 */
export function Skeleton({ width, height, borderRadius, className = '', style = {} }) {
  const customStyle = {
    width: width || '100%',
    height: height || '16px',
    borderRadius: borderRadius || 'var(--radius-sm, 6px)',
    ...style,
  };

  return <div className={`skeleton ${className}`} style={customStyle} aria-hidden="true" />;
}

export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={`skeleton-card-container ${className}`} aria-label="Loading content...">
      <div className="skeleton-card-header">
        <Skeleton width="40%" height="20px" />
        <Skeleton width="20%" height="16px" />
      </div>
      <div className="skeleton-card-body">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            width={i === lines - 1 ? '70%' : '100%'}
            height="14px"
            style={{ marginBottom: '8px' }}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTableRow({ columns = 5 }) {
  return (
    <tr className="skeleton-table-row" aria-hidden="true">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} style={{ padding: '12px 16px' }}>
          <Skeleton height="14px" width={i === 0 ? '60%' : '85%'} />
        </td>
      ))}
    </tr>
  );
}

export default Skeleton;
