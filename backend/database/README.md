# SAFER 247 PostgreSQL and PostGIS

PostgreSQL/PostGIS is the authoritative database. Configure `DATABASE_URL` in the private root `.env`. Use forward Alembic revisions for existing databases.

## Database upgrade

Back up your database first. Load the root `.env` into the process environment, then from `backend/` run:

```powershell
python -m alembic -c alembic.ini current
python -m alembic -c alembic.ini upgrade head
python -m alembic -c alembic.ini current
```

Expected head: `0010_remove_registration_code`.

Revision 0010 removes the unused personnel verification column. Operator UUIDs, call signs, Argon2 password hashes, active/inactive flags, and authentication sessions remain intact. Existing accounts with `is_active=false` cannot log in. Active legacy accounts no longer require a separate registration code.

The historical `backend/database/schema.sql` is not a replacement for migrations. Do not apply it to a populated database, edit applied Alembic revisions, or use `stamp head` to hide migration failures.

## Authentication

Personnel register with a unique call sign, strong password, and password confirmation in the browser. The FastAPI registration API accepts call sign and password. Sessions use revocable HTTP-only cookies. The Demo identity remains blocked from operational radio traffic.

**Security:** Without a personnel code or administrator approval, anyone able to reach the registration endpoint can create an active operator account. For real LDRRMO operations, restrict registration access through an appropriate private deployment/network policy and enforce IP-based registration and login rate limits upstream.

## Development fixtures

For synthetic data, seed the `Demo` operator with `python -m app.auth.seed_demo --confirm-demo-seed`, then execute `backend/database/seed_demo.sql` against a development database. See [DEMO_DATA.md](DEMO_DATA.md).

## Protected operational APIs

Authenticated operation endpoints support incidents, messages, responder locations, and reviewed SSTV image associations. Incoming APRS sender identities are not cryptographically verified.

Run backend tests with `python -m pytest -q` from `backend/`. SQLite unit tests do not substitute for PostgreSQL/PostGIS migration testing.
