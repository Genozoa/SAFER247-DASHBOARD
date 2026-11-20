"""Keep AX.25/AFSK audio in Dire Wolf; aprslib parses decoded packets only.

These functions are blocking and belong in the radio worker process, never an
HTTP handler. No APRS-IS network connection or live radio configuration is used.
"""
from __future__ import annotations

import math
import os
from pathlib import Path
import re
import subprocess
import tempfile
import wave


_TIMEOUT = 30
_ANSI = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
_STATION = re.compile(r"[A-Z0-9]{1,6}(?:-(?:[0-9]|1[0-5]))?\Z")


class APRSError(ValueError):
    """Invalid packet/audio or unavailable/failed external modem."""


def _station(value: str) -> str:
    value = str(value).strip().upper()
    if not _STATION.fullmatch(value):
        raise APRSError("Station must be 1–6 alphanumeric characters with optional SSID 0–15.")
    return value


def _text(value: str, maximum: int, *, required: bool = True, reserved: str = "{|~") -> str:
    if not isinstance(value, str) or len(value) > maximum:
        raise APRSError(f"Text must contain at most {maximum} printable ASCII characters.")
    if any(not 32 <= ord(character) <= 126 for character in value):
        raise APRSError("APRS text requires printable ASCII; newlines are unsupported.")
    if required and not value.strip():
        raise APRSError("Text is required.")
    if any(character in value for character in reserved):
        raise APRSError(f"APRS text contains reserved characters: {reserved}")
    return value


def build_text(station: str, text: str, addressee: str = "ALL") -> str:
    """Build a standard unnumbered APRS addressed message (67 ASCII bytes max).

    Delivery acknowledgments/retries and application-specific Android envelopes
    are intentionally separate from this standards-based packet formatter.
    """
    station = _station(station)
    text = _text(text, 67)
    addressee = str(addressee).strip().upper()
    if not re.fullmatch(r"[A-Z0-9_-]{1,9}", addressee):
        raise APRSError("Addressee must contain 1–9 letters, digits, underscores, or hyphens.")
    if re.fullmatch(r"(?:ack|rej)[A-Za-z0-9]{1,5}", text):
        raise APRSError("Text is reserved for an APRS acknowledgment or rejection.")
    return f"{station}>APRS::{addressee:<9}:{text}"


def parse_incident_fragment(text: str) -> dict | None:
    """Parse one S247 fragment; return a partial state or a complete envelope."""
    if not isinstance(text, str):
        return None
    match = re.fullmatch(r"S247:([A-Z0-9]{8}):([0-9]{1,2})/([0-9]{1,2}):([A-Za-z0-9_-]+)", text)
    if not match:
        return None
    prefix, index_text, total_text, encoded = match.groups()
    index, total = int(index_text), int(total_text)
    if not 1 <= index <= total <= 99:
        raise APRSError("Invalid incident fragment sequence.")
    return {
        "prefix": prefix,
        "index": index,
        "total": total,
        "encoded": encoded,
    }


def _coordinate(value: float, latitude: bool) -> str:
    try:
        value = float(value)
    except (TypeError, ValueError) as exc:
        raise APRSError("Coordinates must be finite numbers.") from exc
    limit = 90 if latitude else 180
    if not math.isfinite(value) or not -limit <= value <= limit:
        raise APRSError(f"Coordinate must be finite and in [-{limit}, {limit}].")
    # Work in hundredths of a minute so 59.999 minutes carries to the degree.
    units = round(abs(value) * 60 * 100)
    if units >= limit * 6000:
        raise APRSError("aprslib 0.7.2 cannot parse positions rounding to the poles or dateline.")
    degrees, hundredths = divmod(units, 6000)
    minutes, fraction = divmod(hundredths, 100)
    width = 2 if latitude else 3
    hemisphere = ("N" if value >= 0 else "S") if latitude else ("E" if value >= 0 else "W")
    return f"{degrees:0{width}d}{minutes:02d}.{fraction:02d}{hemisphere}"


def build_position(station: str, latitude: float, longitude: float, text: str = "") -> str:
    """Build an uncompressed APRS position, with the primary-table vehicle symbol."""
    station = _station(station)
    text = _text(text, 43, required=False, reserved="|")
    return f"{station}>APRS:!{_coordinate(latitude, True)}/{_coordinate(longitude, False)}>{text}"


def parse_packet(packet: str) -> dict:
    """Parse a decoded TNC2 packet into the application result envelope."""
    if not isinstance(packet, str) or len(packet) > 512 or any(ord(c) < 32 for c in packet):
        raise APRSError("Expected a bounded, single-line decoded APRS packet.")
    try:
        import aprslib
    except ImportError as exc:
        raise APRSError("Install radio_lab/aprs/requirements.txt to parse APRS packets.") from exc
    try:
        parsed = aprslib.parse(packet)
    except (aprslib.ParseError, aprslib.UnknownFormat, ValueError, TypeError, IndexError) as exc:
        raise APRSError(f"Invalid or unsupported APRS packet: {exc}") from exc
    result = {"station": parsed["from"], "raw": packet}
    if "latitude" in parsed and "longitude" in parsed:
        latitude, longitude = parsed["latitude"], parsed["longitude"]
        if not (math.isfinite(latitude) and math.isfinite(longitude)
                and -90 <= latitude <= 90 and -180 <= longitude <= 180):
            raise APRSError("Decoded coordinates are outside geographic bounds.")
        result.update(kind="position", latitude=latitude, longitude=longitude,
                      text=parsed.get("comment", ""))
    elif parsed.get("format") in ("message", "bulletin", "group-bulletin", "announcement"):
        if "message_text" not in parsed:
            raise APRSError("APRS acknowledgment/rejection is not a text message.")
        result.update(kind="text", text=parsed["message_text"])
    else:
        raise APRSError("Only APRS text and geographic positions are supported.")
    return result


def _run(arguments: list[str], *, packet: str | None = None) -> str:
    try:
        process = subprocess.run(arguments, input=packet, text=True,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                 timeout=_TIMEOUT, check=False)
    except FileNotFoundError as exc:
        raise APRSError(f"Dire Wolf executable unavailable: {arguments[0]}") from exc
    except subprocess.TimeoutExpired as exc:
        raise APRSError("Dire Wolf processing timed out; transmission is incomplete.") from exc
    except OSError as exc:
        raise APRSError(f"Cannot run Dire Wolf: {exc}") from exc
    if process.returncode:
        raise APRSError(f"Dire Wolf failed (exit {process.returncode}): {process.stderr[-500:]}")
    return _ANSI.sub("", process.stdout)


def _validate_wav(path: Path, maximum_seconds: float = 45) -> None:
    try:
        duration_limit = float(maximum_seconds)
    except (TypeError, ValueError, OverflowError) as exc:
        raise APRSError("maximum_seconds must be finite and greater than zero, at most 120.") from exc
    if (isinstance(maximum_seconds, bool) or not math.isfinite(duration_limit)
            or not 0 < duration_limit <= 120):
        raise APRSError("maximum_seconds must be finite and greater than zero, at most 120.")
    try:
        with wave.open(str(path), "rb") as recording:
            if (recording.getnchannels() != 1 or recording.getsampwidth() != 2
                    or recording.getframerate() != 48000 or recording.getcomptype() != "NONE"):
                raise APRSError("Audio must be uncompressed mono 16-bit PCM at 48000 Hz.")
            frames = recording.getnframes()
            if not 0 < frames <= duration_limit * 48000:
                raise APRSError(f"Recording must contain more than zero and at most {duration_limit:g} seconds of audio.")
            if len(recording.readframes(frames)) != frames * 2:
                raise APRSError("WAV recording is truncated.")
    except (wave.Error, EOFError, OSError) as exc:
        raise APRSError(f"Cannot read PCM WAV recording: {exc}") from exc


def _encode(packet: str, output_path, gen_packets: str, sample_rate: int) -> Path:
    if sample_rate != 48000:
        raise APRSError("The shared radio audio format is 48000 Hz mono PCM16.")
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=".aprs-", suffix=".wav", dir=output.parent)
    os.close(handle)
    try:
        # gen_packets 1.8.1 retains input line endings in AX.25 data. Pass one
        # packet with NO trailing newline, using an argv list (never a shell).
        _run([str(gen_packets), "-B", "1200", "-r", str(sample_rate), "-o", temporary, "-"],
             packet=packet)
        _validate_wav(Path(temporary))
        os.replace(temporary, output)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return output


def encode_text(station, text, output_path, addressee="ALL", gen_packets="gen_packets",
                sample_rate=48000) -> Path:
    return _encode(build_text(station, text, addressee), output_path, gen_packets, sample_rate)


def encode_position(station, latitude, longitude, output_path, text="", gen_packets="gen_packets",
                    sample_rate=48000) -> Path:
    return _encode(build_position(station, latitude, longitude, text), output_path, gen_packets,
                   sample_rate)


def decode_wav(path, atest="atest", maximum_seconds: float = 45) -> list[dict]:
    """Decode APRS frames without FCS repair, normally bounded to 45 seconds.

    Shared APRS/SSTV spool detection may opt into a finite bound up to 120
    seconds so a longer SSTV profile does not prevent APRS inspection.
    """
    path = Path(path)
    _validate_wav(path, maximum_seconds=maximum_seconds)
    output = _run([str(atest), "-B", "1200", "-F", "0", str(path)])
    results = []
    for line in output.splitlines():
        match = re.match(r"^\[\d+(?:\.\d+)?\]\s+(.+>[^:]+:.*)$", line)
        if not match:
            continue
        try:
            results.append(parse_packet(match.group(1)))
        except APRSError:
            # Other AX.25 protocols and unsupported APRS formats can share a
            # recording. They must not prevent the following valid frame.
            continue
    return results
