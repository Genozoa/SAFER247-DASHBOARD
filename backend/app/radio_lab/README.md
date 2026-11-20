# SAFER 247 APRS and SSTV radio lab

This adds hardware-independent APRS text/position transmission and APRS/SSTV
PD90 reception to the existing FastAPI, SQLAlchemy/PostGIS, authenticated React
application. SSTV is receive-only.
`ARCHITECTURE_REVIEW.md` records the PDF/code inspection performed before edits.
`TEST_RESULTS.md` records exact validation and upstream failures. The uploaded
archive had no Git history or working-tree status; its contents were the baseline.
All unrelated original files, including supplied `frontend/dist`, are preserved.

Apply the supplied patch from the project root with `git apply --check
/path/to/SAFER247-radio-PD90.patch`, then `git apply /path/to/SAFER247-radio-PD90.patch`.
The check fails on conflicting local edits; resolve those explicitly and retain
your working changes. Do not reset or force-overwrite a local working tree.
The changed-files ZIP contains only added/modified files at their exact project
relative paths; extract it to a staging directory before merging those files.
Use the patch when the local project has additional uncommitted edits.

## PD90 correction

The supported received SSTV mode is **PD90**, replacing the earlier Robot36
implementation. The decoder supports it; APRS packet formats are unchanged.
PD90 uses VIS 99 (0x63), a
320 × 256 image and approximately 90.899 seconds of mono audio. Shared recording
limits are 120 seconds/12 MiB, and incomplete image reception has a 110-second
watchdog. APRS standalone WAV
validation still defaults to 45 seconds; shared spool decoding explicitly opts
into the 120-second bound so complete PD90 recordings are accepted.

For an installation of the earlier update, use `SAFER247-PD90-upgrade.patch`
with `git apply --check` before applying it. For the original uploaded project,
use `SAFER247-radio-PD90.patch`. Do not apply both. Both were verified against
their respective exact baselines. All files in the incremental change remain
under `backend/app/radio_lab`.

Stop the old worker, merge the update, and restart the API/worker and frontend.
No database migration is needed. Old received images and their recorded modes
remain intact; images without mode metadata are shown as unknown. New SSTV image
transmissions are not accepted. Historical queued image jobs are retained but
cannot be encoded or retried; old encoded WAV artifacts are retained and never
automatically played.

## Architecture and scope

The outgoing APRS flow is web UI/API → committed PostgreSQL message/queue row
(durable IPC) → separate APRS encoder process → sender thread → configured
audio-output command. An OS file lock and PostgreSQL session advisory
lock allow one worker; pending claims additionally use `FOR UPDATE SKIP LOCKED`.
The worker checks that it still owns its DB lock and stops if codec/audio threads
exit. The API never starts capture, playback, or a codec process.

Incoming flow is listener thread → bounded IPC queue → persistent receiver process
→ protocol recognition/decoding → optional image enhancement in that process →
IPC results → existing database tables → polled web UI. Incoming WAVs and live
PCM use the same decoders. Valid AX.25/FCS frames identify the APRS path;
PD90 VIS code 99 and completion events identify SSTV. Both candidates inspect
the audio; unsupported modes produce no application record. aprslib parses only
Dire Wolf's decoded packet strings. It does not decode audio.

Database integration reuses `Message`, `MessageTransmissionAttempt`, `Responder`,
`ResponderLocation`, `MediaAttachment`, and `ImageEnhancement`. Radio job state is
versioned under `Message.decoded_payload.radio_lab`; no schema migration is needed.
Unspecified incident fields and Android envelopes are not invented. Received APRS
coordinates are stored as actual PostGIS geography and responder-location
records. This does not identify or authenticate an officer. Standard PD90 has
no trusted sender or incident identifier; received images use the explicit
`SSTV-UNKNOWN` label.

Original decoded PNGs are stored separately from enhancements. Automatic, modest
Pillow autocontrast follows the radio architecture PDF; `RADIO_ENHANCE=false`
disables it, reflecting the capstone's manual-enhancement preference. Enhancement
parameters are retained, and enhancement failure retains the original. This is
not a new complete manual editing workflow or an image reconstruction algorithm.
No incident is auto-created or image associated with a nearby APRS message.

In API mode, the Messaging composer queues broadcast APRS text; demo mode uses
local sample behavior and does not send radio requests. Authenticated
`POST /api/radio/transmissions` requests also support APRS positions. Received
radio messages and image attachments are available through the normal Messaging
feed/API; positions are persisted as responder locations.

## Install and configure

Use Python 3.11+; verification used Python 3.12.14. The worker includes a native
Windows process lock and lifecycle path. Windows USB audio, PTT/VOX, and physical
radio operation remain unverified.

From `backend/`, create/activate a normal virtual environment, configure the
project's PostgreSQL/PostGIS database and auth secret as in the existing startup
instructions, and run:

```bash
python -m pip install -r app/radio_lab/requirements.txt
python -m pip install --no-deps 'open-sstv @ git+https://github.com/bucknova/Open-SSTV.git@d05de1dd1efe8a7ae45bf2618fd1d37a77d03184'
alembic upgrade head
```

The second command installs the reviewed headless decoder source without its
unnecessary desktop GUI dependencies. `sstv/README.md` explains the deliberate
metadata-level `pip check` failures for omitted desktop packages. PySSTV is
optional and used only to generate test waveforms; it is not installed for the
application.

Install Dire Wolf 1.8.1's standalone `gen_packets` and `atest` commands separately;
see `aprs/README.md` for exact source/build instructions and dependencies. Neither
this command pair nor this setup opens a radio, connects to APRS-IS, or supplies PTT.
Check `aprs/DEPENDENCIES.md` and `sstv/README.md` for reviewed revisions/licenses.
No upstream implementation was copied into this patch. aprslib/Dire Wolf are
GPL-2.0-or-later, Open-SSTV is GPL-3.0-or-later, PySSTV is MIT; process isolation
does not waive license obligations. The upload has no application license, so
distribution terms for a combined application still need to be decided.

Copy `app/radio_lab/.env.example` to `app/radio_lab/.env.local`, adjust station and
paths, and load it into each API/worker terminal along with existing project env:

```bash
set -a
. app/radio_lab/.env.local
set +a
```

Start the API from `backend/` with radio processing enabled:

```bash
RADIO_ENABLED=true \
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The API lifespan starts and supervises the single background worker. Do not
launch a second worker alongside it. Set `RADIO_ENABLED=false` to disable radio
processing; the authenticated status route reports actual worker and device state.

From `frontend/`, use the existing lockfile and enable authenticated API data:

```bash
npm ci
VITE_OPERATIONAL_DATA_SOURCE=api npm run dev
```

Register/login through the existing UI, then open Messaging. In API mode, the
normal composer queues APRS text. Use the authenticated radio API for other
radio job types. `RADIO_ENABLED` is configuration, not worker liveness or radio
readiness. The worker must be running for queued jobs to advance. Do not point
tests at real data.

## Windows root startup

From the project root, copy `.env.example` to `.env`, configure PostgreSQL and
the radio variables, apply migrations, install dependencies, then run:

```powershell
npm.cmd run dev
```

This launches the FastAPI reload process and Vite. The API lifespan starts and
stops the worker automatically when `RADIO_ENABLED=true` (the startup script
defaults it to true if it is absent from `.env`; an explicit false disables it).
The worker uses a native Windows file lock and the PostgreSQL advisory lock.
Development reload may create new API processes, but only one worker can own
the shared queue. Audio playback is not used to test devices at startup; output
is opened only when processing an explicitly queued transmission.

## Incoming incident metadata and image pairing

Incoming APRS incident metadata can be fragmented and reassembled in PostgreSQL,
then paired with a separately received PD90 image. The metadata envelope carries
the report fields and photo-location provenance supplied by the sender. The
dashboard does not create an outgoing incident-plus-image transmission.

Standard PD90 carries no report ID or trusted sender. Incoming pairing therefore
uses a bounded 15-minute channel/session rule: an image pairs only if exactly one
pending report exists for the station (or exactly one pending report globally for
an unidentified SSTV receiver). This sequential pairing is an explicit assumption,
not verified sender identity. Ambiguous and unmatched images remain unassigned.

## Audio devices and WAV spool

The worker continuously captures mono PCM16/48 kHz audio from the selected input
and also watches `RADIO_SPOOL_DIR` for software-only WAV files. The spool path
remains available if `RADIO_INPUT_ENABLED=false` disables microphone capture.
Complete incoming WAVs must be mono PCM16/48 kHz, 1 sample–120 seconds, and no
larger than 12 MiB.
APRS decoding additionally requires Dire Wolf's `atest` and `aprslib`; missing
APRS tools are reported in worker status and do not discard successfully decoded
PD90 images from the same recording.

Set `RADIO_INPUT_DEVICE` and `RADIO_OUTPUT_DEVICE` to a device name or unique
name fragment to prefer configured USB audio hardware. If a configured device
is not enumerated, the worker uses the host default and reports that fallback.
If the configured device is present but has the wrong channel/format or fails to
open, the worker reports an error and does not switch devices. With selectors
empty, the host default input and output are used; Windows WASAPI defaults are
preferred when available. Active names, worker health, codec availability, and
device errors are available from `/api/radio/status` and Settings.

The existing JSON-array `RADIO_INPUT_COMMAND` and `RADIO_OUTPUT_COMMAND`
settings remain explicit overrides. They take precedence over native devices;
input commands write raw signed little-endian PCM16 mono at 48 kHz to stdout,
and output commands must contain `{wav}`. Neither command uses a shell.
`RADIO_COMMAND_TIMEOUT` defaults to 60 seconds and limits how long the worker
waits for `RADIO_OUTPUT_COMMAND`; it does not set a timeout for native-device
playback. If the command times out, output may already have started, so delivery
is reported as unknown.
Successful native playback or command completion means **audio output
completed** only, never RF reception, APRS acknowledgment, or Android delivery.
A PTT wrapper must manage keying, lead/tail delays, and release on process-group
termination. No PTT implementation is included without the interface details.
Output timeout/interrupt marks delivery unknown; restart recovers in-flight jobs
as failed without replay. Explicit retry can duplicate a transmission if the
previous audio partially aired.

Playback occurs only while processing a queued transmission; worker startup
enumerates devices and opens the microphone but does not play a test tone. A
generated WAV remains under `RADIO_OUTPUT_DIR` as an artifact of a transmission.
Set `RADIO_OUTPUT_ENABLED=false` for encode-to-WAV-only operation; those
transmissions are not automatically replayed if audio output is enabled later.
No automatic test playback or RF transmission is performed.

Messaging uses concise status labels: **Queued**, **Preparing**, **Sending**,
**Audio complete**, **Delivered**, **Couldn’t Send**, **Delivery unknown**, and
**Canceled**. Supporting details explain whether audio started and whether
receiver delivery is confirmed. **Couldn’t Send** is reserved for failures known
to occur before output starts; a timeout or interrupted output that may have
started remains **Delivery unknown**. Audio completion is not shown as
**Delivered**; this implementation does not receive a delivery acknowledgment.

To submit a recording through the software-only input path, atomically rename a
complete mono PCM16/48 kHz WAV into `RADIO_SPOOL_DIR` (write as `.tmp`, then rename `.wav`).
The worker moves it through `processing/` to `processed/` or `failed/`, with JSON
result metadata. It retains complete original recordings. Use distinct arrivals
for separate receptions; a stable per-arrival receipt ID makes crash replay
idempotent while preserving identical future beacons as new receptions.

Live reception retains PD90 state across chunks. APRS uses five-second windows
with two-second overlap and local overlap deduplication. Identical frames within
six seconds may be collapsed; this profile supports frames fitting within the
two-second overlap. Deduplication uses sample time, not processing wall time.
A capture disconnect flushes complete final APRS packets before resetting state.
The PD90 110-second watchdog recovers incomplete frames, but an immediately following image
can be missed while the damaged frame is pending. The tested recovery uses an
explicit reset or enough silence for the watchdog. Raw subprocess capture cannot
independently detect every sound-driver overrun; a hardware adapter must signal
gaps/restart capture. Spool replay and live input are independent streams; do not
submit the same live capture through both unless duplicate records are intended.

Receive persistence failures save result JSON under `storage/recovery`; startup
replays it. Receipt deduplication assumes the enforced single consumer; no new
database uniqueness constraint is added. A rollback/crash can leave original
media artifacts for recovery; automatic destructive pruning is not implemented.
Bounded queues provide backpressure. Continuous throughput under actual device
timing and simultaneous RF interference has not been measured.

## API and files outside radio_lab

All `/api/radio/*` routes require the existing operator session:

| Route | Purpose |
| --- | --- |
| `GET /status` | Worker liveness, active audio devices/errors, configuration, and unverified RF/Android flags |
| `GET /messages?limit=200` | Bounded radio queue/receive history |
| `POST /transmissions` | Queue APRS `text` or `position`; returns 202 |
| `POST /transmissions/{id}/retry` | Explicit retry of failed outgoing APRS jobs |
| `GET /media/{id}?variant=original` | Authenticated original; enhanced variant supported |

Text: `{"kind":"text","text":"Request assistance","addressee":"ALL"}`.
Position: `{"kind":"position","latitude":7.9186,"longitude":125.3286,"text":"Patrol"}`.
APRS is ASCII text, 67 characters (position comments 43); coordinate resolution
is 0.01 minute. Positions rounding to poles/dateline are rejected due to aprslib.
No Android incident envelope, HMAC, digipeating, or acknowledgment behavior is assumed.

Key integration edits outside this folder include:

- `backend/app/main.py`: include the authenticated radio router.
- `backend/app/auth/api.py`: scope session cookies to `/api`, retire the legacy
  path, and clear both on logout so the browser can access operational and radio routes.
- `backend/app/db/models.py` and `backend/alembic/versions/0005_canceled_radio_status.py`:
  persist the canceled transmission status.
- `backend/app/operations/api.py`: expose radio-backed messages and image
  attachments through the existing Messaging API.
- `frontend/src/pages/Messaging/MessagingPage.jsx`: retain the broadcast composer
  and display received image attachments in the normal feed.
- `frontend/vite.config.js`: deduplicate React and permit the radio source
  directory for frontend imports.
- `Run-SAFER247.ps1` and the root `package.json`: provide Windows development
  startup; the API lifespan supervises the worker.

## Validation and remaining inputs

From `backend/` with a migrated disposable PostGIS database and codec tools:

```bash
RADIO_TEST_DATABASE_URL='postgresql+psycopg://USER:PASS@127.0.0.1:PORT/DISPOSABLE_DB' \
RADIO_GEN_PACKETS=/path/to/gen_packets RADIO_ATEST=/path/to/atest \
python -m pip install -r app/radio_lab/sstv/tests/test-requirements.txt
python -m pytest tests app/radio_lab -q --import-mode=importlib
```

Tests explicitly skip optional modem/decoder/PostGIS cases when prerequisites
are missing. See `TEST_RESULTS.md` for results obtained with all prerequisites.
Frontend checks are in `frontend/README.md` within this lab tree.

Hardware-specific work needs radio make/model, frequency/band plan, audio interface
and OS/device IDs, sample-rate/gain/channel routing, acoustic vs cable setup,
PTT/VOX control, duplex behavior, and recorded receive/transmit samples. Android
work needs exact app/build, APRS addressing/encoding/framing, acknowledgments,
and any HMAC format/key provisioning. These are not needed to reproduce the
software tests.

The current host's selected Windows WASAPI defaults are
`Microphone Array (2- Intel® Smart Sound Technology for Digital Microphones)`
and `Speakers (2- Realtek(R) Audio)`. Static 48 kHz mono PCM16 format checks passed;
a separate communications output was `Speakers (Epson Projection Audio)`. No
distinct external USB audio endpoint was enumerated. This is device enumeration
and format validation only: no audio was played, captured, or opened. USB,
device operation, acoustic speaker-to-microphone, RF, PTT, field-noise, and
Android interoperability are unverified. Direct file/spool decoding, digital
loopback, and acoustic reception are separate tests; results must identify
which path was exercised.
