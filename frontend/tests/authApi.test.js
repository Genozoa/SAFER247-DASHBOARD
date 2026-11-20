import assert from 'node:assert/strict';
import test from 'node:test';

import { authRequest } from '../src/auth/authApi.js';

test('keeps an unauthenticated session check distinguishable from service errors', async () => {
  const fetchImplementation = async () => ({
    status: 401,
    ok: false,
    json: async () => ({ detail: 'Authentication required.' }),
  });

  await assert.rejects(
    authRequest('/api', '/auth/me', {}, fetchImplementation),
    { message: 'Authentication required.' },
  );
});

test('explains non-JSON backend errors instead of showing a generic request error', async () => {
  const fetchImplementation = async () => ({
    status: 502,
    ok: false,
    json: async () => {
      throw new SyntaxError('Not JSON');
    },
  });

  await assert.rejects(
    authRequest('/api', '/auth/me', {}, fetchImplementation),
    {
      message: 'Authentication service is unavailable (HTTP 502). Check that the backend API is running.',
    },
  );
});

test('explains when the browser cannot connect to the backend', async () => {
  const fetchImplementation = async () => {
    throw new TypeError('Failed to fetch');
  };

  await assert.rejects(
    authRequest('/api', '/auth/login', {}, fetchImplementation),
    {
      message: 'Cannot reach the authentication service. Check that the backend API is running.',
    },
  );
});

test('renders FastAPI validation details instead of replacing them with a generic error', async () => {
  const fetchImplementation = async () => ({
    status: 422,
    ok: false,
    json: async () => ({
      detail: [{ msg: 'Password is required.' }, { msg: 'Call sign is required.' }],
    }),
  });

  await assert.rejects(
    authRequest('/api', '/auth/register', {}, fetchImplementation),
    { message: 'Password is required. Call sign is required.' },
  );
});
