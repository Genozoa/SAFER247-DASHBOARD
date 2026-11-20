"""Process and audio-output lifecycle checks, with no physical audio devices."""
import json
import os
import subprocess
import sys
import threading
from unittest.mock import Mock
import wave

import pytest

from app.radio_lab import runtime
from app.radio_lab.aprs.codec import APRSError
from app.radio_lab.runtime import RadioWorker, encode_job, read_wav, run_command
from app.radio_lab.settings import RadioSettings


def test_configuration_defaults_do_not_open_hardware(monkeypatch, tmp_path):
    for name in list(os.environ):
        if name.startswith("RADIO_"):
            monkeypatch.delenv(name)
    monkeypatch.setenv("RADIO_STORAGE_DIR", str(tmp_path))
    settings = RadioSettings.from_env()
    assert not settings.enabled
    assert settings.input_command == settings.output_command == ()
    assert settings.input_enabled and settings.output_enabled
    assert settings.command_timeout == 60
    assert settings.max_recording_seconds == 120
    assert settings.max_wav_bytes >= 120 * settings.sample_rate * 2 + 44
    monkeypatch.setenv("RADIO_OUTPUT_COMMAND", '["aplay", "{wav}"]')
    assert RadioSettings.from_env().output_command == ("aplay", "{wav}")
    monkeypatch.setenv("RADIO_INPUT_DEVICE", "USB microphone")
    monkeypatch.setenv("RADIO_OUTPUT_DEVICE", "USB speakers")
    monkeypatch.setenv("RADIO_INPUT_ENABLED", "false")
    monkeypatch.setenv("RADIO_OUTPUT_ENABLED", "false")
    settings = RadioSettings.from_env()
    assert settings.input_device == "USB microphone"
    assert settings.output_device == "USB speakers"
    assert not settings.input_enabled and not settings.output_enabled
    monkeypatch.setenv("RADIO_INPUT_COMMAND", '"shell string"')
    with pytest.raises(ValueError):
        RadioSettings.from_env()


@pytest.mark.parametrize("rate,channels,width,frames", [(44100,1,2,10), (48000,2,2,10),
                                                       (48000,1,1,10), (48000,1,2,0)])
def test_spool_rejects_wrong_audio_profile(tmp_path, rate, channels, width, frames):
    path = tmp_path / "invalid.wav"
    with wave.open(str(path), "wb") as wav:
        wav.setparams((channels, width, rate, 0, "NONE", "not compressed"))
        wav.writeframes(b"\0" * channels * width * frames)
    with pytest.raises(ValueError):
        read_wav(path, RadioSettings())


def test_output_cancellation_prevents_process_start(tmp_path, monkeypatch):
    stop = threading.Event()
    stop.set()
    start = Mock()
    monkeypatch.setattr(subprocess, "Popen", start)
    with pytest.raises(InterruptedError):
        run_command((sys.executable, "{wav}"), tmp_path / "unused.wav", stop, 2)
    start.assert_not_called()


@pytest.mark.parametrize("mode", [None, "Robot36"])
def test_legacy_image_jobs_are_rejected_without_encoding(tmp_path, mode):
    settings = RadioSettings(output_dir=tmp_path)
    job = {"id": "legacy-image", "kind": "image", "image_path": str(tmp_path / "old.png")}
    if mode is not None:
        job["mode"] = mode
    with pytest.raises(ValueError, match="Only APRS text and position"):
        encode_job(job, settings)
    assert not list(tmp_path.glob("*.wav"))


def test_legacy_incident_compound_jobs_are_not_partially_transmitted(tmp_path):
    settings = RadioSettings(output_dir=tmp_path)
    job = {"id": "legacy-incident", "kind": "text", "text": "old fragment",
           "compound_id": "incident:historical"}
    with pytest.raises(ValueError, match="Legacy incident compound"):
        encode_job(job, settings)
    assert not list(tmp_path.glob("*.wav"))


def test_spool_rejects_duration_beyond_pd90_profile_and_oversized_files(tmp_path):
    settings = RadioSettings()
    recording = tmp_path / "too-long.wav"
    with wave.open(str(recording), "wb") as wav:
        wav.setparams((1, 2, 48000, 0, "NONE", "not compressed"))
        wav.writeframes(bytes(121 * 48000 * 2))
    with pytest.raises(ValueError, match="120 seconds"):
        read_wav(recording, settings)
    with recording.open("wb") as stream:
        stream.truncate(settings.max_wav_bytes + 1)
    with pytest.raises(ValueError, match="12 MiB"):
        read_wav(recording, settings)


def test_missing_dire_wolf_does_not_block_pd90_spool_decode(tmp_path, monkeypatch):
    source = tmp_path / "captured.wav"
    source.write_bytes(b"wav fixture")
    monkeypatch.setattr(runtime, "read_wav", lambda *_: b"\0\0" * 8)

    def unavailable_aprs(*_args, **_kwargs):
        raise APRSError("Dire Wolf executable unavailable: atest")

    class FakePD90Decoder:
        def __init__(self, *_args, **_kwargs):
            pass

        def feed(self, _pcm):
            return [{"kind": "image", "station": "SSTV-UNKNOWN", "mode": "PD90"}]

    monkeypatch.setattr("app.radio_lab.aprs.codec.decode_wav", unavailable_aprs)
    monkeypatch.setattr("app.radio_lab.sstv.codec.PD90StreamDecoder", FakePD90Decoder)
    warnings = []

    records = runtime.decode_recording(source, RadioSettings(storage_dir=tmp_path), warnings)

    assert records[0]["kind"] == "image"
    assert records[0]["mode"] == "PD90"
    assert records[0]["receipt_id"].startswith("wav:")
    assert warnings == ["APRS decoding failed: Dire Wolf executable unavailable: atest"]


def test_interrupted_and_timed_out_audio_processes_are_reaped(tmp_path):
    script = tmp_path / "output.py"
    script.write_text("import pathlib,sys,time\npathlib.Path(sys.argv[1]).write_text('started')\ntime.sleep(20)\n")
    marker = tmp_path / "marker"
    command = (sys.executable, str(script), "{wav}")
    stop = threading.Event()
    timer = threading.Timer(.2, stop.set)
    timer.start()
    try:
        with pytest.raises(InterruptedError):
            run_command(command, marker, stop, 5)
    finally:
        timer.cancel()
    assert marker.read_text() == "started"
    with pytest.raises(TimeoutError):
        run_command(command, marker, threading.Event(), .1)


def test_failed_receive_retains_replayable_id_and_processing_file(tmp_path):
    settings = RadioSettings(storage_dir=tmp_path, spool_dir=tmp_path / "incoming")
    repository = Mock()
    worker = RadioWorker(repository, settings)
    source = settings.spool_dir / "processing" / "frame.wav"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"recording")
    record = {"kind": "text", "station": "N0CALL", "text": "help", "receipt_id": "test:1"}
    repository.receive.side_effect = RuntimeError("database unavailable")
    with pytest.raises(RuntimeError):
        worker._persist_result({"source": str(source), "records": [record]})
    assert source.exists()
    repository.receive.side_effect = None
    worker._persist_result({"source": str(source), "records": [record]})
    metadata = settings.spool_dir / "processed" / "frame.wav.json"
    assert json.loads(metadata.read_text())["records"][0]["receipt_id"] == "test:1"
