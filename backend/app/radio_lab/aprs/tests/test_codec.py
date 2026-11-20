"""Hardware-independent APRS tests; modem tests require Dire Wolf tools."""
from array import array
import math
import os
import random
import shutil
import sys
import wave

import pytest

from app.radio_lab.aprs import codec


@pytest.fixture
def modem():
    generator = os.environ.get("RADIO_GEN_PACKETS", "gen_packets")
    decoder = os.environ.get("RADIO_ATEST", "atest")
    if not shutil.which(generator) or not shutil.which(decoder):
        pytest.skip("Dire Wolf tools unavailable; no audio round trip performed")
    pytest.importorskip("aprslib")
    return generator, decoder


def _frames(path):
    with wave.open(str(path), "rb") as source:
        return source.readframes(source.getnframes())


def _write(path, data):
    with wave.open(str(path), "wb") as destination:
        destination.setparams((1, 2, 48000, 0, "NONE", "not compressed"))
        destination.writeframes(data)


def test_text_packet_round_trip():
    pytest.importorskip("aprslib")
    packet = codec.build_text("n0call-1", "Water level rising.", "COMMAND")
    assert codec.parse_packet(packet) == {
        "kind": "text", "station": "N0CALL-1", "text": "Water level rising.", "raw": packet,
    }
    assert "::COMMAND  :" in packet


@pytest.mark.parametrize("latitude,longitude", [(7.9186, 125.3286), (-7.9186, -125.3286),
                                                 (0, 0), (12.999999, 123.999999)])
def test_position_packet_round_trip(latitude, longitude):
    pytest.importorskip("aprslib")
    result = codec.parse_packet(codec.build_position("N0CALL", latitude, longitude, "Position"))
    assert result["kind"] == "position"
    assert result["text"] == "Position"
    assert result["latitude"] == pytest.approx(latitude, abs=1 / 6000)
    assert result["longitude"] == pytest.approx(longitude, abs=1 / 6000)


@pytest.mark.parametrize("text", ["", " ", "x" * 68, "line\nbreak", "café", "message{123", "a|b", "a~b", "ack123"])
def test_invalid_text_rejected_before_audio(text):
    with pytest.raises(codec.APRSError):
        codec.build_text("N0CALL", text)


@pytest.mark.parametrize("station", ["A B", "CALLSIGNTOOLONG", "N0CALL-16", "N0CALL,OTHER", "A>B"])
def test_invalid_station(station):
    with pytest.raises(codec.APRSError):
        codec.build_text(station, "Hello")


@pytest.mark.parametrize("latitude,longitude", [(math.nan, 0), (0, math.inf), (91, 0), (0, -181), (90, 0), (0, 180)])
def test_invalid_or_unsupported_boundary_positions(latitude, longitude):
    with pytest.raises(codec.APRSError):
        codec.build_position("N0CALL", latitude, longitude)


@pytest.mark.parametrize("packet", ["", "garbage", "N0CALL>APRS::ALL      :Hi\n", "N0CALL>APRS:>Status only"])
def test_invalid_or_unsupported_packet(packet):
    pytest.importorskip("aprslib")
    with pytest.raises(codec.APRSError):
        codec.parse_packet(packet)


def test_text_and_position_audio_round_trips(tmp_path, modem):
    generator, decoder = modem
    text = codec.encode_text("N0CALL-1", "Evacuate to higher ground.", tmp_path / "text.wav", gen_packets=generator)
    result = codec.decode_wav(text, atest=decoder)
    assert len(result) == 1
    assert result[0]["text"] == "Evacuate to higher ground."
    assert result[0]["station"] == "N0CALL-1"
    assert "<0x0a>" not in result[0]["raw"]
    position = codec.encode_position("N0CALL", 7.9186, 125.3286, tmp_path / "position.wav",
                                     text="Responder", gen_packets=generator)
    result = codec.decode_wav(position, atest=decoder)
    assert len(result) == 1
    assert result[0]["kind"] == "position"
    assert result[0]["latitude"] == pytest.approx(7.9186, abs=1 / 6000)
    assert result[0]["longitude"] == pytest.approx(125.3286, abs=1 / 6000)


def test_twenty_consecutive_frames(tmp_path, modem):
    generator, decoder = modem
    audio = []
    expected = [f"Sequence {number}" for number in range(20)]
    for text in expected:
        path = codec.encode_text("N0CALL", text, tmp_path / "one.wav", gen_packets=generator)
        audio.append(_frames(path))
    recording = tmp_path / "consecutive.wav"
    _write(recording, b"".join(audio))
    assert [packet["text"] for packet in codec.decode_wav(recording, atest=decoder)] == expected


def test_deterministic_white_noise_at_12_db_snr(tmp_path, modem):
    generator, decoder = modem
    clean = codec.encode_text("N0CALL", "Noisy recording", tmp_path / "clean.wav", gen_packets=generator)
    samples = array("h")
    samples.frombytes(_frames(clean))
    if sys.byteorder != "little":
        samples.byteswap()
    rms = math.sqrt(sum(float(value) ** 2 for value in samples) / len(samples))
    sigma = rms / (10 ** (12 / 20))
    noise = random.Random(247)
    noisy = array("h", (max(-32768, min(32767, round(value + noise.gauss(0, sigma)))) for value in samples))
    if sys.byteorder != "little":
        noisy.byteswap()
    recording = tmp_path / "noisy.wav"
    _write(recording, noisy.tobytes())
    assert [result["text"] for result in codec.decode_wav(recording, atest=decoder)] == ["Noisy recording"]


def test_interrupted_packet_not_accepted(tmp_path, modem):
    generator, decoder = modem
    full = codec.encode_text("N0CALL", "Interrupted packet must not be accepted", tmp_path / "full.wav", gen_packets=generator)
    data = _frames(full)
    interrupted = tmp_path / "interrupted.wav"
    _write(interrupted, data[:(len(data) // 6) * 2])
    assert codec.decode_wav(interrupted, atest=decoder) == []


def test_truncated_wav_rejected(tmp_path):
    recording = tmp_path / "truncated.wav"
    _write(recording, b"\x00\x00" * 480)
    recording.write_bytes(recording.read_bytes()[:-100])
    with pytest.raises(codec.APRSError, match="truncated"):
        codec.decode_wav(recording)


def test_silence_not_packet(tmp_path, modem):
    _, decoder = modem
    recording = tmp_path / "silence.wav"
    _write(recording, b"\x00\x00" * 48000)
    assert codec.decode_wav(recording, atest=decoder) == []


def test_bad_wav_and_missing_binary(tmp_path):
    invalid = tmp_path / "invalid.wav"
    invalid.write_bytes(b"not audio")
    with pytest.raises(codec.APRSError, match="WAV"):
        codec.decode_wav(invalid)
    with pytest.raises(codec.APRSError, match="unavailable"):
        codec.encode_text("N0CALL", "Hello", tmp_path / "output.wav", gen_packets=str(tmp_path / "missing"))
    assert not (tmp_path / "output.wav").exists()


def test_real_timeout_preserves_previous_output(tmp_path, monkeypatch):
    if os.name == "nt":
        pytest.skip("Shebang executable timeout fixtures are POSIX-only; Windows subprocess timeout is tested by runtime command mocks")
    script = tmp_path / "slow-modem"
    script.write_text(f"#!{sys.executable}\nimport pathlib,sys,time\n"
                      "pathlib.Path(sys.argv[sys.argv.index('-o')+1]).write_bytes(b'partial')\n"
                      "time.sleep(5)\n")
    script.chmod(0o755)
    destination = tmp_path / "original.wav"
    destination.write_bytes(b"existing recording")
    monkeypatch.setattr(codec, "_TIMEOUT", 0.1)
    with pytest.raises(codec.APRSError, match="timed out"):
        codec.encode_text("N0CALL", "Hello", destination, gen_packets=str(script))
    assert destination.read_bytes() == b"existing recording"
    assert not list(tmp_path.glob(".aprs-*.wav"))


@pytest.mark.parametrize("maximum_seconds", [0, -1, 120.001, math.nan, math.inf,
                                               -math.inf, None, "invalid", True])
def test_invalid_recording_duration_limit_is_rejected_before_modem(tmp_path, maximum_seconds):
    recording = tmp_path / "silence.wav"
    _write(recording, bytes(480))
    with pytest.raises(codec.APRSError, match="maximum_seconds"):
        codec.decode_wav(recording, atest=str(tmp_path / "missing-modem"),
                         maximum_seconds=maximum_seconds)


def test_shared_sstv_spool_can_inspect_aprs_beyond_default_45_seconds(tmp_path, modem):
    """A shared 120-second detection bound must preserve packets after 90s."""
    generator, decoder = modem
    text = _frames(codec.encode_text("N0CALL", "Before long SSTV interval", tmp_path / "text.wav",
                                      gen_packets=generator))
    position = _frames(codec.encode_position("N0CALL-1", 7.9186, 125.3286,
                                             tmp_path / "position.wav", text="After 90 seconds",
                                             gen_packets=generator))
    bytes_per_second = 48000 * 2
    position_start = 91 * bytes_per_second
    recording = tmp_path / "shared-94-seconds.wav"
    data = (bytes(bytes_per_second) + text
            + bytes(position_start - bytes_per_second - len(text)) + position
            + bytes(94 * bytes_per_second - position_start - len(position)))
    _write(recording, data)
    assert len(data) == 94 * bytes_per_second
    with pytest.raises(codec.APRSError, match="45 seconds"):
        codec.decode_wav(recording, atest=decoder)
    result = codec.decode_wav(recording, atest=decoder, maximum_seconds=120)
    assert len(result) == 2
    assert result[0]["kind"] == "text" and result[0]["text"] == "Before long SSTV interval"
    assert result[1]["kind"] == "position" and result[1]["text"] == "After 90 seconds"
    assert result[1]["latitude"] == pytest.approx(7.9186, abs=1 / 6000)
    assert result[1]["longitude"] == pytest.approx(125.3286, abs=1 / 6000)
