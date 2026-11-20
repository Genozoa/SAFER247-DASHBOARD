"""PD90 reception codecs. No sound device is provided."""

from __future__ import annotations

import wave
from pathlib import Path
from uuid import uuid4

SAMPLE_RATES = (44_100, 48_000)
MAX_RECORDING_SECONDS = 120
# PD90 has 128 two-row scan groups: sync + porch + Y0/Cr/Cb/Y1 scans.
PD90_PAYLOAD_SECONDS = 128 * (20 + 2.08 + 4 * 320 * 0.532) / 1000
PD90_VIS_CODE = 0x63
STREAM_FRAME_TIMEOUT_SECONDS = 110


def read_wav(path: str | Path):
    """Read bounded PCM16 mono/stereo audio, returning normalized mono + rate."""
    import numpy as np

    with wave.open(str(path), "rb") as wav:
        rate, channels = wav.getframerate(), wav.getnchannels()
        if rate not in SAMPLE_RATES or channels not in (1, 2):
            raise ValueError("WAV must be 44100/48000 Hz mono/stereo")
        if wav.getsampwidth() != 2 or wav.getcomptype() != "NONE":
            raise ValueError("WAV must contain uncompressed signed PCM16")
        frames = wav.getnframes()
        if frames <= 0 or frames > rate * MAX_RECORDING_SECONDS:
            raise ValueError("WAV must contain between 1 sample and 120 seconds")
        pcm = wav.readframes(frames)
        if len(pcm) != frames * channels * 2:
            raise ValueError("WAV data is truncated")
    samples = np.frombuffer(pcm, dtype="<i2").astype(np.float64) / 32768.0
    if channels == 2:
        samples = samples.reshape(-1, 2).mean(axis=1)
    return samples, rate


def detect_pd90(samples, sample_rate: int) -> bool:
    """Require actual PD90 VIS code 99; audio energy is not a mode ID."""
    from open_sstv.core.dsp_utils import sstv_bandpass
    from open_sstv.core.vis import detect_vis

    if sample_rate not in SAMPLE_RATES:
        raise ValueError("PD90 sample rate must be 44100 or 48000 Hz")
    if len(samples) < sample_rate // 2:
        return False
    result = detect_vis(sstv_bandpass(samples, sample_rate), sample_rate)
    return result is not None and result[0] == PD90_VIS_CODE


def save_received_image(image, output_path: str | Path, *, enhance: bool = True,
                        raw: dict | None = None) -> dict:
    """Write original exactly once; enhancement always has a separate file."""
    from PIL import ImageOps

    original = Path(output_path)
    original.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation prevents a collision from overwriting received evidence.
    with original.open("xb") as stream:
        image.convert("RGB").save(stream, format="PNG")
    metadata = {"mode": "PD90", "vis_code": PD90_VIS_CODE, "station_identified": False}
    metadata.update(raw or {})
    result = {"kind": "image", "station": "SSTV-UNKNOWN",
              "original_path": str(original), "raw": metadata}
    if enhance:
        enhanced = original.with_name(original.stem + ".enhanced.png")
        try:
            processed = ImageOps.autocontrast(image.convert("RGB"), cutoff=0)
            with enhanced.open("xb") as stream:
                processed.save(stream, format="PNG")
        except OSError as exc:
            # A secondary preview failure must not hide the received original.
            metadata["enhancement_error"] = str(exc)
        else:
            result["enhanced_path"] = str(enhanced)
            result["enhancement_parameters"] = {
                "method": "Pillow.ImageOps.autocontrast", "cutoff": 0,
                "content_reconstruction": False,
            }
            metadata["enhancement"] = "Pillow autocontrast (cutoff=0); no content reconstruction"
    return result


def decode_wav(path: str | Path, output_path: str | Path, *, enhance: bool = True):
    """Decode the first complete PD90 frame or return None.

    Standard SSTV carries no trusted sender or incident ID. Do not associate an
    image with a responder/incident merely because an APRS packet arrived nearby.
    """
    from open_sstv.core.decoder import decode_wav as decode_samples
    from open_sstv.core.dsp_utils import sstv_bandpass
    from open_sstv.core.modes import Mode
    from open_sstv.core.vis import detect_vis

    samples, rate = read_wav(path)
    header = detect_vis(sstv_bandpass(samples, rate), rate)
    if header is None or header[0] != PD90_VIS_CODE:
        return None
    # The upstream batch decoder rejects a half-frame but only checks the last
    # pair's start. Require the final 703.04 ms pair (10 ms DSP tolerance).
    if samples.size - header[1] < rate * (PD90_PAYLOAD_SECONDS - 0.010):
        return None
    result = decode_samples(samples, rate)
    if result is None or result.mode != Mode.PD_90:
        return None
    return save_received_image(result.image, output_path, enhance=enhance,
                               raw={"sample_rate": rate, "source": "audio"})


class PD90StreamDecoder:
    """Continuous PCM16 receiver, retaining decoder state across audio chunks.

    Instantiate inside a persistent receiver process, then pass mono little-endian
    signed PCM16 bytes. A capture gap/overrun must call reset(): joining audio
    across a dropped chunk would invent timing. Incomplete frames are discarded.
    A sample-time watchdog bounds a stuck frame and returns to VIS detection.
    """

    def __init__(self, storage_dir: str | Path, sample_rate: int = 48_000,
                 enhance: bool = True):
        from open_sstv.core.decoder import Decoder

        if sample_rate not in SAMPLE_RATES:
            raise ValueError("PD90 sample rate must be 44100 or 48000 Hz")
        self.storage_dir = Path(storage_dir)
        self.sample_rate = sample_rate
        self.enhance = enhance
        self._decoder = Decoder(sample_rate, incremental_decode=True)
        self._active_samples: int | None = None
        self.interrupted_frames = 0

    def reset(self):
        self._decoder.reset()
        self._active_samples = None

    def feed(self, pcm_bytes: bytes) -> list[dict]:
        import numpy as np
        from open_sstv.core.decoder import ImageComplete, ImageStarted
        from open_sstv.core.modes import Mode

        if len(pcm_bytes) % 2:
            self.reset()
            raise ValueError("PCM16 chunk has an incomplete sample")
        if not pcm_bytes:
            return []
        # Bound a caller error; continuous listeners should supply ~0.1s chunks.
        if len(pcm_bytes) > 2 * self.sample_rate * 2:
            raise ValueError("Streaming chunks must not exceed two seconds")
        samples = np.frombuffer(pcm_bytes, dtype="<i2").astype(np.float64) / 32768.0
        if self._active_samples is not None:
            self._active_samples += samples.size
            if self._active_samples > self.sample_rate * STREAM_FRAME_TIMEOUT_SECONDS:
                self.interrupted_frames += 1
                self.reset()
        results = []
        for event in self._decoder.feed(samples):
            if isinstance(event, ImageStarted):
                if event.mode != Mode.PD_90:
                    self.reset()
                    continue
                self._active_samples = 0
            elif isinstance(event, ImageComplete):
                self._active_samples = None
                if event.mode == Mode.PD_90:
                    results.append(save_received_image(
                        event.image, self.storage_dir / f"{uuid4().hex}.original.png",
                        enhance=self.enhance,
                        raw={"sample_rate": self.sample_rate, "source": "continuous_audio"},
                    ))
        return results
