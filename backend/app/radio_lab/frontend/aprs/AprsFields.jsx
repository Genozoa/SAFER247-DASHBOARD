import React from 'react';

export default function AprsFields({ kind, text, setText, addressee, setAddressee, latitude, setLatitude, longitude, setLongitude }) {
  return (
    <>
      {kind === 'text' ? (
        <label>
          APRS addressee
          <input value={addressee} onChange={(event) => setAddressee(event.target.value)} maxLength={9} required />
        </label>
      ) : (
        <div className="radio-coordinate-fields">
          <label>
            Latitude
            <input type="number" min="-90" max="90" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} required />
          </label>
          <label>
            Longitude
            <input type="number" min="-180" max="180" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} required />
          </label>
        </div>
      )}
      <label>
        {kind === 'text' ? 'APRS text' : 'Position comment (optional)'}
        <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={kind === 'text' ? 67 : 43} rows={2} required={kind === 'text'} />
        <small>Printable ASCII · {text.length}/{kind === 'text' ? 67 : 43} · Reserved packet characters are unsupported.</small>
      </label>
    </>
  );
}
