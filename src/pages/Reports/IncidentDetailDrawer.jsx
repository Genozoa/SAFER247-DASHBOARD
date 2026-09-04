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
          <dd>May 3, 2026, {item.time}</dd>

          <dt>Location</dt>
          <dd>{item.location}</dd>

          <dt>Coordinates</dt>
          <dd>14.5995, 120.9842</dd>

          <dt>Description</dt>
          <dd>{item.text}</dd>
        </dl>

        <button
          type="button"
          className="image-preview"
          onClick={() => setShowImageModal(true)}
        >
          <Image />
          <span>incident_photo.jpg</span>
        </button>
      </aside>

      {showImageModal && (
        <ImageEnhancementModal onClose={() => setShowImageModal(false)} />
      )}
    </>
  );
}
