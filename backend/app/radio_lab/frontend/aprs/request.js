const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;

export function buildAprsTransmission({ kind, text = '', latitude, longitude, addressee = 'ALL' }) {
  if (kind !== 'text' && kind !== 'position') throw new Error('Choose APRS text or position.');
  const normalizedText = text.trim();
  const limit = kind === 'text' ? 67 : 43;
  if (kind === 'text' && !normalizedText) throw new Error('Enter APRS message text.');
  if (normalizedText.length > limit || !PRINTABLE_ASCII.test(normalizedText)) {
    throw new Error(`APRS ${kind === 'text' ? 'text' : 'comments'} must use at most ${limit} printable ASCII characters.`);
  }
  if ((kind === 'text' ? /[\{|~]/ : /\|/).test(normalizedText)) {
    throw new Error('APRS text contains reserved packet characters.');
  }
  if (kind === 'text' && /^(ack|rej)[A-Za-z0-9]{1,5}$/.test(normalizedText)) {
    throw new Error('APRS acknowledgement and rejection packets are not supported as message text.');
  }
  const request = { kind, text: normalizedText };
  if (kind === 'text') {
    const recipient = addressee.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{1,9}$/.test(recipient)) {
      throw new Error('Enter an APRS addressee of 1–9 letters, digits, underscores, or hyphens.');
    }
    request.addressee = recipient;
  } else {
    if (!['number', 'string'].includes(typeof latitude) || !['number', 'string'].includes(typeof longitude)
      || String(latitude).trim() === '' || String(longitude).trim() === '') {
      throw new Error('Enter both latitude and longitude.');
    }
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90
      || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      throw new Error('Latitude must be −90 to 90 and longitude −180 to 180.');
    }
    request.latitude = lat;
    request.longitude = lon;
  }
  return request;
}
