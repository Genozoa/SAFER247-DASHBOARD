# Development synthetic dataset

This SQL file inserts 120 fictional incidents, 120 incoming messages, and 60 outgoing messages. It never sends radio messages.

1. Apply Alembic migrations through `0008_sample_data_ownership`.
2. In a private local `.env`, set `DEMO_OPERATOR_CALL_SIGN=Demo` and a strong `DEMO_OPERATOR_PASSWORD`.
3. From `backend/`, run `python -m app.auth.seed_demo --confirm-demo-seed`.
4. Against a **development PostgreSQL database only**, run `psql -v ON_ERROR_STOP=1 -d safer247_db -f backend/database/seed_demo.sql` from the repository root, using the correct connection credentials.
5. Log in as `Demo`. The special `Demo` identity has no live radio transmission permission.

The script is idempotent as a group. Run only against a disposable development database. Data includes an ownership foreign key to the Demo operator. Operational API queries exclude synthetic rows from every other operator. Responder rows created for dataset lookups use the `DEMO-UNIT-` prefix and do not represent real personnel. They contain no synthetic location beacons.

To reset the sample records, delete the owned incident reports and messages in a transaction using `sample_owner_operator_id`. Do not delete shared lookup tables or real accounts.

These records are fictional. No image file or media evidence is generated.
