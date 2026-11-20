const STATUS_LABELS = {
  queued: 'Queued',
  preparing: 'Preparing',
  transmitting: 'Delivery unknown',
  sending: 'Sending',
  audio_complete: 'Audio complete',
  sent: 'Audio complete',
  delivered: 'Delivered',
  failed: 'Couldn’t Send',
  delivery_unknown: 'Delivery unknown',
  canceled: 'Canceled',
};

export function getMessageStatus(message) {
  if (message.dataSource === 'demo' || message.status === 'sample') {
    return {
      label: 'Demo · not transmitted',
      detail: 'Sample message only; it was not sent to the backend or radio queue.',
    };
  }

  const status = String(message.status || '').toLowerCase();
  return {
    label: STATUS_LABELS[status] || 'Status unavailable',
    detail: message.statusDetail || message.status_detail || '',
  };
}

export function canRetryMessage(message) {
  return Boolean(message.radioBacked || message.radio_backed)
    && ['failed', 'delivery_unknown'].includes(String(message.status || '').toLowerCase());
}
