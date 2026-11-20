# SAFER247 ordered implementation status

Base revision: `ffb37675c49909ce5249662dc7347179351e94f5`. Work lives on a feature branch and an unmerged draft PR. This file records the ordered queue from the uploaded AGENTS.md. Treat source changes as **unverified** until tests/migrations run.

| Task | Implementation status | Outstanding completion criteria |
| --- | --- | --- |
| 1. Registration code, approval, permissions | Code implemented | Verify FastAPI auth tests and PostgreSQL migration. Restrict shared-code guessing through network rate limiting; rotate `capstone` |
| 2. Login and registration UX | Code implemented | Browser test keyboard, responsive layout, labels and approval notice |
| 3. Radio image correlation | Safety fix and manual audited endpoint implemented | Add image selection/review UI, design authenticated over-the-air incident/image token if required, test duplicate/delayed/malicious images |
| 4. Responder tracking | Authenticated endpoint and map hookup implemented | Add cryptographic identity on field units/Android; test real beacons, 24h history, stale status |
| 5. Synthetic records | SQL and ownership implemented | Execute SQL against disposable PostgreSQL+PostGIS, check 120 incidents/180 messages and operator isolation, clean other test-only scaffolding |
| 6. Deployment, CI, offline maps | CI YAML and local XYZ route implemented | Get CI passing, provide licensed local tile pack, test offline operation and production settings |
| 7. API polling and paging | Limit/offset cap + 10s visible-tab polling implemented | Test load and data accuracy; add UI pagination / historical totals or realtime push |
| 8. Documentation and scaffolding | New deployment guide, example secrets scrubbed, old client fixture removed | Fully rewrite legacy guide sections and remove remaining unused shell components after dependency checks |

## Verification state
- Static file read-through performed through the connected GitHub repository.
- Tests, migration, frontend build, offline tile rendering, and radio hardware **were not executed** in this editing environment.
- GitHub's CI run endpoint returned no workflow runs when checked. A Vercel check earlier reported failure, but logs were unavailable. Do not merge without green CI.
- No modifications to `master`. The pull request remains a draft.
- APRS callsign and SSTV sender attribution are not cryptographically verified. A manually reviewed image association is an operator attestation, not proof of RF sender.
- Offline basemap is blank until a legal local `z/x/y.png` tile pack exists.

## Suggested test sequence
1. `python -m pytest -q` in `backend`.
2. `npm ci && npm test && npm run build` in `frontend`.
3. Back up a test PostgreSQL database, then `python -m alembic -c alembic.ini upgrade head` and inspect constraints and indexes.
4. Login role matrix (pending, viewer, operator, admin), registration-code checks, revocation, cookie removal, role elevation, admin bootstrap.
5. Insert Demo SQL twice, prove idempotence and sample-owner isolation, check Demo cannot transmit/see live radio.
6. Receive unknown PD90 image and prove it stays unlinked; verify manual association with audit, rejection on conflicting links.
7. Send actual authenticated browser requests, test responder trails with real PostGIS, and check offline tiles.
8. Inspect Vercel build logs and resolve deployment configuration.
