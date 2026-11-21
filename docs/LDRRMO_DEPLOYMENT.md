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

## Online basemap and automatic offline recovery

The map retains the familiar V11 Leaflet controls and San Fernando coordinates, while
preserving the newer incident markers, APRS responder trails, KDE heatmap, and all 24 barangay
boundaries. **Roadmap uses OpenStreetMap Standard raster tiles** at
`https://tile.openstreetmap.org/{z}/{x}/{y}.png`. This standard public service does not
require a Google Cloud account, billing, or Google API key for ordinary interactive use.

The old V11 directly requested `mt{s}.google.com/vt` raster tiles without an API key.
Those endpoints were not an approved integration, so they are deliberately not reused.
The supported Google Map Tiles API integration is also removed from this branch because
its API key and billing requirements conflict with the default no-key map goal.

**Usage terms:** OpenStreetMap data carries ODbL attribution requirements. The browser
sends normal tile requests (including Referer as permitted by the browser), honours
cache headers, displays an OpenStreetMap copyright link through Leaflet, and does not
bulk-download or prefetch tiles. The OSMF tile service is best-effort and has no SLA.
Do not use it as the sole live disaster-response basemap or for heavy institutional
traffic without a dedicated provider or self-hosted tile service. Official policies:
https://operations.osmfoundation.org/policies/tiles/
https://www.openstreetmap.org/copyright

The Roadmap layer includes place names, roads, natural features, and some renderer-supplied
POIs. Raster labels cannot be individually hidden. A configured vector basemap or
self-hosted renderer would be necessary for selective POI removal. Satellite and Terrain
are intentionally not offered without verified, licensed imagery services; a street map
is not mislabelled as either one. CARTO Voyager is not used as a free no-key substitute
because CARTO now requires an API key.

**Automatic fallback:** A complete online tile failure triggers one bounded live
tile check and then tests a local tile at the current map center/zoom using
`/api/maps/tiles/{z}/{x}/{y}.png`. If `OFFLINE_TILE_DIR` has a licensed XYZ tile
pack covering the view, the map switches to it without user interaction. If neither
works, the existing municipal/barangay vectors and operational markers remain visible
with an accurate basemap message. Every 60 seconds (or on browser connectivity/
visibility events) a real online tile response is checked before restoring Roadmap,
without resetting map center, zoom, filters, or overlays. Provider denial or rate-limit
responses receive a five-minute cooldown. No online imagery is preloaded into offline
storage. Avoid interpreting `navigator.onLine` alone as proof of tile availability.

The current offline directory is configured privately as
`OFFLINE_TILE_DIR=...\z\x\y.png` (directory holding level subdirectories).
Tile packs must include their own legally required attribution. No database migration
or radio hardware is required to show the map.
 
## Development commands

Install backend requirements: `python -m pip install -r app/radio_lab/requirements.txt` from `backend/`. For headless PD90 receive decoding, see `backend/app/radio_lab/README.md`.

Start API: `python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000` from `backend/`.

Install frontend: `npm ci` from `frontend/`, then start `npm run dev`. Browse `http://localhost:3000`.

Backend tests: `python -m pytest -q`. Frontend tests: `npm test`. Frontend build: `npm run build`.

All migration, test, radio hardware, Android, and deployment paths must be validated before a real emergency-response rollout.
