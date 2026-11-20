# SAFER 247 LDRRMO developer deployment guide

## Current implementation and boundaries
All account registration and operational data are database-backed. The React app has no demo-mode bypass. Backend/API and PostgreSQL/PostGIS must run for login and dashboard operation.

Only authorized San Fernando LDRRMO personnel should receive a developer registration code. A correct code **creates a pending account request only**. A human administrator must approve it. This is a prototype shared secret, not employee identity verification. Set `OPERATOR_REGISTRATION_CODE=capstone` in the **private server .env** only during the capstone prototype. Replace it before stakeholder deployment, use HTTPS, restrict network access, and add rate limiting. Never include that code in frontend/public files.

Operator roles: `viewer` reads permitted incident/message/map data, `operator` also sends/retries/cancels transmissions and manually links SSTV images, `admin` also reviews operators. Old operator rows become unapproved after migration. No account is automatically made administrator.

## Existing-database upgrade
1. Back up your PostgreSQL database before migration.
2. Confirm PostGIS is enabled and the `DATABASE_URL` environment variable points to your intended database.
3. From `backend/`, execute `python -m alembic -c alembic.ini current`, then `python -m alembic -c alembic.ini upgrade head`.
4. Verify `SELECT version_num FROM alembic_version;` returns `0008_sample_data_ownership`. The migration chain runs `0006_operator_approval`, `0007_image_correlation_audit`, and `0008_sample_data_ownership` after existing `0005_canceled_radio_status`.
5. On the developer computer, approve an existing, physically verified account as first administrator:
   `python -m app.auth.approve_operator YOUR_CALL_SIGN --role admin`
   The command prompts for the private developer registration code and never prints the code.
6. Sign in as that administrator and open **Settings > Personnel access approvals**. Verify each pending applicant's employment in person before selecting Approve. Grant only the role needed.
7. To remove a person's access, select Revoke. Existing sessions become invalid. You must review legacy accounts one by one.

## Development-only sample database
In the server's private `.env` set `DEMO_OPERATOR_CALL_SIGN=Demo` and a unique strong `DEMO_OPERATOR_PASSWORD`. Then from `backend/` run `python -m app.auth.seed_demo --confirm-demo-seed` (development mode only). From the repository root, run the SQL file `backend/database/seed_demo.sql` using psql connected to the development database. It adds 120 synthetic incidents and 180 synthetic messages. Only the approved viewer `Demo` account sees these records. There is no frontend-generated demo data and no real transmission from the synthetic messages. **Do not run against production**.

## Radio image correlation
SSTV PD90 audio does not supply authenticated incident metadata. Received images stay unlinked by default. A verified LDRRMO operator must independently check the sender/report through a trusted procedure and use `POST /api/operations/images/{attachment_uuid}/correlate` with `{"report_code":"...", "confirm":true, "verification_notes":"..."}`. The API records reviewer, time and notes. It **does not** cryptographically authenticate the RF sender. A dedicated UI for the manual review is not yet implemented.

## Responder tracking
`GET /api/operations/responders/locations` serves recent APRS-derived coordinates to signed-in operators and connects to the Map tracking view. These beacons are **not cryptographically authenticated**. The user interface identifies them as unverified radio observations, not verified officer GPS. The companion Android app's secure positional identity remains outside this repository.

## Offline maps
The map defaults to local XYZ tiles via `/api/maps/tiles/{z}/{x}/{y}.png`. Set `OFFLINE_TILE_DIR` to an existing legally sourced and pre-provisioned folder containing `z/x/y.png`. The API checks access via operator session. Without an installed tile pack, the offline base layer is blank, although municipal/barangay outlines still render. Online Google layers remain optional and depend on the internet, so this is an **offline tile-serving foundation**, not an out-of-the-box offline street map. Do not bulk-download Google tiles without appropriate licensing.

## Polling, scaling, and access
Operations lists default to 500 rows and accept `limit` (1 to 500) and `offset`. Frontend refreshes every 10 seconds only in visible tabs. Large-history UI pagination and actual real-time push are not implemented. Retain archives in PostgreSQL; do not confuse dashboard limit with full historical totals.

## Run and verify
- Backend: `python -m pytest -q` from `backend/`
- Frontend: `npm ci && npm test && npm run build` from `frontend/`
- Migrations: `python -m alembic -c alembic.ini upgrade head` from `backend/` after a backup
- CI: `.github/workflows/ci.yml` installs Python and Node dependencies and runs backend/frontend checks on GitHub.

This branch has **not** been verified with live PostGIS migration, radio hardware, Android, or pre-provisioned offline tiles. Do not merge/deploy without these checks.

## Cleanup
`frontend/src/data/demoData.js` and `frontend/src/data/operationalData.js` were removed from runtime. Sample data fixtures now live under `frontend/tests/fixtures/`. The original `backend/database/schema.sql` is historical and does not include the latest migrations. Always use Alembic to upgrade existing databases.
