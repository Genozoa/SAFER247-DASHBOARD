import threading
from types import SimpleNamespace

import pytest

from app.radio_lab import audio_devices
from app.radio_lab.audio_devices import AudioDeviceError, AudioDeviceManager, resolve_audio_device
from app.radio_lab.settings import RadioSettings


class FakeSoundDevice:
    def __init__(self):
        self.devices = [
            {"name": "USB Microphone", "max_input_channels": 1, "max_output_channels": 0},
            {"name": "USB Speakers", "max_input_channels": 0, "max_output_channels": 2},
            {"name": "Built-in Microphone", "max_input_channels": 1, "max_output_channels": 0},
            {"name": "Built-in Speakers", "max_input_channels": 0, "max_output_channels": 2},
        ]
        self.default = SimpleNamespace(device=(2, 3))
        self.output_streams = []
        self.input_checks = []

    def query_devices(self):
        return list(self.devices)

    def check_input_settings(self, **kwargs):
        self.input_checks.append(kwargs)

    def check_output_settings(self, **kwargs):
        return None

    def RawInputStream(self, **kwargs):
        return kwargs

    def RawOutputStream(self, **kwargs):
        stream = FakeOutputStream()
        self.output_streams.append((kwargs, stream))
        return stream


class FakeOutputStream:
    def __init__(self):
        self.writes = []

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def write(self, pcm):
        self.writes.append(pcm)


@pytest.fixture
def fake_sounddevice(monkeypatch):
    fake = FakeSoundDevice()
    monkeypatch.setattr(audio_devices.importlib, "import_module", lambda _: fake)
    return fake


def test_configured_devices_are_preferred_over_host_defaults(fake_sounddevice):
    input_device = resolve_audio_device("input", "USB Microphone")
    output_device = resolve_audio_device("output", "USB Speakers")

    assert (input_device.device_id, input_device.source) == (0, "configured")
    assert (output_device.device_id, output_device.source) == (1, "configured")
    assert input_device.name == "USB Microphone"


def test_windows_defaults_and_duplicate_names_prefer_wasapi(fake_sounddevice):
    fake_sounddevice.devices = [
        {"name": "USB Microphone", "hostapi": 0, "max_input_channels": 1, "max_output_channels": 0},
        {"name": "USB Microphone", "hostapi": 1, "max_input_channels": 1, "max_output_channels": 0},
        {"name": "USB Speakers", "hostapi": 0, "max_input_channels": 0, "max_output_channels": 2},
        {"name": "USB Speakers", "hostapi": 1, "max_input_channels": 0, "max_output_channels": 2},
    ]
    fake_sounddevice.default.device = (0, 2)
    fake_sounddevice.query_hostapis = lambda: [
        {"name": "MME", "default_input_device": 0, "default_output_device": 2},
        {"name": "Windows WASAPI", "default_input_device": 1, "default_output_device": 3},
    ]

    default_input = resolve_audio_device("input", None)
    configured_output = resolve_audio_device("output", "USB Speakers")

    assert default_input.device_id == 1
    assert configured_output.device_id == 3


def test_missing_configured_devices_fall_back_to_host_defaults(fake_sounddevice):
    manager = AudioDeviceManager(
        RadioSettings(input_device="External USB mic", output_device="External USB speakers")
    )

    assert manager.input_selection.name == "Built-in Microphone"
    assert manager.output_selection.name == "Built-in Speakers"
    assert manager.input_selection.fallback_reason
    assert manager.output_selection.fallback_reason


def test_connected_but_unsupported_configured_device_does_not_fall_back(
    fake_sounddevice, monkeypatch
):
    def reject_format(**_):
        raise ValueError("unsupported sample format")

    monkeypatch.setattr(fake_sounddevice, "check_input_settings", reject_format)
    manager = AudioDeviceManager(RadioSettings(input_device="USB Microphone"))

    assert manager.input_selection is None
    assert "USB Microphone" in manager.input_error
    assert "unsupported sample format" in manager.input_error


def test_disconnected_selected_input_reports_error_without_switching(
    fake_sounddevice,
):
    manager = AudioDeviceManager(RadioSettings(input_device="USB Microphone"))
    fake_sounddevice.devices = fake_sounddevice.devices[1:]

    with pytest.raises(AudioDeviceError, match="no longer connected"):
        manager.open_input_stream()


def test_startup_enumerates_but_does_not_play_audio(fake_sounddevice):
    manager = AudioDeviceManager(RadioSettings())

    assert manager.output_selection.name == "Built-in Speakers"
    assert fake_sounddevice.output_streams == []

    started = []
    pcm = b"\x00\x00" * 4_096
    manager.play_pcm(pcm, threading.Event(), on_start=lambda: started.append(True))

    assert started == [True]
    assert fake_sounddevice.output_streams[0][1].writes == [pcm]


def test_command_overrides_remain_selected_without_native_audio_lookup(fake_sounddevice):
    manager = AudioDeviceManager(
        RadioSettings(input_command=("capture.exe", "--raw"), output_command=("play.exe", "{wav}"))
    )

    assert manager.input_selection.source == "command"
    assert manager.output_selection.source == "command"
    assert manager.input_selection.name == "capture.exe --raw"
    assert fake_sounddevice.input_checks == []
