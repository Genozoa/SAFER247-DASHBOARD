import React, { useState } from 'react';
import { Image, X } from 'lucide-react';
import ImageEnhancementModal from './ImageEnhancementModal';

export default function IncidentDetailDrawer({ item, onClose }) {
  const [showImageModal, setShowImageModal] = useState(false);

  if (!item) return null;

  return (
    <>
      <aside className="drawer" aria-label="Incident Details">
        <button
          type="button"
          className="close"
          aria-label="Close drawer"
          onClick={onClose}
        >
          <X />
        </button>

        <h2>Incident Details</h2>
        <em>{item.type}</em>

        <dl>
          <dt>Report ID</dt>
          <dd>{item.id}</dd>

          <dt>Sender</dt>
          <dd>{item.sender}</dd>

          <dt>Date & Time</dt>
          <dd>
            {item.date
              ? `${new Date(item.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}, ${item.time || '—'}`
              : item.time || '—'}
          </dd>

          <dt>Location</dt>
          <dd>{item.location}</dd>

          <dt>Coordinates</dt>
          <dd>{item.coordinates || (item.lat && item.lng ? `${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}` : '—')}</dd>

          <dt>Description</dt>
          <dd>{item.text}</dd>
        </dl>

        {item.hasImage && (
          <button
            type="button"
            className="image-preview"
            onClick={() => setShowImageModal(true)}
          >
            <Image />
            <span>{item.imageName || 'View received image'}</span>
          </button>
        )}
      </aside>

      {showImageModal && (
        <ImageEnhancementModal
          imageUrl={item.imageUrl}
          imageName={item.imageName}
          onClose={() => setShowImageModal(false)}
        />
      )}
    </>
  );
}
