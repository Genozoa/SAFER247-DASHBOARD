from __future__ import annotations

import importlib
from dataclasses import dataclass, replace
from typing import Any, Literal

from .settings import RadioSettings

AudioDirection = Literal["input", "output"]


class AudioDeviceError(RuntimeError):
    pass


@dataclass(frozen=True)
class AudioDeviceSelection:
    direction: AudioDirection
    device_id: int | None
    name: str
    source: str
    configured_name: str | None = None
    fallback_reason: str | None = None


def _sounddevice() -> Any:
    try:
        return importlib.import_module("sounddevice")
    except ImportError as exc:
        raise AudioDeviceError(
            "Native audio requires the sounddevice package; install the radio requirements."
        ) from exc


def _device_channels(device: dict[str, Any], direction: AudioDirection) -> int:
    key = "max_input_channels" if direction == "input" else "max_output_channels"
    return int(device.get(key, 0))


def _validate_format(
    sounddevice: Any,
    direction: AudioDirection,
    device_id: int,
    device_name: str,
) -> None:
    check = (
        sounddevice.check_input_settings
        if direction == "input"
        else sounddevice.check_output_settings
    )
    try:
        check(device=device_id, samplerate=48_000, channels=1, dtype="int16")
    except Exception as exc:
        raise AudioDeviceError(
            f"Selected {direction} device '{device_name}' does not support mono "
            f"48 kHz PCM16 audio: {exc}"
        ) from exc


def _preferred_hostapi_indices(sounddevice: Any) -> set[int]:
    query = getattr(sounddevice, "query_hostapis", None)
    if query is None:
        return set()
    try:
        hostapis = list(query())
    except Exception as exc:
        raise AudioDeviceError(f"Could not enumerate audio host APIs: {exc}") from exc
    return {
        index
        for index, hostapi in enumerate(hostapis)
        if str(hostapi.get("name", "")).casefold() == "windows wasapi"
    }


def _prefer_hostapi(
    matches: list[int],
    devices: list[dict[str, Any]],
    preferred_hostapis: set[int],
) -> list[int]:
    if not preferred_hostapis:
        return matches
    preferred = [
        index
        for index in matches
        if devices[index].get("hostapi") in preferred_hostapis
    ]
    return preferred or matches


def _default_device_id(
    sounddevice: Any,
    direction: AudioDirection,
    devices: list[dict[str, Any]],
    preferred_hostapis: set[int],
) -> int | None:
    if preferred_hostapis:
        hostapis = list(sounddevice.query_hostapis())
        hostapi = hostapis[min(preferred_hostapis)]
        key = "default_input_device" if direction == "input" else "default_output_device"
        hostapi_default = hostapi.get(key)
        if hostapi_default is not None and int(hostapi_default) >= 0:
            return int(hostapi_default)
    defaults = sounddevice.default.device
    default_id = defaults[0 if direction == "input" else 1]
    return None if default_id is None or int(default_id) < 0 else int(default_id)


def resolve_audio_device(
    direction: AudioDirection,
    configured_name: str | None,
) -> AudioDeviceSelection:
    sounddevice = _sounddevice()
    try:
        devices = list(sounddevice.query_devices())
    except Exception as exc:
        raise AudioDeviceError(
            f"Could not enumerate audio devices for {direction}: {exc}"
        ) from exc
    channel_key = "input" if direction == "input" else "output"
    selector = (configured_name or "").strip()
    fallback_reason: str | None = None
    device_id: int | None = None
    preferred_hostapis = _preferred_hostapi_indices(sounddevice)

    if selector:
        exact = [
            index
            for index, device in enumerate(devices)
            if str(device.get("name", "")).casefold() == selector.casefold()
        ]
        matches = exact or [
            index
            for index, device in enumerate(devices)
            if selector.casefold() in str(device.get("name", "")).casefold()
        ]
        matches = _prefer_hostapi(matches, devices, preferred_hostapis)
        if len(matches) > 1:
            raise AudioDeviceError(
                f"Configured {direction} device '{selector}' matches multiple audio devices."
            )
        if matches:
            device_id = matches[0]
            if _device_channels(devices[device_id], direction) < 1:
                raise AudioDeviceError(
                    f"Configured {direction} device '{selector}' is connected but has no "
                    f"{direction} audio channels."
                )
        else:
            fallback_reason = (
                f"Configured {direction} device '{selector}' is not connected; "
                "using the host default device."
            )

    source = "configured"
    if device_id is None:
        try:
            default_id = _default_device_id(
                sounddevice, direction, devices, preferred_hostapis
            )
        except Exception as exc:
            raise AudioDeviceError(
                f"Could not read the host default {direction} audio device: {exc}"
            ) from exc
        if default_id is None:
            detail = f"Configured {direction} device '{selector}' was not found. " if selector else ""
            raise AudioDeviceError(
                f"{detail}No host default {direction} audio device is available."
            )
        device_id = default_id
        if device_id >= len(devices) or _device_channels(devices[device_id], direction) < 1:
            raise AudioDeviceError(
                f"Host default {direction} audio device is unavailable or has no "
                f"{channel_key} channels."
            )
        source = "host-default"

    device = devices[device_id]
    device_name = str(device.get("name", f"Audio device {device_id}"))
    _validate_format(sounddevice, direction, device_id, device_name)
    return AudioDeviceSelection(
        direction=direction,
        device_id=device_id,
        name=device_name,
        source=source,
        configured_name=selector or None,
        fallback_reason=fallback_reason,
    )


class AudioDeviceManager:
    def __init__(self, settings: RadioSettings) -> None:
        self.settings = settings
        self.input_selection: AudioDeviceSelection | None = None
        self.output_selection: AudioDeviceSelection | None = None
        self.input_error: str | None = None
        self.output_error: str | None = None

        if not settings.input_enabled:
            self.input_selection = None
        elif settings.input_command:
            self.input_selection = AudioDeviceSelection(
                "input", None, " ".join(settings.input_command), "command"
            )
        else:
            try:
                self.input_selection = resolve_audio_device(
                    "input", settings.input_device
                )
            except AudioDeviceError as exc:
                self.input_error = str(exc)

        if not settings.output_enabled:
            self.output_selection = None
        elif settings.output_command:
            self.output_selection = AudioDeviceSelection(
                "output", None, " ".join(settings.output_command), "command"
            )
        else:
            try:
                self.output_selection = resolve_audio_device(
                    "output", settings.output_device
                )
            except AudioDeviceError as exc:
                self.output_error = str(exc)

    def status(self) -> dict[str, Any]:
        return {
            "input_device": self.input_selection.name if self.input_selection else None,
            "input_source": self.input_selection.source if self.input_selection else None,
            "input_state": (
                "disabled"
                if not self.settings.input_enabled
                else "selected" if self.input_selection else "error"
            ),
            "input_error": self.input_error,
            "input_fallback_reason": (
                self.input_selection.fallback_reason if self.input_selection else None
            ),
            "output_device": self.output_selection.name if self.output_selection else None,
            "output_source": self.output_selection.source if self.output_selection else None,
            "output_state": (
                "disabled"
                if not self.settings.output_enabled
                else "selected" if self.output_selection else "error"
            ),
            "output_error": self.output_error,
            "output_fallback_reason": (
                self.output_selection.fallback_reason if self.output_selection else None
            ),
        }

    def _ensure_connected(
        self, selection: AudioDeviceSelection
    ) -> AudioDeviceSelection:
        if selection.source == "command":
            return selection
        sounddevice = _sounddevice()
        devices = list(sounddevice.query_devices())
        matches = _prefer_hostapi([
            index
            for index, device in enumerate(devices)
            if str(device.get("name", "")).casefold() == selection.name.casefold()
        ], devices, _preferred_hostapi_indices(sounddevice))
        if not matches:
            raise AudioDeviceError(
                f"Selected {selection.direction} device '{selection.name}' is no longer connected."
            )
        if len(matches) > 1:
            raise AudioDeviceError(
                f"Selected {selection.direction} device '{selection.name}' is ambiguous."
            )
        if _device_channels(devices[matches[0]], selection.direction) < 1:
            raise AudioDeviceError(
                f"Selected {selection.direction} device '{selection.name}' no longer "
                f"supports {selection.direction} audio."
            )
        current = replace(selection, device_id=matches[0])
        _validate_format(sounddevice, selection.direction, matches[0], selection.name)
        if selection.direction == "input":
            self.input_selection = current
        else:
            self.output_selection = current
        return current

    def open_input_stream(self) -> Any:
        if not self.settings.input_enabled:
            raise AudioDeviceError("Audio input is disabled by RADIO_INPUT_ENABLED.")
        selection = self.input_selection
        if selection is None:
            raise AudioDeviceError(self.input_error or "No audio input device is available.")
        if selection.source == "command":
            raise AudioDeviceError("Command-based audio input does not use a sounddevice stream.")
        selection = self._ensure_connected(selection)
        return _sounddevice().RawInputStream(
            device=selection.device_id,
            samplerate=48_000,
            channels=1,
            dtype="int16",
            blocksize=4_096,
        )

    def play_pcm(
        self,
        pcm: bytes,
        stop_event: Any,
        on_start: Any,
    ) -> None:
        if not self.settings.output_enabled:
            raise AudioDeviceError("Audio output is disabled by RADIO_OUTPUT_ENABLED.")
        selection = self.output_selection
        if selection is None:
            raise AudioDeviceError(self.output_error or "No audio output device is available.")
        if selection.source == "command":
            raise AudioDeviceError("Command-based audio output does not use a sounddevice stream.")
        selection = self._ensure_connected(selection)
        sounddevice = _sounddevice()
        with sounddevice.RawOutputStream(
            device=selection.device_id,
            samplerate=48_000,
            channels=1,
            dtype="int16",
            blocksize=4_096,
        ) as stream:
            if stop_event.is_set():
                raise InterruptedError("Radio worker stopped before audio playback.")
            on_start()
            chunk_size = 4_096 * 2
            for offset in range(0, len(pcm), chunk_size):
                if stop_event.is_set():
                    raise InterruptedError("Radio worker stopped during audio playback.")
                stream.write(pcm[offset : offset + chunk_size])
