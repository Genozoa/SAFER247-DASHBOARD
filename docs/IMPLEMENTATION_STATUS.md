# SAFER247 implementation status

This branch changes authentication and Messaging without changing the radio framework, incident tracking, PostGIS data model outside authentication, or the existing Demo ownership design.

| Task | Implementation | Further verification |
| --- | --- | --- |
| Personnel code registration | Server-side Argon2 registration-code hash, per-process request throttle, immediate account creation | Production shared rate limiting and full login/regression checks |
| Legacy accounts | Revision 0009 retains previously authorized sessions/accounts and requires code verification for legacy unverified accounts | PostgreSQL migration smoke test and login transition tests |
| Credential input icons | lucide-react inline call-sign, password, confirmation, and code icons; visibility buttons remain keyboard-accessible | Desktop/mobile visual QA |
| Messaging | Text-only APRS composer with received image/geolocation icons restored | Frontend build and radio processing tests |
| Authentication internals | Retained Argon2 per-account password verification and HTTP-only cookie sessions | Backend test suite |

Other earlier development work remains unchanged: APRS/SSTV worker, manually reviewed image correlation, recent responder positions, PostgreSQL-only synthetic records, local tile route, and 10-second visible-tab polling.

No workflow result should be interpreted as proof of successful database migration or radio hardware functionality. Check CI and execute migrations against a backed-up PostgreSQL/PostGIS instance before deployment.

See [deployment guide](LDRRMO_DEPLOYMENT.md).
