# Frontend radio integration

In API mode, the Messaging composer submits broadcast APRS text through the
operations API. Demo mode uses local sample behavior. Authenticated requests to
`/api/radio/transmissions` support APRS text and positions. SSTV is receive-only:
decoded images are available through the normal authenticated message feed and
media endpoints.

The frontend helpers in this directory validate APRS input and communicate
with the authenticated radio API. The Vite
configuration deduplicates React and permits imports from this source directory.

Run frontend checks from `frontend/`:

```sh
npm test
npm run build
node --test ../backend/app/radio_lab/frontend/client.test.js ../backend/app/radio_lab/frontend/aprs/request.test.js
```

These tests cover request routing, visible API failures, APRS input limits,
received SSTV mode labels, and software-only status labels. They do not verify
browser rendering, radio hardware, or Android interoperability.
