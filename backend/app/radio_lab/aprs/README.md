# APRS text and positions

`codec.py` formats standard APRS addressed text and uncompressed positions,
uses the external Dire Wolf `gen_packets` modem to encode AX.25/Bell 202 AFSK
at 1200 baud, and uses Dire Wolf `atest` to decode recorded audio. `aprslib`
parses **already decoded packets**, never audio. No APRS-IS service is used.
The shared radio worker calls these blocking functions in a separate process.

## Optional persistent TCP KISS mode

**Default stays `RADIO_APRS_TRANSPORT=wav`.** The original `gen_packets`,
`atest`, WAV spool, radio output commands, and mixed-recording PD90 tests
remain available. This implementation does not alter historical database data.

Set these variables in your private root `.env` to opt in:

```dotenv
RADIO_ENABLED=true
RADIO_APRS_TRANSPORT=kiss
RADIO_KISS_HOST=127.0.0.1
RADIO_KISS_PORT=8001
RADIO_KISS_MANAGE_DIREWOLF=true
RADIO_DIREWOLF_EXE=app/radio_lab/aprs/Tools/direwolf.exe
RADIO_DIREWOLF_CONFIG=D:\\SAFER247\\direwolf-kiss.conf
RADIO_KISS_SSTV_INPUT_ENABLED=false
```

First copy `direwolf-kiss.example.conf` to that private configuration
path. Set `MYCALL` to your authorized station, configure an independent APRS
audio interface through `ADEVICE`, and configure appropriate PTT. The example
does not activate a real transmitter or authorize RF operation. Dire Wolf must
be configured to offer KISS TCP on port 8001, normally its default. Set
`RADIO_KISS_MANAGE_DIREWOLF=false` to use an externally supervised TNC.

Python opens **only loopback** TCP KISS, uses bounded byte stuffing, converts
APRS TNC2 to AX.25 UI (PID F0), and parses incoming text and positions through
`aprslib`. A persistent listener retries disconnected sockets every two
seconds and, in managed mode, restarts a terminated Dire Wolf child. The
radio worker owns the child and stops it during shutdown. Status reports the
KISS connection and codec capabilities.

**Audio-device ownership:** Dire Wolf exclusively owns the APRS radio audio.
Normal Python live audio capture stays disabled in KISS mode. For live SSTV
PD90, set `RADIO_KISS_SSTV_INPUT_ENABLED=true` **only after configuring a
different independently accessible `RADIO_INPUT_DEVICE` or a dedicated
`RADIO_INPUT_COMMAND` PCM tap**. Do not make Dire Wolf and Python compete
for the same exclusive sound device. Recorded WAV spool decoding of APRS/SSTV
continues regardless. This implementation does not auto-create a sound-device
fan-out, connect PTT hardware, or verify simultaneous physical APRS/PD90
reception.

**Delivery semantics:** TCP `sendall` only confirms local KISS submission.
It cannot confirm RF airtime, digipeating, reception or delivery. The database
records `delivery_unknown` after submission, and failures after an attempted
send require an explicit operator retry. No automatic retransmission follows
a reconnect or restart.

When KISS is disconnected, outgoing queue rows remain queued. A connection
can fail after an attempt begins, so such attempts remain `delivery_unknown`
rather than being replayed automatically. Existing Demo restrictions apply.
Keep `RADIO_OUTPUT_ENABLED=false` for connection/receive-only software
checks and use a mock TCP KISS TNC for automated tests. Live transmitting is
never part of the automated suite.

## Installation

From `backend`, install the project's normal dependencies, then:

```sh
python -m pip install -r app/radio_lab/aprs/requirements.txt
```

Install Dire Wolf separately. On Debian/Ubuntu, a distribution package may
provide `direwolf`, `gen_packets`, and `atest`; verify both tools are on PATH.
For the exact source version tested here:

```sh
# Install a C compiler, make, cmake, and ALSA development headers first.
git clone --branch 1.8.1 --depth 1 https://github.com/wb2osz/direwolf.git direwolf
cmake -S direwolf -B direwolf/build -DOPTIONAL_DNSSD=OFF
cmake --build direwolf/build --target gen_packets atest -j2
```

Point the radio configuration's `RADIO_GEN_PACKETS` and `RADIO_ATEST` at the
resulting executable files, or add `direwolf/build/src` to PATH. Follow
`../README.md` for shared database, worker, API, audio-spool setup and startup.
Building the offline tools does not configure a sound card, PTT, or radio.

## Supported envelope and constraints

- `encode_text(station, text, output_path, addressee='ALL', gen_packets='gen_packets', sample_rate=48000)`
- `encode_position(station, latitude, longitude, output_path, text='', gen_packets='gen_packets', sample_rate=48000)`
- `decode_wav(path, atest='atest', maximum_seconds=45)` returns all supported valid frames as dictionaries
  with `kind`, `station`, `text`, `raw`, and optional `latitude`/`longitude`.
- `build_text`, `build_position`, and `parse_packet` expose packet-only operations.
  Packet builders have no third-party imports and can validate before queuing.

Text is printable ASCII, at most 67 bytes, excluding `{`, `|`, and `~` protocol
characters. The addressee is at most nine letters, digits, underscores, or
hyphens; `ALL` is the default application address, without an assumed Android
mapping. Reserved `ack123`/`rej123` forms are rejected as user text. This change
does not implement APRS acknowledgments, retries, digipeater paths, encryption,
or a proprietary incident envelope. Position comments permit up to 43 ASCII
characters and exclude the telemetry `|` delimiter. A station is an AX.25
address with one to six alphanumeric characters and optional SSID 0–15.

Uncompressed coordinates have 0.01-minute resolution (about 18.5 m latitude).
Rounding carries correctly across degree boundaries. **aprslib 0.7.2 rejects
exact ±90° latitude and ±180° longitude.** Positions rounding to these limits
are rejected explicitly rather than queued as a successful round trip.

The audio format is mono, signed 16-bit PCM WAV at 48,000 Hz. Standalone APRS
recordings must be nonempty and at most 45 seconds by default. The shared
APRS/SSTV spool path may explicitly call `decode_wav(..., maximum_seconds=120)`
to inspect longer recordings needed by the SSTV PD90 profile. This only extends
the bounded recording duration: APRS remains text/location, and PD90 remains an
SSTV image mode. `maximum_seconds` must be finite, greater than zero, and at
most 120. Direct APRS encoding and the continuous APRS window sizes retain
their existing limits. Malformed/truncated files fail clearly. Offline modem
calls time out after 30 seconds. Output replaces its destination only after a
valid WAV is complete; partial temporary audio is removed on failure.
`gen_packets` receives one packet without a trailing newline because its
1.8.1 stdin implementation otherwise transmits that newline inside the frame.
`atest -F 0` disables bit repair. Invalid/unsupported AX.25 frames are skipped
without discarding following valid APRS messages. Silence returns an empty list.

## Reproduced software tests

From `backend`, with both Dire Wolf tools installed or their explicit paths set:

```sh
RADIO_GEN_PACKETS=/path/to/gen_packets RADIO_ATEST=/path/to/atest \
  python -m pytest app/radio_lab/aprs/tests -q
```

Observed with Python 3.12.14, aprslib 0.7.2, Dire Wolf 1.8.1:
**47 passed**, including actual text/position audio round trips, 20 consecutive
frames, a deterministic Gaussian white-noise recording at 12 dB nominal SNR,
interrupted-frame rejection, silence, malformed inputs, and a real process
timeout preserving an existing output. A 94-second synthetic WAV containing
APRS text near the beginning and a position after 90 seconds is rejected by
the unchanged 45-second default and decodes both frames with the explicit
120-second shared-spool bound. Nonfinite and out-of-range duration limits are
rejected before invoking the modem. This long recording test does not itself
exercise PD90 image decoding; see the separate SSTV tests. Modem-dependent tests explicitly skip
when binaries are absent. The consecutive recording test proves decoding of
multiple complete frames in one file; continuous capture/spool tests belong to
the shared worker and do not establish live sound-device reception.

Inspected aprslib upstream commit
`c2a0f18ce028a4cced582567a73d57f0d03cd00f`: full upstream tests reported
**110 passed, 19 failed**, because its `mox3` test helper calls
`inspect.getargspec`, removed in Python 3.11. Running the non-mock-dependent
subset with `--ignore=tests/test_IS.py --ignore=tests/test_parse.py` reported
**96 passed, 13 warnings** (deprecated UTC datetime usage). No compatibility
monkeypatch was applied. The application does not use APRS-IS networking.

Dire Wolf 1.8.1's applicable upstream `test/scripts/check-modem1200` commands
were also reproduced without modifying their parameters: generate 100 frames
with increasing synthetic noise, then run four `atest` profiles. All four
returned exit 0 within their upstream acceptance bounds:

| Decoder options | Decoded / 100 | Upstream allowed range |
| --- | --- | --- |
| `-F0 -PA -D1` | 72 | 66–72 |
| `-F1 -PA -D1` | 77 | 72–78 |
| `-F0 -PB -D1` | 72 | 66–74 |
| `-F1 -PB -D1` | 78 | 70–82 |

Those upstream noise tests include bit-repair profiles for comparison; the
application adapter itself always uses `-F 0` without bit repair.

The synthetic noise test is one controlled signal case, not a receiver
sensitivity or interference measurement. No RF, sound device, PTT, antenna,
licensed station identity, or Android application was connected or verified.
