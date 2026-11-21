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

## Online-first basemap and automatic offline recovery

Like the original V11 interface, Leaflet starts with the online **Default** road map immediately. No Google Cloud account, Google Maps API key or billing is necessary.

- **Default:** OpenStreetMap standard road tiles (`https://tile.openstreetmap.org/`), with OpenStreetMap attribution. Use for normal interactive browsing under the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/). The public service has no availability guarantee, and its tiles must not be downloaded in bulk for offline use.
- **Satellite:** NASA GIBS MODIS Terra true-colour imagery. This is lower resolution than street-level satellite photography and its dated images can be unavailable.
- **Terrain:** OpenTopoMap-R hosted by openmaps.fr. Follow the [provider tile policy](https://openmaps.fr/tile-usage-policy.html); do not prefetch tiles.

These layer buttons retain V11's familiar layout, but Google imagery is not included. Online tiles load in the browser from the individual providers with their attributions. No remote tile API key is configured on FastAPI.

When an online tile batch fails, the map first tries the keyless Default layer if another style was selected. If that also fails, the frontend probes one local tile for the current center and zoom through the existing authenticated FastAPI route `/api/maps/tiles/{z}/{x}/{y}.png`. It switches to the offline tile pack only if a real image response is available. In the background, it checks online tile availability approximately every 45 seconds while the offline layer is active or the basemap is unavailable. A browser online event triggers the same verification, not a blind switch. No repeated loops between unavailable providers are permitted.

To enable actual offline maps, set `OFFLINE_TILE_DIR` to a separately licensed, locally provisioned XYZ directory using `z/x/y.png`, for example:

```dotenv
OFFLINE_TILE_DIR=D:\\SAFER247\\offline-tiles
```

Without an offline pack or an available online provider, the local San Fernando municipality border, 24 barangay boundaries, incident markers, tracking and heatmap overlays remain visible with a concise basemap status notice. The local FastAPI route requires a valid user session. No radio hardware is necessary for map display.

For dependable emergency operations, provision your own licensed offline map pack or a provider with an availability agreement. The public keyless services are not suitable as the sole guaranteed source for critical response.

## Development commands

Install backend requirements: `python -m pip install -r app/radio_lab/requirements.txt` from `backend/`. For headless PD90 receive decoding, see `backend/app/radio_lab/README.md`.

Start API: `python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000` from `backend/`.

Install frontend: `npm ci` from `frontend/`, then start `npm run dev`. Browse `http://localhost:3000`.

Backend tests: `python -m pytest -q`. Frontend tests: `npm test`. Frontend build: `npm run build`.

All migration, test, radio hardware, Android, and deployment paths must be validated before a real emergency-response rollout.
