import React, { useState } from 'react';
import { Download, X } from 'lucide-react';

const FORMATS = ['CSV', 'XLSX', 'PDF'];

export default function ExportReportModal({ count = 3, onClose }) {
  const [selectedFormat, setSelectedFormat] = useState('CSV');

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <section className="modal">
        <button
          type="button"
          className="close"
          aria-label="Close export dialog"
          onClick={onClose}
        >
          <X />
        </button>

        <h2>Generate Incident Report</h2>
        <p>Exporting {count} incident reports matching the active filters.</p>

        <label>File format</label>
        <div className="format-buttons">
          {FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              className={selectedFormat === format ? 'active' : ''}
              style={
                selectedFormat === format
                  ? { background: '#1e293b', color: '#fff', borderColor: '#1e293b' }
                  : {}
              }
              onClick={() => setSelectedFormat(format)}
            >
              {format}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="dark wide"
          onClick={onClose}
        >
          <Download size={18} />
          <span>Download report</span>
        </button>
      </section>
    </div>
  );
}
