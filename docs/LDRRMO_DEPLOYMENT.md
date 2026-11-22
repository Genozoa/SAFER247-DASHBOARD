# SAFER 247: Local LDRRMO deployment

## Authentication and personnel access

SAFER 247 uses FastAPI, PostgreSQL, Argon2 password hashes, and revocable HTTP-only cookie sessions. Registration asks for a unique call sign, a strong password, and password confirmation. Users sign in with their call sign and password. No personnel code or administrator approval is required.

This simplifies local capstone testing but removes the previous personnel gate. **Anyone who reaches `/api/auth/register` can register and receive ordinary operator access.** Do not expose the application publicly for operational LDRRMO use without controlling who can access the registration endpoint, and apply upstream rate limits.

## Existing account transition

Back up PostgreSQL/PostGIS before migrating. The new `0010_remove_registration_code` revision removes the obsolete verification column. It preserves all operator identities, existing Argon2 password hashes, sessions, and active/inactive flags. Only active accounts can sign in; previously unverified active accounts will no longer need additional verification.

Run from `backend/` after loading `DATABASE_URL` into the PowerShell process:

```powershell
python -m alembic -c alembic.ini current
python -m alembic -c alembic.ini upgrade head
python -m alembic -c alembic.ini current
```

Expected head: `0010_remove_registration_code`. Do not apply the historical `schema.sql` over populated databases or rewrite applied migrations.

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

## V11 Google basemap and automatic offline recovery

The user-requested prototype restores the original V11 Leaflet tile URLs, loaded **directly by the browser** without a FastAPI Google proxy:

- **Default (Roadmap):** `https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}`
- **Satellite with labels:** `https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}`
- **Terrain:** `https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}`

The placeholders are expanded by Leaflet using subdomains 0–3. The map starts with Roadmap immediately, as in V11. It does not request a Google Cloud API key and does not require billing **to attempt these direct URLs**.

**Provider limitation:** These Google tile interfaces are undocumented, not part of the authorized Google Maps Platform integration, and could stop working or violate Google's usage terms. Do not represent this as an officially supported Google integration or assume availability for a production emergency-response service. Google currently documents that map imagery must be accessed through Google Maps Platform: [Google Maps Platform FAQ](https://developers.google.com/maps/faq). The official Map Tiles API requires Google Cloud billing and an API key. This prototype does not bypass those official requirements for authorized production use.

The existing automatic offline fallback is unchanged: when an online tile batch fails, a Satellite/Terrain view first tests Roadmap, then checks the locally stored tile for the current view. If the local tile exists, Leaflet switches to the offline layer. While offline or without a basemap, background checks run approximately every 45 seconds and restore online Roadmap only after a tile image successfully loads. A failed probe does not force a switch. Missing tiles retain the San Fernando municipality/boundary and incident overlays with a status message.

Optional offline tiles still use the existing authenticated backend endpoint `/api/maps/tiles/{z}/{x}/{y}.png`. Provision a **separately licensed** local XYZ tile directory and configure it in the private root `.env`:

```dotenv
OFFLINE_TILE_DIR=D:\\SAFER247\\offline-tiles
```

The offline pack must not contain Google tiles copied or cached from these URLs. Radio hardware is not needed for the map. For actual LDRRMO operations, use a licensed map provider or permitted tile service with reliable availability.

## Development commands

Install backend requirements: `python -m pip install -r app/radio_lab/requirements.txt` from `backend/`. For headless PD90 receive decoding, see `backend/app/radio_lab/README.md`.

Start API: `python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000` from `backend/`.

Install frontend: `npm ci` from `frontend/`, then start `npm run dev`. Browse `http://localhost:3000`.

Backend tests: `python -m pytest -q`. Frontend tests: `npm test`. Frontend build: `npm run build`.

All migration, test, radio hardware, Android, and deployment paths must be validated before a real emergency-response rollout.
