# SAFER 247 radio implementation deliverables

## Core radio additions and edits

### Added
- `backend/alembic/versions/0005_canceled_radio_status.py`
- `package.json`

### Radio lab edits
- `backend/app/radio_lab/aprs/codec.py`
- `backend/app/radio_lab/aprs/tests/test_codec.py`
- `backend/app/radio_lab/api.py`
- `backend/app/radio_lab/repository.py`
- `backend/app/radio_lab/runtime.py`
- `backend/app/radio_lab/schemas.py`
- `backend/app/radio_lab/frontend/client.js`
- `backend/app/radio_lab/README.md`
- `backend/app/radio_lab/TEST_RESULTS.md`

### Integration edits outside radio_lab
- `backend/app/db/models.py`: canceled radio states.
- `backend/app/operations/api.py`: incident image rendering and location-unavailable display.
- `frontend/src/pages/Messaging/MessagingPage.jsx`: completed radio image attachment in the normal feed.
- `Run-SAFER247.ps1`: starts API, frontend, and opt-in radio worker.
- `.env.example`: radio and native-Windows configuration variables.

The normal Messaging composer supports broadcast APRS text. Authenticated radio
API requests support APRS positions. SSTV is receive-only; decoded incoming
images remain persisted and displayed in the normal feed.

## Verification

- Windows Python/APRS/SSTV/runtime/API suite: 75 passed, 34 skipped, 0 failed.
- Frontend unit suite: 23 passed.
- Radio frontend unit suite: 13 passed.
- Frontend production build: passed.
- Hardware RF, USB audio, PTT/VOX, Android, and live Windows capture/playback remain unverified.
