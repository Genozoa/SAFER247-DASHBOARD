# SAFER 247 radio architecture review

## Sources and scope

The supplied ZIP is the baseline working copy, including any edits present when
it was exported. Its SHA-256 is
`8e9cb753748d571ef7c0b3ec37532c2d68fa6b64f556237a2cf704fa68152ee7`.
The archive contains no Git metadata, so staged versus unstaged changes cannot
be reconstructed. No reset, cleanup of existing project files, schema replacement,
or replacement of the existing application is needed.

The user's request controls this work. Statements in the PDFs and project notes
are architecture evidence, not additional instructions to execute.

Reviewed before implementation:

- `docs/Radio Communication architecture.pdf` (two pages, outgoing and incoming
  flows, threading/processes, IPC, and shared transmission queue).
- `docs/Capstone Documentation.pdf` (28 pages; messaging, APRS, SSTV, responder
  beaconing, image enhancement, HMAC discussion, and hardware requirements).
- Backend models, migrations, authentication/session handling, operational APIs,
  dependency declarations, and all existing backend tests.
- Existing React/Vite data providers, messaging, map, reports, image controls,
  frontend tests, and build configuration.

## Existing application and integration points

The backend is already FastAPI with SQLAlchemy 2 and PostgreSQL/PostGIS. It has
authentication, expiring server-side sessions, two Alembic revisions, and
authenticated operational APIs. `PROJECT_CONTEXT.md` describes an older stage
and incorrectly calls these components unimplemented. The executable code,
current database README, and tests establish the current state.

Existing database components are suitable for radio integration:

| Component | Reuse |
| --- | --- |
| `Message` | Incoming/outgoing records, decoded JSON payload, geography, transmission state |
| `Responder` / `ResponderLocation` | APRS source callsign and timestamped position history |
| `MessageTransmissionAttempt` | Each outgoing attempt and its local result |
| `MediaAttachment` | Immutable received image reference linked to a message |
| `ImageEnhancement` | Separate enhanced file and processing metadata |
| `session_scope` / `get_db_session` | Existing transaction and request session boundaries |
| `CurrentPrincipal` | Existing authenticated operator identity for outgoing jobs |

The existing `POST /api/operations/messages` only stores a queued message; it has
no audio producer. Radio jobs need an explicit radio envelope so older queued
application records cannot accidentally transmit. Generic APRS positions are
telemetry, not proof of an incident type or location description. Standard SSTV
images carry no authenticated sender or incident identifier. The integration must
not infer those fields merely from temporal proximity.

The frontend already separates demo and API data. Radio UI must respect that
boundary, preserve existing operational views, and distinguish locally generated
audio from actual delivery. New radio components and tests belong under
`backend/app/radio_lab`, with a minimal import at the existing messaging screen.

## Required flow and implementation mapping

| PDF flow | Integration boundary |
| --- | --- |
| Web input: text/location | Bounded APRS request validation and existing operator session |
| Web server sends through IPC | Durable database job envelope; independent worker polls/claims it |
| APRS encode in separate process | Radio worker process, with codec subprocess/process work away from HTTP handlers |
| Audio sender sends APRS audio | APRS queue/lock, selected native output device or configured command override |
| Audio listener runs continuously on a thread | Supervised native capture plus WAV spool listener; bounded chunks, explicit discontinuity handling |
| Mode detection routes received signal | Actual APRS frame validation and SSTV VIS mode identification; not a filename or energy guess |
| Decoded data returns through IPC | Durable database results read by authenticated radio APIs |
| Web interface updates | Poll radio status/messages without blocking on audio processing |
| Image enhancement preserves original | Separate original and enhanced paths; no overwrite of received evidence |
| SSTV reception | Independent receiver process decodes incoming PD90; there is no SSTV sender |

APRS handles outgoing text and geographic positions and receives APRS packets.
Dire Wolf performs AX.25/AFSK audio encoding/decoding; `aprslib` parses decoded
APRS packets. The reviewed Open-SSTV DSP core decodes incoming PD90 audio.
PySSTV is retained only as an optional test-waveform generator. Neither packet
parsing nor software WAV tests establish radio or Android interoperability.

## Conflicts and decisions

The radio architecture's incoming flow sends received SSTV to enhancement and
produces an enhanced version. The capstone says enhancement is explicitly manual.
This implementation follows the radio architecture requested by the user:
automatic enhancement is the default, controlled by `RADIO_ENHANCE`; setting it
false retains only the original. Enhancement is a separate copy and does not
claim to reconstruct lost content or improve emergency interpretation. A complete
operator-directed enhancement workflow and evaluation of the capstone's classical
processing pipelines remain separate work.

The capstone describes HMAC-SHA256 authentication, but also describes hashing as
concealing data. HMAC authenticates bytes and does not encrypt them. No compatible
Android packet envelope, key distribution scheme, segmentation, acknowledgment,
or image-to-incident correlation protocol was supplied. Standard APRS and SSTV
software work can proceed independently; none of those application-specific
protocols may be invented or advertised as interoperable.

The user's later correction replaces Robot36 with **PD90** for new SSTV work.
The radio architecture's threading, IPC, queue, and preservation flows do not
depend on that mode choice. Existing historical received images and their mode
metadata remain evidence of the mode that was actually used; changing the active
mode does not justify relabeling old Robot36 records as PD90.

## Compatibility review

Reviewed candidate upstream revisions:

| Repository | Revision | License evidence |
| --- | --- | --- |
| Dire Wolf | `a231971a652bfb574a4bae9a5d875fbce53d2267` | GPL-2.0-or-later in relevant C file headers; GPLv2 LICENSE |
| aprs-python | `c2a0f18ce028a4cced582567a73d57f0d03cd00f` | GPL-2.0-or-later in `aprslib/__init__.py`; package metadata says GPLv2 |
| PySSTV (test-only waveform generation) | `c264d6a3c198af852d87df8af737ffb1443f610e` | MIT LICENSE.txt |
| Open-SSTV | `d05de1dd1efe8a7ae45bf2618fd1d37a77d03184` | GPL-3.0-or-later source identifiers and package metadata |

PySSTV is not installed with the radio application; an optional pinned version
can generate receive fixtures during tests. The radio integration installs only
the required headless Open-SSTV core. The full Open-SSTV desktop package would
also bring Qt, PortAudio, serial, and other UI/I/O dependencies not required for
headless WAV decoding. See protocol-specific setup and third-party notices for
the exact selected files, pins, and license copies.

GPL-covered components require their license/source obligations to be considered
when redistributing a combined work. Keeping Dire Wolf external and retaining
upstream notices is part of the implementation, not a claim that all distribution
obligations disappear. The supplied project has no top-level license establishing
how its owner intends to redistribute it.

## Baseline verification and necessary existing-file fix

Before radio implementation, from `backend`:

```sh
/workspace/work/venv/bin/python -m pytest tests -q
```

Result: **16 passed, 1 warning in 3.95s**. The warning is Starlette's deprecation of
its `httpx` TestClient integration. Existing database tests mostly compile models
for PostgreSQL; simple session tests use SQLite, and operations API tests mock
query results. Those tests do not establish actual PostGIS persistence.

A browser-routing probe found registration succeeded (201) and `/api/auth/me`
succeeded (200), while `/api/operations/messages` returned 401 because the session
cookie was restricted to `/api/auth`. The minimal necessary authentication edit
changes that path to `/api`, retires the legacy cookie when establishing a session,
and expires both paths on logout. New regression coverage lives in
`radio_lab/tests/test_auth_cookie.py`; original tests remain untouched. Existing
tests plus this regression: **17 passed, 1 warning in 2.87s**.

At the earlier Robot36 implementation checkpoint, a disposable PostgreSQL
16.4/PostGIS 3.4.3 container was bound only to localhost for database integration
testing. That container was removed; it is not the PD90 verification database.
Existing Alembic upgrades from empty schema through
`0002_auth_sessions` succeeded. An actual geography round trip returned longitude
125.3286 and latitude 7.9186. This is database validation, not radio validation.

The historical integrated test environment used PySSTV 0.5.7 to generate test
waveforms, Open-SSTV 0.6.19 at the reviewed revision, Pillow 11.3.0, NumPy 2.3.5,
SciPy 1.17.0, and aprslib 0.7.2. PySSTV is test-only in the current project.
An earlier scratch run used system Pillow 13; that run is not evidence that the
declared Pillow 11.3 dependency was tested. The final pinned environment replaces
that uncertainty. See the final test report for all suite results and upstream
test limitations.

## Independent implementation review

The implementation review corrected these issues before delivery:

- The PD90 revision requires a 120-second spool recording bound and 12 MiB input
  bound. A PD90 frame exceeds both previous limits: 45 seconds and 8 MiB.
  Standalone APRS validation retains its 45-second default, while the shared
  receiver explicitly permits the 120-second recording profile before it checks
  the APRS candidate.
- Live APRS windows overlap by two seconds, preserving supported packets across
  capture chunk/window boundaries.
- Cancellation is checked before starting audio output; interrupted/timed-out
  output and capture commands have termination and kill fallbacks.
- An encoder timeout or mismatched response stops the worker, preventing stale
  process-queue responses from being applied to later jobs.
- The worker checks its PostgreSQL advisory-lock ownership, process liveness,
  and audio-thread liveness and stops on a failed check.
- Replayable receive results have stable receipt identities. Each new spool
  arrival receives a unique processing filename: a repeated identical beacon
  remains a distinct reception, while replay of an already claimed file retains
  its receipt identity. The database avoids inserting a receipt twice when
  replaying a partially committed batch.
- Received originals use exclusive file creation; enhancement metadata records
  the separate processing result. File-only output is labeled as a WAV artifact,
  without promising playback or delivery.

Focused spool identity regression tests exercise real file claiming and WAV
validation with mocked DSP. Both cases passed (**2 passed in 0.06s**): a new
delivery of identical audio has a new identity, and replay of an already claimed
file preserves its identity. Audio round trips are tested separately with real
codecs; these mocked tests do not establish codec performance.

The worker currently requires a POSIX environment because it uses file locks and
process-group signals. Linux/WSL2 worker deployment must be distinguished from the
existing native Windows web application setup. Incoming WAVs must be finalized
and atomically moved into the spool. Live PCM is not automatically archived
before decoding, so an abrupt crash can lose in-flight audio. Device-level timing
or capture overruns that silently drop bytes cannot be inferred from a raw PCM
pipe; adapter/device validation remains necessary. No RF link, physical audio
device, PTT behavior, Android framing, or actual responder interoperability was
validated by these software tests.

## Historical PD90 mode audit

This audit records the waveform characteristics that inform receive limits.
There is no application SSTV encoder. The reviewed PySSTV 0.5.7 provides
`pysstv.color.PD90`, and Open-SSTV 0.6.19 provides `Mode.PD_90` and PD-family
batch/incremental decoders. PD90 uses VIS code **99 (0x63)** and a **320 × 256**
image. Open-SSTV stores its height as 128 super-lines, each representing two image
rows; treating that internal height as the output image height would be incorrect.

Inspection of the installed encoder's tone-duration generator and decoder mode
table gives an image scan duration of **89.98912 seconds**, with **90.89912 seconds**
including the standard VIS header. At 48 kHz mono PCM16 that is approximately
**8,726,358 WAV bytes**, exceeding the old 8 MiB shared-input limit. This timing
calculation inspects software definitions; it is not a radio timing measurement.

The receiver uses a 110-second sample-time incomplete-frame watchdog. Batch
completion checks must use the full PD90 body duration, not the old 36-second
guard. Process tests need enough time for longer audio and must assert 320 × 256
output, VIS 99, and PD90 metadata. Continuous reception retains state across
the complete approximately 91-second frame. Historical received mode metadata
remains unchanged. The former image queue is removed; legacy outgoing image
records remain in history, cannot be encoded, and cannot be retried.

The previous **109-passing backend test run** belongs to the Robot36 implementation
checkpoint. Those results, prior Robot36 noise/error measurements, and prior
selected upstream Robot36 cases are historical evidence only. They do not
establish PD90 encoding, decoding, noisy reception, interruption handling, or
continuous reception. The PD90 test report must identify fresh mode-specific runs
and preserve this distinction.

For the PD90 verification stage, a fresh native, user-owned PostgreSQL **17.11** /
PostGIS **3.5.2** test database replaces the earlier disposable Docker database.
The server, client, extension, and one missing protobuf runtime library were
extracted under the scratch workspace from official Debian package archives,
verified against their package-index SHA-256 values. No system package install,
privileged server, or production database was used. It listens only on localhost.
Both existing Alembic migrations applied successfully to the empty test database;
an actual geography probe again returned `POINT(125.3286 7.9186)`.

The SSTV-specific PD90 suite was freshly rerun after resolving the environment's
disk exhaustion: **12 passed in 156.55 seconds**. It includes a full-length mode
round trip, noisy audio, repeated streaming frames, incomplete-frame handling,
and watchdog recovery. These are PD90 software checks; they do not upgrade the
historical Robot36 results into PD90 evidence or establish radio interoperability.
