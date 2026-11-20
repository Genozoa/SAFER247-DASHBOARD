"""Real synthetic audio tests. These are not radio/Android interoperability tests."""

import hashlib
import wave

import pytest

np = pytest.importorskip("numpy")
pytest.importorskip("pysstv")
pytest.importorskip("open_sstv.core.decoder")
from PIL import Image

from app.radio_lab.sstv.codec import (
    PD90StreamDecoder, decode_wav, detect_pd90, read_wav,
    save_received_image,
)


@pytest.fixture(scope="module")
def encoded(tmp_path_factory):
    folder = tmp_path_factory.mktemp("pd90")
    x = np.tile(np.arange(320) * 255 // 319, (256, 1))
    y = np.tile((np.arange(256) * 255 // 255)[:, None], (1, 320))
    pixels = np.stack([x, y, np.full_like(x, 128)], axis=-1).astype(np.uint8)
    image = Image.fromarray(pixels)
    source = folder / "source.png"
    image.save(source)
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    audio = folder / "pd90.wav"
    from pysstv.color import PD90
    PD90(image, 48_000, 16).write_wav(str(audio))
    assert hashlib.sha256(source.read_bytes()).hexdigest() == digest
    return image, audio


def _wav(path, samples, rate=48_000):
    with wave.open(str(path), "wb") as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(rate)
        stream.writeframes(np.clip(samples * 32768, -32768, 32767).astype("<i2").tobytes())
    return path


def _luma_error(original, decoded):
    return np.mean(np.abs(np.asarray(original.convert("L"), dtype=float) -
                          np.asarray(decoded.convert("L"), dtype=float)))


def test_pd90_roundtrip_preserves_original_and_separate_enhancement(encoded, tmp_path):
    original, audio = encoded
    samples, rate = read_wav(audio)
    assert rate == 48_000
    assert 90.8 < samples.size / rate < 91
    assert detect_pd90(samples, rate)
    result = decode_wav(audio, tmp_path / "original.png")
    assert result["station"] == "SSTV-UNKNOWN"
    assert result["raw"]["mode"] == "PD90"
    received = Image.open(result["original_path"])
    assert received.size == (320, 256)
    assert _luma_error(original, received) < 12.75
    digest = hashlib.sha256((tmp_path / "original.png").read_bytes()).hexdigest()
    assert result["enhanced_path"] != result["original_path"]
    assert result["enhancement_parameters"] == {
        "method": "Pillow.ImageOps.autocontrast", "cutoff": 0,
        "content_reconstruction": False,
    }
    assert Image.open(result["enhanced_path"]).size == (320, 256)
    assert hashlib.sha256((tmp_path / "original.png").read_bytes()).hexdigest() == digest
    with pytest.raises(FileExistsError):
        decode_wav(audio, tmp_path / "original.png")


def test_seeded_5db_noisy_recording(encoded, tmp_path):
    original, audio = encoded
    samples, rate = read_wav(audio)
    # Leave headroom to avoid PCM clipping; 5dB SNR is a measured synthetic case.
    samples *= 0.30
    sigma = np.sqrt(np.mean(samples ** 2) / (10 ** 0.5))
    noisy = samples + np.random.default_rng(42).normal(0, sigma, samples.size)
    result = decode_wav(_wav(tmp_path / "noisy.wav", noisy), tmp_path / "rx.png")
    assert result is not None
    assert _luma_error(original, Image.open(result["original_path"])) < 25


def test_interrupted_recording_is_not_published(encoded, tmp_path):
    _, audio = encoded
    samples, rate = read_wav(audio)
    truncated = _wav(tmp_path / "half.wav", samples[:len(samples) // 2])
    assert decode_wav(truncated, tmp_path / "rx.png") is None
    assert not (tmp_path / "rx.png").exists()


def test_truncated_last_pd90_scan_is_not_published(encoded, tmp_path):
    _, audio = encoded
    samples, rate = read_wav(audio)
    truncated = _wav(tmp_path / "missing_last_scan.wav", samples[:-rate // 20])
    assert decode_wav(truncated, tmp_path / "rx.png") is None
    assert not (tmp_path / "rx.png").exists()


def test_continuous_receiver_keeps_state_across_chunks_and_two_images(encoded, tmp_path):
    _, audio = encoded
    samples, rate = read_wav(audio)
    both = np.concatenate([samples, np.zeros(rate), samples, np.zeros(rate)])
    receiver = PD90StreamDecoder(tmp_path, rate, enhance=False)
    results = []
    for pos in range(0, len(both), 4096):
        results.extend(receiver.feed((both[pos:pos + 4096] * 32768).astype("<i2").tobytes()))
    assert len(results) == 2
    assert len({r["original_path"] for r in results}) == 2
    assert all("enhanced_path" not in result for result in results)


def test_capture_gap_reset_recovers_next_frame(encoded, tmp_path):
    _, audio = encoded
    samples, rate = read_wav(audio)
    receiver = PD90StreamDecoder(tmp_path, rate, enhance=False)
    for pos in range(0, len(samples) // 2, 4096):
        assert not receiver.feed((samples[pos:pos + 4096] * 32768).astype("<i2").tobytes())
    receiver.reset()  # Audio listener must signal input overflow/device disconnect.
    results = []
    good = np.concatenate([np.zeros(rate), samples, np.zeros(rate)])
    for pos in range(0, len(good), 4096):
        results.extend(receiver.feed((good[pos:pos + 4096] * 32768).astype("<i2").tobytes()))
    assert len(results) == 1


def test_stream_does_not_complete_without_final_luminance_scan(encoded, tmp_path):
    _, audio = encoded
    samples, rate = read_wav(audio)
    samples = samples[:-rate // 20]
    receiver = PD90StreamDecoder(tmp_path, rate, enhance=False)
    results = []
    for pos in range(0, len(samples), 4096):
        results.extend(receiver.feed((samples[pos:pos + 4096] * 32768).astype("<i2").tobytes()))
    assert results == []
    assert not list(tmp_path.glob("*.png"))


def test_stream_watchdog_discards_interruption_and_receives_next_frame(encoded, tmp_path):
    _, audio = encoded
    samples, rate = read_wav(audio)
    recording = np.concatenate([samples[:len(samples) // 2], np.zeros(rate * 120),
                                samples, np.zeros(rate)])
    receiver = PD90StreamDecoder(tmp_path, rate, enhance=False)
    results = []
    for pos in range(0, len(recording), 4096):
        results.extend(receiver.feed((recording[pos:pos + 4096] * 32768).astype("<i2").tobytes()))
    assert len(results) == 1
    assert receiver.interrupted_frames == 1


def test_enhancement_failure_keeps_received_original(tmp_path, monkeypatch):
    from PIL import ImageOps

    def fail(*args, **kwargs):
        raise OSError("simulated preview write failure")

    monkeypatch.setattr(ImageOps, "autocontrast", fail)
    result = save_received_image(Image.new("RGB", (320, 256)), tmp_path / "original.png")
    assert Image.open(result["original_path"]).size == (320, 256)
    assert "enhanced_path" not in result
    assert "simulated preview" in result["raw"]["enhancement_error"]


def test_pd90_roundtrip_at_44100(encoded, tmp_path):
    original, _ = encoded
    audio = tmp_path / "44100.wav"
    from pysstv.color import PD90
    PD90(original, 44_100, 16).write_wav(str(audio))
    samples, rate = read_wav(audio)
    assert rate == 44_100
    assert detect_pd90(samples, rate)
    result = decode_wav(audio, tmp_path / "rx.png", enhance=False)
    assert result["raw"]["vis_code"] == 99
    received = Image.open(result["original_path"])
    assert received.size == (320, 256)
    assert _luma_error(original, received) < 12.75


def test_non_pd90_vis_header_is_rejected(tmp_path):
    from pysstv.sstv import SSTV

    header_only = SSTV(None, 48_000, 16)
    header_only.VIS_CODE = 0x3C  # Scottie S1, intentionally unsupported here.
    audio = tmp_path / "other_mode.wav"
    header_only.write_wav(str(audio))
    samples, rate = read_wav(audio)
    assert not detect_pd90(samples, rate)
    assert decode_wav(audio, tmp_path / "rx.png") is None


def test_invalid_inputs_and_silence(tmp_path):
    silent = _wav(tmp_path / "silence.wav", np.zeros(48_000))
    assert decode_wav(silent, tmp_path / "rx.png") is None
    assert not detect_pd90(np.zeros(48_000), 48_000)
    with pytest.raises(ValueError, match="incomplete sample"):
        PD90StreamDecoder(tmp_path).feed(b"x")
    with pytest.raises(ValueError, match="two seconds"):
        PD90StreamDecoder(tmp_path).feed(bytes(48_000 * 6))
