"""Spool delivery identity survives replay without suppressing future beacons."""
from pathlib import Path
from unittest.mock import Mock
import wave

import pytest

from app.radio_lab.aprs import codec as aprs_codec
from app.radio_lab.runtime import RadioWorker, decode_recording
from app.radio_lab.settings import RadioSettings
from app.radio_lab.sstv import codec as sstv_codec


@pytest.fixture
def spool_receiver(tmp_path, monkeypatch):
    # Receipt lifecycle tests exercise real spool claiming and WAV validation;
    # protocol DSP has its own audio round-trip tests.
    monkeypatch.setattr(aprs_codec, "decode_wav", lambda *args, **kwargs: [
        {"kind": "position", "station": "N0CALL", "latitude": 7.9, "longitude": 125.3}
    ])

    class NoImage:
        def __init__(self, *args, **kwargs):
            pass

        def feed(self, pcm):
            return []

    monkeypatch.setattr(sstv_codec, "PD90StreamDecoder", NoImage)
    settings = RadioSettings(storage_dir=tmp_path, spool_dir=tmp_path / "incoming")
    settings.spool_dir.mkdir()
    worker = RadioWorker(Mock(), settings)
    try:
        yield worker, settings
    finally:
        for channel in (worker.tx_requests, worker.tx_results, worker.rx_inputs, worker.rx_results):
            channel.close()


def write_audio(path):
    with wave.open(str(path), "wb") as wav:
        wav.setparams((1, 2, 48000, 0, "NONE", "not compressed"))
        wav.writeframes(b"\0" * 9600)


def claim_once(worker, monkeypatch):
    claimed = []

    def receive(item):
        claimed.append(Path(item["path"]))
        worker.stop.set()

    monkeypatch.setattr(worker, "_put_input", receive)
    worker.stop.clear()
    worker._listen_spool()
    assert len(claimed) == 1
    return claimed[0]


def test_identical_audio_arriving_again_has_a_distinct_receipt(spool_receiver, monkeypatch):
    worker, settings = spool_receiver
    arrival = settings.spool_dir / "stationary-beacon.wav"
    write_audio(arrival)
    first = claim_once(worker, monkeypatch)
    first_receipt = decode_recording(first, settings)[0]["receipt_id"]
    first_bytes = first.read_bytes()
    archived = settings.spool_dir / "processed"
    archived.mkdir()
    first.replace(archived / first.name)

    # Same filename and audio represent another real reception, not replay.
    write_audio(arrival)
    second = claim_once(worker, monkeypatch)
    assert second.read_bytes() == first_bytes
    assert first.name != second.name
    assert decode_recording(second, settings)[0]["receipt_id"] != first_receipt


def test_claimed_file_replayed_after_restart_retains_its_receipt(spool_receiver, monkeypatch):
    worker, settings = spool_receiver
    write_audio(settings.spool_dir / "beacon.wav")
    claimed = claim_once(worker, monkeypatch)
    receipt = decode_recording(claimed, settings)[0]["receipt_id"]

    # Startup scans processing/ before accepting fresh incoming files.
    replayed = claim_once(worker, monkeypatch)
    assert replayed == claimed
    assert decode_recording(replayed, settings)[0]["receipt_id"] == receipt
