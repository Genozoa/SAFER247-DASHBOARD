import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, ArrowLeft, Home, Map, MessageSquare } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="page not-found-page">
      <div className="not-found-card">
        <div className="not-found-icon-wrapper" aria-hidden="true">
          <Radio size={36} className="not-found-icon" />
          <span className="not-found-pulse-ring" />
        </div>

        <div className="not-found-badge">
          <span className="not-found-badge-dot" />
          <span>FREQUENCY OUT OF RANGE · 404</span>
        </div>

        <h1 className="not-found-title">Sector or Route Not Found</h1>

        <p className="not-found-description">
          The requested command center URL, sector, or transmission channel does
          not exist or has been relocated within the SAFER 247 network.
        </p>

        <div className="not-found-actions">
          <button
            type="button"
            className="not-found-btn-primary"
            onClick={() => navigate('/')}
          >
            <Home size={16} />
            <span>Return to Dashboard</span>
          </button>

          <button
            type="button"
            className="not-found-btn-secondary"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={16} />
            <span>Go Back</span>
          </button>
        </div>

        <div className="not-found-quick-links">
          <span className="not-found-quick-label">Or jump directly to:</span>
          <div className="not-found-links-group">
            <button
              type="button"
              className="not-found-pill-link"
              onClick={() => navigate('/map')}
            >
              <Map size={14} />
              <span>Map View</span>
            </button>
            <button
              type="button"
              className="not-found-pill-link"
              onClick={() => navigate('/messaging')}
            >
              <MessageSquare size={14} />
              <span>Messaging Channel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
