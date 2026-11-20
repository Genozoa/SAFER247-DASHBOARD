import test from 'node:test';
import assert from 'node:assert/strict';
import { createRadioClient, radioMediaUrl, radioProtocolLabel, radioStatusLabel } from './client.js';

test('APRS submission uses the authenticated radio endpoint and JSON body', async () => {
  const calls = [];
  const client = createRadioClient('/api/', async (...args) => {
    calls.push(args);
    return { ok: true, status: 202, json: async () => ({ id: 'queued-id', status: 'queued' }) };
  });
  const payload = { kind: 'text', text: 'Ready', addressee: 'ALL' };
  assert.equal((await client.queue(payload)).status, 'queued');
  assert.equal(calls[0][0], '/api/radio/transmissions');
  assert.equal(calls[0][1].credentials, 'include');
  assert.equal(calls[0][1].method, 'POST');
  assert.deepEqual(JSON.parse(calls[0][1].body), payload);
});

test('status polling forwards cancellation and retries use escaped IDs', async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const client = createRadioClient('https://command.test/api', async (...args) => {
    calls.push(args);
    return { ok: true, json: async () => ({ enabled: true }) };
  });
  await client.status(signal);
  await client.retry('a/b');
  assert.equal(calls[0][1].signal, signal);
  assert.equal(calls[1][0], 'https://command.test/api/radio/transmissions/a%2Fb/retry');
});

test('server errors and malformed responses remain visible', async () => {
  const denied = createRadioClient('/api', async () => ({ ok: false, status: 401, json: async () => ({ detail: 'Authentication required.' }) }));
  await assert.rejects(denied.messages(), /Authentication required/);
  const malformed = createRadioClient('/api', async () => ({ ok: true, json: async () => { throw new Error('bad JSON'); } }));
  await assert.rejects(malformed.status(), /invalid response/);
});

test('media links stay on radio media routes and support an API origin', () => {
  assert.equal(radioMediaUrl('/api/radio/media/abc?variant=original', 'https://command.test/api'), 'https://command.test/api/radio/media/abc?variant=original');
  assert.equal(radioMediaUrl('javascript:alert(1)'), null);
  assert.equal(radioMediaUrl('https://foreign.test/image.png'), null);
});

test('software audio results do not claim RF delivery', () => {
  assert.equal(radioStatusLabel({ status: 'encoded' }), 'WAV created · no audio output');
  assert.equal(radioStatusLabel({ status: 'audio_complete' }), 'Audio complete');
  assert.equal(radioStatusLabel({ status: 'sent' }), 'Audio complete');
  assert.equal(radioStatusLabel({ status: 'failed' }), 'Couldn’t Send');
  assert.equal(radioStatusLabel({ status: 'delivery_unknown' }), 'Delivery unknown');
  assert.equal(radioStatusLabel({ status: 'received' }), 'Decoded from input audio');
});

test('image records show their recorded SSTV mode without assigning a mode to unknown history', () => {
  assert.equal(radioProtocolLabel({ kind: 'image', mode: 'PD90' }), 'SSTV PD90');
  assert.equal(radioProtocolLabel({ kind: 'image', mode: 'Robot36' }), 'SSTV Robot36');
  assert.equal(radioProtocolLabel({ kind: 'image', mode: null }), 'SSTV (mode unavailable)');
  assert.equal(radioProtocolLabel({ kind: 'image' }), 'SSTV (mode unavailable)');
  assert.equal(radioProtocolLabel({ kind: 'position', mode: 'PD90' }), 'APRS');
});
