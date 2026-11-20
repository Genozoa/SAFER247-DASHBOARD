# Radio verification history

The current application sends APRS text and positions and receives/decodes/
persists/displays SSTV PD90 images. SSTV encoding and transmission were removed.
The detailed results below predate that removal and are historical evidence for
the earlier implementation only; they do not validate outgoing SSTV, which is no
longer a supported feature.

## Status-label and timeout update verification

The backend tests were run once from `backend/`:

```bash
python -m pytest app/radio_lab/tests/test_runtime.py \
  app/radio_lab/tests/test_api_repository.py -q --import-mode=importlib \
  -p no:cacheprovider
```

Result: **45 passed, 12 skipped in 5.67s**. The skipped tests require a
disposable PostGIS database; `RADIO_TEST_DATABASE_URL` was not set.

The dashboard and radio status-label tests were run once from the repository root:

```bash
node --test frontend/tests/messageStatus.test.js \
  backend/app/radio_lab/frontend/client.test.js
```

Result: **11 passed**.

## Receive-only removal verification

The focused backend suites were run once from `backend/`:

```bash
python -m pytest app/radio_lab/aprs/tests app/radio_lab/sstv/tests \
  app/radio_lab/tests/test_api_repository.py app/radio_lab/tests/test_pipeline.py \
  app/radio_lab/tests/test_runtime.py app/radio_lab/tests/test_continuous_receiver.py \
  -q --import-mode=importlib -p no:cacheprovider
```

Result: **91 passed, 18 skipped in 7.32s**. Optional integration skips are
expected in this environment: PySSTV, Open-SSTV, Dire Wolf `gen_packets`/`atest`,
and `RADIO_TEST_DATABASE_URL` were unavailable, so real SSTV audio decoding and
the database-backed end-to-end pipeline were not exercised here.

The radio frontend tests were run once:

```bash
node --test backend/app/radio_lab/frontend/client.test.js backend/app/radio_lab/frontend/aprs/request.test.js
```

Result: **9 passed**.

## Historical verification before SSTV send removal

**135 backend cases passed across four disjoint focused runs; no case skipped
or failed in those completed runs.** These are not the results of a single
combined invocation. All current backend cases are covered by these four runs:

| Run from backend/ | Result | Coverage |
| --- | --- | --- |
| `pytest app/radio_lab/aprs/tests -q` | **47 passed in 2.18s** | Text/position real Dire Wolf audio round trips, consecutive/noisy/interrupted frames, invalid limits, default 45s cap, opt-in 120s shared profile with actual packets before/after 90s |
| `pytest app/radio_lab/sstv/tests -q` | **12 passed in 156.55s** | Real PD90 clean/noisy image round trips; 48/44.1kHz; repeated continuous frames; reset/watchdog recovery; invalid/other VIS; original/enhancement provenance; half/final-50ms truncation rejection in file and streaming paths |
| `pytest app/radio_lab/tests/test_runtime.py app/radio_lab/tests/test_spool_identity.py app/radio_lab/tests/test_continuous_receiver.py -q --import-mode=importlib` | **16 passed in 28.42s** | Raw mixed APRS/PD90 IPC, boundary packets and repeated beacons, capture reset, stable spool identities, duration/size limits, playback interruption/timeout, rejection of untagged/old-mode image jobs |
| `pytest tests app/radio_lab/tests/test_auth_cookie.py app/radio_lab/tests/test_api_repository.py app/radio_lab/tests/test_pipeline.py -q --import-mode=importlib` | **60 passed, 1 warning in 17.26s** | All 16 original backend cases, browser cookie routing, all 42 radio API/repository cases against actual PostGIS, full authenticated API→DB→codec processes→PD90 WAV spool→DB→authenticated images |

The existing warning is Starlette's deprecated httpx TestClient integration.
These results include tests for the former outbound encoder and image queue,
which were removed afterward. Incoming image preservation and authenticated
retrieval remain supported.

The complete suite can be reproduced from `backend/` with optional prerequisites:

```bash
RADIO_TEST_DATABASE_URL='postgresql+psycopg://USER:PASS@127.0.0.1:PORT/DISPOSABLE_DB' \
RADIO_GEN_PACKETS=/path/to/gen_packets RADIO_ATEST=/path/to/atest \
python -m pytest tests app/radio_lab -q --import-mode=importlib
```

The actual focused runs additionally used `PYTHONDONTWRITEBYTECODE=1` and
`-p no:cacheprovider` where appropriate. Missing optional dependencies, modem
commands or a disposable database are explicit skips, not successful coverage.

Environment: Python **3.12.14**, Dire Wolf **1.8.1**, aprslib **0.7.2**, PySSTV
**0.5.7**, Open-SSTV **0.6.19** at
`d05de1dd1efe8a7ae45bf2618fd1d37a77d03184`, Pillow **11.3.0**, NumPy **2.3.5**,
SciPy **1.17.0**. Current DB testing uses native, isolated PostgreSQL **17.11** /
PostGIS **3.5.2**. Official Debian packages were checksum-verified and extracted
under a user-owned scratch directory; no system installation was performed.
Existing migrations 0001/0002 applied to a fresh database; an actual geography
round trip returned `POINT(125.3286 7.9186)`.

## PD90 compatibility and upstream evidence

Both existing dependency pins support PD90; no version changes were necessary.
Verified settings are **320×256**, VIS **99 (0x63)**, 128 two-row scan groups,
**89.98912s image payload**, approximately **90.899104s total WAV** at 48kHz.
An 8 MiB cap or 90s output timeout cannot carry the complete default waveform.
The shared worker now allows **120 seconds / 12 MiB**, defaults playback timeout
to **150 seconds**, and uses a **110-second** incomplete-image watchdog.

Fresh upstream checks and direct probe:

- Open-SSTV `tests/core/test_decoder.py::test_pd_roundtrip_preserves_saturated_chroma`:
  **1 passed in 12.73s**.
- Open-SSTV `tests/core/test_new_modes.py -k 'display_height and pd_90'`:
  **1 passed, 85 deselected in 0.99s**. This is not the full upstream suite.
- Direct PySSTV gradient probe: **4,363,157 samples**, **90.899104s** at 48kHz;
  decoded image **320×256**. Mean absolute luminance error was **1.139/255 clean**
  and **10.979/255 with seeded 5 dB white noise**. These metrics describe only
  that synthetic image and signal. Half-length audio produced no image.
- The upstream batch decoder accepted a recording missing its final 50ms.
  The adapter requires the complete PD90 payload with 10ms DSP tolerance; fresh
  file/stream regression tests reject this near-end truncation.

Latest PySSTV pins Pillow 13, whereas the reviewed Open-SSTV declares Pillow <12.
The compatible PySSTV 0.5.7/Pillow 11.3 pins remain deliberate. Headless Open-SSTV
installation with `--no-deps` omits GUI-only packages; `pip check` will still
report the desktop application's omitted metadata dependencies. Required DSP
imports are installed and exercised. Dependency licenses/revisions are recorded
in `aprs/DEPENDENCIES.md` and `sstv/README.md`; no upstream source is vendored.

## Frontend

Fresh verification from `frontend/`:

```bash
npm test
node --test ../backend/app/radio_lab/frontend/client.test.js ../backend/app/radio_lab/frontend/aprs/request.test.js
npm run build
```

- Existing tests: **8 passed**, no failures/skips.
- Radio tests: **13 passed**, no failures/skips in the earlier version; included
  outgoing image-file helpers that have since been removed.
- Production build: **passed** with the existing >500kB bundle warning.
- All 11 original `frontend/dist` files remain byte-identical after restoration;
  build normally to deploy the new source. Browser-rendered interaction/visual
  layout was **not tested**. No actual Android endpoint was involved.

## Historical evidence and resolved setup failures

The earlier **109-pass** backend run and Robot36 luminance/stream results belong
to the previous implementation. They do not validate PD90. The unchanged aprslib
dependency's previously reproduced upstream full suite had **110 passed,
19 failed** because mox3 calls removed `inspect.getargspec` on Python 3.12; its
non-mock-dependent subset had **96 passed, 13 warnings**. Those upstream legacy
test failures remain disclosed; that full upstream suite was not rerun during
the mode correction. Earlier Dire Wolf noise-profile and PySSTV upstream results
are documented in their component READMEs; fresh APRS/PD90 application tests
above provide the current round-trip evidence.

During this correction, Docker's VFS database setup exhausted disk space. An
initial PD90 run completed five tests and hit five setup errors; they were not
codec assertion failures. Only this task's generated image/data/scratch files
were removed, freeing space. Native PostgreSQL/PostGIS replaced Docker for the
final database checks. An intermediate API run reported 28 passed/14 skipped
before that DB existed; all 42 API cases passed in the later 60-case run.

## Limits and hardware/Android work

These are software tests. No live RF, physical audio capture/playback, PTT/VOX,
acoustic/direct cable radio path, real field-noise recordings, or Android device
was verified. Dummy output subprocess tests do not validate a sound card or radio.

An interrupted PD90 image recovers on explicit reset or the 110s watchdog; the
tested watchdog scenario includes 120s silence before another image. A new image
immediately after an interrupted one can be missed. Raw PCM cannot identify every
driver overrun; abrupt failure can lose in-flight live audio. The API now
supervises the worker and exposes its heartbeat and device/codec errors. Windows
process locks, a live database worker, and forced DB lock loss during physical
playback still require separate runtime tests.

APRS acknowledgments, digipeating, non-ASCII text, HMAC/Android envelopes and
image/incident correlation remain unspecified. APRS coordinates rounding to exact
poles/dateline are rejected by the selected parser. Live APRS overlap is 2s with
5s windows; identical packets within 6s sample time can be collapsed. The default
standalone APRS WAV limit remains 45s; only shared spool reception opts into 120s.
Original/enhancement rollback artifacts can remain for recovery; receipt dedup
assumes the singleton worker. Required device and Android details remain listed
in `README.md`.

## Native Windows verification — 18 November 2026

- Python compile check: passed.
- Focused APRS/SSTV/runtime/API suite on Windows: **75 passed, 34 skipped,
  0 failed**.
- Frontend unit tests: **23 passed**.
- Radio frontend unit tests: **13 passed**.
- Frontend production build: passed.
- One POSIX-only shebang timeout fixture is explicitly skipped on Windows;
  runtime command timeout/termination is also covered with mocked process tests.
- Native Windows process locking, USB audio, live RF, PTT/VOX, and Android
  interoperability remain unverified.

## Automatic receiver and Windows audio-path verification

- Focused receiver/API/supervisor tests: **56 passed, 18 skipped**. Includes
  named-device preference/fallback, no-fallback-on-open/configuration failure,
  status reporting, app lifespan start/stop, and APRS decoder failure isolation.
- PD90 codec suite: **12 passed** using generated real PD90 WAV audio for direct
  file decoding and streaming/chunk-boundary tests. This did not use the host
  speakers or microphone, and was not a database/spool integration run.
- APRS codec suite: **40 passed, 7 skipped**. Six real Dire Wolf WAV-round-trip
  cases were skipped because `gen_packets` and `atest` are absent from this
  Windows host; one POSIX shebang timeout fixture is also skipped.
- Installed audio stack: sounddevice **0.5.6**. Read-only Windows WASAPI
  enumeration selected `Microphone Array (2- Intel® Smart Sound Technology for
  Digital Microphones)` and `Speakers (2- Realtek(R) Audio)`. Static 48 kHz mono
  PCM16 format checks passed for both defaults. `Speakers (Epson Projection
  Audio)` is also enumerated as a separate communications output. No distinct
  external USB audio endpoint was found.
- No device stream was opened; no audio was played, captured, or digitally
  looped back. Acoustic speaker-to-microphone, USB, RF, PTT/VOX, field-noise,
  Android, and end-to-end PostGIS spool reception remain unverified. The
  opt-in database pipeline was not run because this environment lacks its
  disposable database and Dire Wolf prerequisites.
- Frontend tests: **23 passed**; production build passed with the existing
  large-bundle warning.
