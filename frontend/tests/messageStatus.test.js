import test from 'node:test';
import assert from 'node:assert/strict';
import { canRetryMessage, getMessageStatus } from '../src/pages/Messaging/messageStatus.js';

test('queued messages retain the detail that they have not been transmitted', () => {
  assert.deepEqual(getMessageStatus({
    status: 'queued',
    statusDetail: 'Radio is disabled.',
  }), {
    label: 'Queued',
    detail: 'Radio is disabled.',
  });
});

test('audio completion stays distinct from receiver delivery', () => {
  assert.deepEqual(getMessageStatus({
    status: 'audio_complete',
    status_detail: 'Audio output completed; receiver delivery is unconfirmed.',
  }), {
    label: 'Audio complete',
    detail: 'Audio output completed; receiver delivery is unconfirmed.',
  });
  assert.equal(getMessageStatus({ status: 'transmitting' }).label,
    'Delivery unknown');
});

test('known pre-output failures and uncertain delivery have distinct labels', () => {
  assert.equal(getMessageStatus({ status: 'failed' }).label, 'Couldn’t Send');
  assert.equal(getMessageStatus({ status: 'delivery_unknown' }).label,
    'Delivery unknown');
  assert.equal(getMessageStatus({ status: 'canceled' }).label, 'Canceled');
});

test('demo and legacy sent messages are never represented as delivered', () => {
  assert.equal(getMessageStatus({ dataSource: 'demo', status: 'delivered' }).label,
    'Demo · not transmitted');
  assert.equal(getMessageStatus({ status: 'sent' }).label,
    'Audio complete');
});

test('only failed or uncertain radio-backed messages can be retried', () => {
  assert.equal(canRetryMessage({ status: 'failed', radioBacked: true }), true);
  assert.equal(canRetryMessage({ status: 'delivery_unknown', radio_backed: true }), true);
  assert.equal(canRetryMessage({ status: 'failed', radioBacked: false }), false);
  assert.equal(canRetryMessage({ status: 'audio_complete', radioBacked: true }), false);
});
