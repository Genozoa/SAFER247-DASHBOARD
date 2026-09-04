import React, { useState } from 'react';
import { Image, X } from 'lucide-react';

export default function ImageEnhancementModal({ onClose }) {
  const [isEnhanced, setIsEnhanced] = useState(false);

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

        <h2>{isEnhanced ? 'Image Enhancement' : 'Incident Image'}</h2>

        <div className={`compare ${isEnhanced ? 'two' : ''}`}>
          <div>
            <b>Original received image</b>
            <div className="image-placeholder">
              <Image size={50} />
              <span>incident_photo.jpg</span>
            </div>
          </div>

          {isEnhanced && (
            <div>
              <b>
                Enhanced image <small>Saved</small>
              </b>
              <div className="image-placeholder enhanced">
                <Image size={50} />
                <span>enhanced_incident_photo.jpg</span>
              </div>
            </div>
          )}
        </div>

        {!isEnhanced ? (
          <button
            type="button"
            className="dark right"
            onClick={() => setIsEnhanced(true)}
          >
            ⌕ Enhance Image
          </button>
        ) : (
          <p className="success">
            Enhancement complete. The original is preserved and the enhanced output is saved.
          </p>
        )}
      </section>
    </div>
  );
}
