# SAFER 247: Local LDRRMO deployment

## Authentication and personnel access

The Command Center uses FastAPI authentication, Argon2 password hashing, revocable HTTP-only cookie sessions, and PostgreSQL. Personnel registration requires the developer-issued registration code, initially `capstone`. Its salted Argon2 hash belongs in the backend's private root `.env`. The browser receives no registration code or hash except the code the person enters in the form.

In a backend terminal, with the virtual environment activated, generate the hash:

```powershell
python -m app.auth.registration_code
```

Enter the new code twice at the hidden terminal prompts. Copy the generated `OPERATOR_REGISTRATION_CODE_HASH=...` value into the **private** repository-root `.env`. Do not retain `OPERATOR_REGISTRATION_CODE` in the file. To rotate, run the same command again and replace the hash, then restart FastAPI. Configure `APP_ENV=production` only behind HTTPS.

The built-in throttle permits up to five registration-code verification attempts per client IP over 15 minutes, with a process-level total budget. The throttle stores counters in the API process, not in PostgreSQL. **Production requires an upstream shared rate limiter or trusted reverse proxy enforcement** if the API runs multiple processes or multiple servers. The API must not directly trust user-supplied forwarded headers. Use a longer unpredictable shared code before production. A code alone cannot attest employment, so the developer must provide it only to verified LDRRMO personnel in person.

Registration creates a normal, immediately usable command-center account. After registering, the operator signs in with their call sign and password. No approval controls or administrator account are required.

## Existing account transition

The forward revision `0009_registration_cleanup` preserves `operators.id`, call signs, Argon2 password hashes, activation flags, and authentication sessions. Accounts with previously recorded approval become code-verified during migration. Accounts without previous approval remain unverified and cannot use a session until they sign in using their existing password **and** the developer registration code. The login screen shows that one-time field after the backend identifies an unverified account with correct credentials. Accounts explicitly deactivated by LDRRMO remain blocked. Do not manually mark unknown accounts as verified.

Before migrating an existing database, back it up. With `DATABASE_URL` exported into the terminal:

```powershell
cd backend
python -m alembic -c alembic.ini current
python -m alembic -c alembic.ini upgrade head
python -m alembic -c alembic.ini current
```

Expected head: `0009_registration_cleanup`. **Do not** apply `backend/database/schema.sql` to a populated database, use `stamp head` to hide errors, or amend already-applied migration files. This migration removes obsolete account metadata while preserving existing password hashes. Recovery requires the pre-upgrade backup.

## Demo dataset

On a development database only, set `DEMO_OPERATOR_CALL_SIGN=Demo` and `DEMO_OPERATOR_PASSWORD` to a new strong password. From `backend/`, run:

```powershell
python -m app.auth.seed_demo --confirm-demo-seed
```

From repository root use `backend/database/seed_demo.sql` in pgAdmin Query Tool or `psql`. The dataset adds 120 fictional incidents and 180 fictional incoming/outgoing messages. The `Demo` operator only sees its own synthetic records. Demo accounts cannot queue, retry, or send radio traffic, nor access live radio data. Read [DEMO_DATA.md](../backend/database/DEMO_DATA.md).

## Radio image correlation

SSTV PD90 images have no authenticated incident metadata. They remain unlinked until an LDRRMO operator confirms the association through `POST /api/operations/images/{attachment_uuid}/correlate`. The backend records the operator, time, and verification notes. This manual record is not cryptographic RF sender authentication.

## Responder tracking

`GET /api/operations/responders/locations` provides recent APRS positions, but radio call signs remain unverified. The Android companion is outside this repository; do not treat reported coordinates as authenticated field GPS.

## Google basemap and automatic offline recovery

The React/Leaflet map uses the official Google Map Tiles API through authenticated FastAPI endpoints. It defaults to **Roadmap** and offers **Satellite** (unlabelled imagery) and **Terrain**. Manual Online/Offline controls are removed. Operational markers, all 24 barangay boundaries, municipal borders, and heatmaps remain separate Leaflet overlays.

Google Cloud setup:

1. Create a Google Cloud project, attach an active billing account, and enable the **Map Tiles API**.
2. Create an API key with an **API restriction** permitting only the Map Tiles API. If you restrict the key to backend server IP addresses, authorize the backend's actual public egress IP. Browser referrer restrictions are unsuitable for this server-side key.
3. Add `GOOGLE_MAP_TILES_API_KEY=YOUR_KEY` **only to the private server/root .env**, then restart FastAPI. Never add the key to `VITE_*` variables, commit it, or embed it in frontend assets.
4. Keep `OFFLINE_TILE_DIR` pointed at an independently licensed local XYZ tile set (`z/x/y.png`). Do **not** cache Google tiles for offline use.

Roadmap sessions apply the official `poi` label visibility rule plus transit-station label hiding. Google does not offer equivalent JSON styling for Satellite or Terrain. Satellite renders without Google's roadmap label overlay; Terrain may contain labels that cannot be suppressed. The renderer displays **Google Maps** branding and requests viewport-dependent copyright metadata. Do not cover these attributions with operational UI.

When the online layer fails, the frontend checks an actual local tile at the current map position and zoom, then switches automatically to the local layer only if that tile exists. Every 45 seconds, or after a browser connectivity event, it checks a real Google image response and restores the user's selected Google style if successful. Authentication or quota failures use a longer 5-minute cooldown. If neither source works, the app retains local municipal/barangay vectors and shows an accurate basemap error. The app does not save or pre-download Google imagery.

Official provider docs: [session tokens](https://developers.google.com/maps/documentation/tile/session_tokens), [styling](https://developers.google.com/maps/documentation/tile/style-reference), [attribution policy](https://developers.google.com/maps/documentation/tile/policies), and [pre-fetching/caching limits](https://developers.google.com/maps/documentation/tile/policies).


## Development commands

Install backend requirements: `python -m pip install -r app/radio_lab/requirements.txt` from `backend/`. For headless PD90 receive decoding, see `backend/app/radio_lab/README.md`.

Start API: `python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000` from `backend/`.

Install frontend: `npm ci` from `frontend/`, then start `npm run dev`. Browse `http://localhost:3000`.

Backend tests: `python -m pytest -q`. Frontend tests: `npm test`. Frontend build: `npm run build`.

All migration, test, radio hardware, Android, and deployment paths must be validated before a real emergency-response rollout.
