import React from 'react';
import { X } from 'lucide-react';

export default function ImageEnhancementModal({ imageUrl, imageName, onClose }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <section className="modal image-modal">
        <button
          type="button"
          className="close"
          aria-label="Close image modal"
          onClick={onClose}
        >
          <X />
        </button>

        <h2>Incident Image</h2>
        <div className="compare">
          <b>Original received image</b>
          {imageUrl ? (
            <div className="image-placeholder">
              <img src={imageUrl} alt={imageName || 'Received incident'} />
              {imageName && <span>{imageName}</span>}
            </div>
          ) : (
            <p className="muted">The received image file is unavailable.</p>
          )}
        </div>
        <p className="muted">Image enhancement is available after image processing is connected.</p>
      </section>
    </div>
  );
}
