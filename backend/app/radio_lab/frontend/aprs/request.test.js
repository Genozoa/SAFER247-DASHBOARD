import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAprsTransmission } from './request.js';

test('APRS text keeps its protocol distinct and normalizes the addressee', () => {
  assert.deepEqual(buildAprsTransmission({ kind: 'text', text: ' Ready ', addressee: ' all ' }), {
    kind: 'text', text: 'Ready', addressee: 'ALL',
  });
});

test('APRS positions preserve zero and signed geographic coordinates', () => {
  assert.deepEqual(buildAprsTransmission({ kind: 'position', latitude: '0', longitude: '-125.25' }), {
    kind: 'position', text: '', latitude: 0, longitude: -125.25,
  });
});

test('invalid APRS inputs fail before posting a job', () => {
  for (const payload of [
    { kind: 'image', text: 'invalid protocol' },
    { kind: 'text', text: ' ' },
    { kind: 'text', text: 'x'.repeat(68) },
    { kind: 'text', text: 'new\nline' },
    { kind: 'text', text: 'non-ASCII é' },
    { kind: 'text', text: 'packet{123' },
    { kind: 'text', text: 'ack12' },
    { kind: 'text', text: 'ready', addressee: 'bad:frame' },
    { kind: 'position', latitude: '', longitude: '125' },
    { kind: 'position', latitude: null, longitude: '125' },
    { kind: 'position', latitude: false, longitude: '125' },
    { kind: 'position', latitude: '91', longitude: '125' },
    { kind: 'position', latitude: '7', longitude: Infinity },
    { kind: 'position', latitude: '7', longitude: '181' },
    { kind: 'position', latitude: '7', longitude: '125', text: 'x'.repeat(44) },
  ]) assert.throws(() => buildAprsTransmission(payload));
});
