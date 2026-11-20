> **Current deployment instructions:** See [docs/LDRRMO_DEPLOYMENT.md](../../docs/LDRRMO_DEPLOYMENT.md). This file contains older prototype notes. Apply Alembic through 0008, never rely on historical schema.sql for upgrades.

# SAFER 247 database and persistence layer

The backend persistence layer uses SQLAlchemy 2.x and PostgreSQL with the
PostGIS extension for incident, barangay, and responder geospatial data.
`schema.sql` remains the reference schema; the ORM mappings and initial Alembic
revision match its tables, constraints, and indexes.

## Requirements and configuration

Install PostgreSQL and the PostGIS package matching its version. In PowerShell,
from the `backend` directory, create a virtual environment and install the
backend dependencies:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

From the repository root, copy `.env.example` to `.env` (if `.env` already
exists, edit it instead of overwriting it):

```powershell
Copy-Item .env.example .env
```

Replace the example database credentials and generate a private
`PASSWORD_FINGERPRINT_SECRET` of at least 32 bytes. Never commit `.env` or use
the example database credentials. Generate a key locally with:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

`APP_ENV=production` enables secure session cookies and disables the demo seed
command.

The configured database account must be able to connect and create tables and
indexes. The initial migration enables PostGIS if the account is permitted to
create extensions; otherwise, have a database administrator enable PostGIS
first.

## Create or upgrade the schema

Alembic reads `DATABASE_URL` from the process environment; it does not load the
root `.env` file itself. From a PowerShell terminal in `backend`, set the same
connection URL as in `.env` before running the migration. Replace the
placeholders with your local PostgreSQL connection values:

```powershell
$env:DATABASE_URL = "postgresql+psycopg://<POSTGRES_USER>:<URL_ENCODED_PASSWORD>@localhost:5432/safer247_db"
python -m alembic -c alembic.ini upgrade head
```

The environment variable applies only to that terminal. Set it again in any
new terminal before running Alembic commands.

Alternatively, to create the database manually in pgAdmin, use **Tools >
Query Tool** on `safer247_db`, open `backend/database/schema.sql`, and execute
it. That SQL file records revision `0003_single_operator_name`, so Alembic
recognizes the current schema and does not apply earlier migrations again.

For an existing database already at `0001_initial_schema`, upgrading adds the
authentication metadata and session tables, then removes the redundant
`operators.display_name` column. An operator's call sign is the single account
identity used for sign-in and throughout the interface; responder display names
remain separate.
Downgrades for authentication and the initial schema are intentionally
disabled to prevent accidental data loss; back up the database before applying
schema changes.

## Tables

- `operators` store accounts under a unique call sign; `responders` store
  responder call signs and optional display names.
- `barangays` stores administrative boundaries and centroids as PostGIS data.
- `incident_types` stores the incident-type lookup values.
- `messages` stores decoded incoming and outgoing broadcasts, including
  geolocation and transmission status.
- `incident_reports` stores structured reports linked to their source message,
  responder, incident type, and barangay.
- `message_transmission_attempts` records retries for outgoing messages.
- `media_attachments` stores references to received media files.
- `image_enhancements` stores enhanced image references and processing details.
- `responder_locations` stores timestamped responder location beacons.
- `operator_auth` stores a keyed password fingerprint used only to enforce
  password uniqueness; passwords remain Argon2 hashes in `operators`.
- `auth_sessions` stores only hashes of revocable, expiring session tokens.

## Authentication and demo operator

Run the API from the `backend` directory after setting `.env` and applying
migrations:

```powershell
python -m uvicorn app.main:app --reload --port 8000
```

The frontend development server proxies `/api` requests to this API. Accounts
are created with a call sign and a password (at least 8 characters, including
uppercase and lowercase letters, a number, and a special character). Passwords
are Argon2-hashed; a separate HMAC-SHA256 fingerprint, protected by
`PASSWORD_FINGERPRINT_SECRET`, enforces password uniqueness. Keep this secret
stable and private; changing it requires a planned migration of those
fingerprints.

Registered operators can update their own call sign from **My Account**.
There is no separate administrator account or call-sign approval workflow.
Operators can register with a call sign and password.

To explicitly create a demo operator, set `DEMO_OPERATOR_CALL_SIGN` and
`DEMO_OPERATOR_PASSWORD` in the private `.env`, then run:

```powershell
python -m app.auth.seed_demo --confirm-demo-seed
```

The command refuses to run in production, prints no credentials, and is safe to
repeat. It will not replace an existing account. No demo user is created
automatically.

## Tests

Run the focused tests from the `backend` directory:

```powershell
python -m pytest
```

Mapping tests compile against PostgreSQL types without connecting to a server.
The session lifecycle tests use SQLite only for a simple non-spatial test table;
SQLite is not used as a substitute for PostgreSQL/PostGIS, and geometry behavior
must be tested against a PostgreSQL database with PostGIS installed.

## Application integration

Use `app.db.session_scope()` for a transaction-managed session, or
`app.db.get_db_session()` as a FastAPI generator dependency. The engine is
created lazily from `DATABASE_URL`. ORM models are in `app.db.models`.

In Vite development mode, the frontend uses demo records unless started with
`VITE_OPERATIONAL_DATA_SOURCE=api`. In API mode, authenticated screens read
incident reports from `GET /api/operations/incidents` and messages from
`GET /api/operations/messages`. Composing a message stores an outgoing record
with `queued` status through `POST /api/operations/messages`; it does not
transmit over radio. These endpoints do not create incident reports or ingest
incoming radio messages.

No sample records are inserted by the schema or migrations. Populate lookup,
incident, responder, and message records from a verified data source before
expecting the API-backed dashboard to show data. Store image files outside
PostgreSQL and save their storage paths in the database.
