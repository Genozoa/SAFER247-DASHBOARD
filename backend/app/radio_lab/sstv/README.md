# PD90 receive support

The SSTV module is receive-only. It recognizes and decodes incoming PD90 audio,
stores the original image, and can write a separate enhanced copy. It does not
encode images or transmit SSTV. APRS text and position transmission remain
available through the radio worker.

## Runtime dependencies

| Component | Version/source | License | Purpose |
| --- | --- | --- | --- |
| Open-SSTV | 0.6.19, commit `d05de1dd1efe8a7ae45bf2618fd1d37a77d03184` | GPL-3.0-or-later | Headless PD90 audio decoder |
| Pillow | 11.3.0 | HPND/PIL license | Decoded-image persistence and optional enhancement |
| NumPy / SciPy | 2.3.5 / 1.17.0 | BSD licenses, bundled-library notices apply | PCM conversion and DSP |

PySSTV is not an application dependency. The tests use it only to generate
synthetic PD90 receive fixtures; install the test-only pin from
`tests/test-requirements.txt` when running those tests.

Do not copy the GPL decoder into a project without preserving its license and
reviewing distribution implications. This implementation vendors no upstream
source. A separate worker process is an execution boundary, not a license
exemption; distribution of a combined application must meet applicable
licenses. The project did not include an application license.

PD90 uses VIS code **99 (0x63)** and produces a **320x256** decoded image.
Complete recordings are about 90.9 seconds, so the shared receive path permits
up to 120 seconds and 12 MiB. This receive limit does not enable SSTV sending.

## Install the headless decoder

From `backend/`, in the backend virtual environment (Python 3.11+):

```bash
python -m pip install -r app/radio_lab/sstv/requirements.txt
python -m pip install --no-deps 'open-sstv @ git+https://github.com/bucknova/Open-SSTV.git@d05de1dd1efe8a7ae45bf2618fd1d37a77d03184'
```

`--no-deps` deliberately omits desktop-only dependencies, including PySide6,
platformdirs, tomli-w, pyserial, websocket-client and segno. `sounddevice` is
included in the pinned requirements for native radio audio input. The codec
does not open devices itself. `pip check` may report omitted desktop-application
dependencies; do not start the Open-SSTV desktop GUI in this headless
environment.

## Receive interface

```python
from pathlib import Path
from app.radio_lab.sstv.codec import decode_wav, PD90StreamDecoder

result = decode_wav(Path("received.wav"), Path("original.png"))
receiver = PD90StreamDecoder(Path("received-images"), sample_rate=48000)
results = receiver.feed(pcm16_mono_little_endian_bytes)
```

Call file decoding in the receiver worker. A persistent stream decoder accepts
consecutive PCM16 mono chunks no larger than two seconds; its state survives
arbitrary chunk boundaries. Completed frames return as result dictionaries. On
capture overflow, sample-rate change, disconnect, or a deliberate gap, call
`reset()` before resuming.

WAV input is bounded to 120 seconds, signed PCM16, 44.1/48 kHz, and one or two
channels. Stereo is averaged to mono. Unsupported WAV formats raise a validation
error; unrecognized audio and incomplete frames return no image. The original
decoded PNG is persisted separately from the optional Pillow autocontrast copy.
Enhancement is not AI reconstruction or proof of recovered detail.

Standard PD90 does not identify a sender, incident, recipient, or Android
message envelope. Results use `SSTV-UNKNOWN` with `station_identified=False`.
Incoming APRS incident metadata can be paired with received images under the
bounded session rules documented in the radio-lab README; this does not verify
sender identity.

## Focused tests

Install the optional test fixture generator and run from `backend/`:

```bash
python -m pip install -r app/radio_lab/sstv/tests/test-requirements.txt
python -m pytest app/radio_lab/sstv/tests -q
```

The synthetic PD90 fixtures exercise clean image round trips, seeded 5 dB white
noise, truncated recordings, repeated frames across 4096-sample chunks,
input-gap recovery, silence, invalid PCM, and separate immutable
original/enhanced files. PySSTV is used only in test code and is not imported by
the application.

Earlier software checks recorded in this README's history tested the receiver
using generated waveforms; they do not establish live RF, device timing,
PTT/audio levels, acoustic coupling, field noise, or Android interoperability.
