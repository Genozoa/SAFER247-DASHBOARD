export function createRadioClient(apiBase = '/api', fetchImpl = globalThis.fetch) {
  const base = apiBase.replace(/\/$/, '');

  async function request(path, { method = 'GET', body, signal } = {}) {
    const response = await fetchImpl(`${base}/radio${path}`, {
      method,
      credentials: 'include',
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = typeof result?.detail === 'string' ? result.detail : null;
      throw new Error(detail || `Radio request failed (${response.status}).`);
    }
    if (result == null) throw new Error('The radio service returned an invalid response.');
    return result;
  }

  return {
    status: (signal) => request('/status', { signal }),
    messages: (signal) => request('/messages', { signal }),
    queue: (body) => request('/transmissions', { method: 'POST', body }),
    retry: (id) => request(`/transmissions/${encodeURIComponent(id)}/retry`, { method: 'POST' }),
    cancel: (id) => request(`/transmissions/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  };
}

export function radioStatusLabel(record) {
  if (record.status === 'received') return 'Decoded from input audio';
  return ({
    queued: 'Queued',
    preparing: 'Preparing',
    transmitting: 'Delivery unknown',
    sending: 'Sending',
    audio_complete: 'Audio complete',
    sent: 'Audio complete',
    delivered: 'Delivered',
    failed: 'Couldn’t Send',
    canceled: 'Canceled',
    delivery_unknown: 'Delivery unknown',
    encoded: 'WAV created · no audio output',
  })[record.status]
    || String(record.status || 'Unknown');
}

export function radioProtocolLabel(record) {
  if (record.kind !== 'image') return 'APRS';
  const mode = typeof record.mode === 'string' ? record.mode.trim() : '';
  return mode ? `SSTV ${mode}` : 'SSTV (mode unavailable)';
}

export function radioMediaUrl(path, apiBase = '/api') {
  if (typeof path !== 'string' || !path.startsWith('/api/radio/media/')) return null;
  return `${apiBase.replace(/\/$/, '')}${path.slice(4)}`;
}
