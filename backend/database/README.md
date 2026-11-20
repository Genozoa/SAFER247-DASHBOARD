# SAFER 247 PostgreSQL and PostGIS database

This project uses SQLAlchemy 2, PostgreSQL, PostGIS, and Alembic. The current migration head is **0008_sample_data_ownership**. Use Alembic migrations to update a database. The historical `schema.sql` is a baseline snapshot, not a replacement for migrations.

## Configuration
Create a private `.env` file at the repository root. Copy keys from `.env.example` and replace placeholder values. Never commit real credentials. Set:
- `DATABASE_URL` to your PostgreSQL/PostGIS connection URL
- `PASSWORD_FINGERPRINT_SECRET` to a stable random value of at least 32 bytes
- `OPERATOR_REGISTRATION_CODE` to the privately distributed prototype value, initially `capstone`, then rotate before production
- `APP_ENV` to `development` locally or `production` for deployment
- `RADIO_ENABLED=false` until radio hardware and permission settings are configured

## Migrate
Back up the database first. From the `backend` directory with the virtual environment active and `DATABASE_URL` exported into the process environment:

```powershell
python -m alembic -c alembic.ini current
python -m alembic -c alembic.ini upgrade head
```

Expected current revision: `0008_sample_data_ownership`. The chain includes:
- 0001 initial schema
- 0002 auth session metadata
- 0003 single call sign
- 0004 transmission statuses
- 0005 canceled radio status
- 0006 operator approval and role permission
- 0007 manually reviewed image association audit
- 0008 synthetic sample ownership

Never run `schema.sql` against an existing database. Never `stamp head` merely to silence an error. Confirm extension, schema, migration version, and backup before continuing.

## Roles and registration
Registration requires the private developer code and creates a **pending**, unapproved account. Administrators approve real LDRRMO personnel from Settings. Roles: `viewer`, `operator`, `admin`; only operator/admin users transmit; only admins manage approvals. Legacy operators are unapproved after 0006 until a developer reviews them. Bootstrap the initial trusted admin locally:

```powershell
python -m app.auth.approve_operator YOUR_CALL_SIGN --role admin
```

The command prompts for the developer code. The registration code itself does not prove employment. Verify each staff member in person. Session tokens use hashed, revocable, expiring HTTP-only cookies. Passwords use Argon2; the separate keyed HMAC password fingerprint is for password-uniqueness enforcement.

## Development fixtures
Create the Demo viewer account with explicit opt-in, then execute `backend/database/seed_demo.sql` against a development PostgreSQL database. The SQL populates synthetic records only for the Demo account. Read [DEMO_DATA.md](DEMO_DATA.md). These records never trigger RF transmissions.

## Operations and RF
Operations endpoints include `/api/operations/incidents`, `/api/operations/messages`, and `/api/operations/responders/locations`. Lists accept bounded `limit` and `offset`; the frontend requests the latest 500 rows and polls every 10 seconds while visible.

Received SSTV image files are separate from database metadata and never automatically paired to an incident based on recency. Explicit manual review produces an audit trail; the radio source remains unverified. APRS position packets likewise carry unverified sender identities.

See [LDRRMO deployment guide](../../docs/LDRRMO_DEPLOYMENT.md) for detailed startup, privacy, radio, and offline map procedures.

## Tests
From `backend`: `python -m pytest -q`. Run PostgreSQL/PostGIS migration tests separately; SQLite unit tests do not prove geographic SQL behavior.
