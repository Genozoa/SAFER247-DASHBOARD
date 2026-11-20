import React, { useState } from 'react';
import { Download, X } from 'lucide-react';

const FORMATS = ['CSV', 'XLSX', 'PDF'];

export default function ExportReportModal({ count = 3, onClose, onExport }) {
  const [selectedFormat, setSelectedFormat] = useState('CSV');
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setError('');
    setIsDownloading(true);
    try {
      await onExport(selectedFormat);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'The report could not be exported.');
      setIsDownloading(false);
    }
  };

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
              onClick={() => setSelectedFormat(format)}
            >
              {format}
            </button>
          ))}
        </div>

        {error && <p className="export-error" role="alert">{error}</p>}
        {count === 0 && <p className="muted">No matching records are available to export.</p>}

        <button
          type="button"
          className="dark wide"
          onClick={handleDownload}
          disabled={count === 0 || isDownloading}
        >
          <Download size={18} />
          <span>{isDownloading ? 'Preparing report…' : `Download ${selectedFormat}`}</span>
        </button>
      </section>
    </div>
  );
}
