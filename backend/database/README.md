# SAFER 247 PostgreSQL and PostGIS

PostgreSQL and PostGIS are the authoritative database. Keep `DATABASE_URL` in your private root `.env`. Set `OPERATOR_REGISTRATION_CODE_HASH` to the salted Argon2 hash produced by `python -m app.auth.registration_code` from `backend/`.

## Existing database migrations

Back up the current database and confirm `DATABASE_URL` is set in the Alembic process environment. Then:

```powershell
cd backend
python -m alembic -c alembic.ini current
python -m alembic -c alembic.ini upgrade head
python -m alembic -c alembic.ini current
```

Expected head: `0009_simplify_operator_registration`.

Revisions 0001–0008 establish the current operational system, incident image auditing, Demo ownership, and previous account workflow. Revision 0009 migrates existing personnel verification state while preserving their UUID, username, and Argon2 password hash. Existing accounts without documented verification require an additional registration-code check at their next successful password login. Inactive accounts remain inactive.

The historical `backend/database/schema.sql` does not replace forward migrations. Never run it over a populated database or stamp a mismatched migration revision.

## Authentication

The API verifies the developer-provided registration code from a server-only Argon2 configuration hash. Staff enter their call sign and a strong password. Registration leads directly to a standard login. Cookie sessions are HTTP-only and revocable. Demo restrictions prevent all real radio transmissions.

## Development fixtures

For synthetic data, seed the `Demo` operator with `python -m app.auth.seed_demo --confirm-demo-seed`, then execute `backend/database/seed_demo.sql` against a development database. See [DEMO_DATA.md](DEMO_DATA.md).

## Protected operational APIs

Operations endpoints provide incidents, messages, responder locations, and reviewed SSTV image correlation. APRS sender identities are not cryptographically authenticated, so report coordinates remain unverified until confirmed by the field team.

Run backend tests with `python -m pytest -q` from `backend/`. SQLite unit tests do not substitute for validating production PostgreSQL constraints and migrations.
