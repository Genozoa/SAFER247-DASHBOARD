"""Persistent TCP KISS framing and AX.25 UI conversion for Dire Wolf.

No HDLC flags/FCS travel over KISS. Dire Wolf supplies the RF modem and FCS.
"""
from __future__ import annotations

import re
import socket
from threading import Lock

from app.radio_lab.aprs.codec import APRSError, parse_packet

FEND, FESC, TFEND, TFESC = 0xC0, 0xDB, 0xDC, 0xDD
MAX_FRAME_BYTES = 512
_STATION = re.compile(r"[A-Z0-9]{1,6}(?:-(?:[0-9]|1[0-5]))?\Z")


class KISSError(APRSError):
    """Invalid AX.25 / KISS frame."""


def _address(station: str, last: bool, repeated: bool = False) -> bytes:
    station = station.upper()
    if not _STATION.fullmatch(station):
        raise KISSError("Invalid AX.25 callsign or SSID.")
    call, _, suffix = station.partition("-")
    ssid = int(suffix) if suffix else 0
    return bytes(ord(ch) << 1 for ch in call.ljust(6)) + bytes(
        [0x60 | (ssid << 1) | int(last) | (0x80 if repeated else 0)]
    )


def tnc2_to_ax25(packet: str) -> bytes:
    """Convert TNC2 APRS text into an AX.25 unnumbered information frame."""
    if not isinstance(packet, str) or ":" not in packet or ">" not in packet:
        raise KISSError("Expected source>destination:information.")
    header, information = packet.split(":", 1)
    source, destinations = header.split(">", 1)
    targets = destinations.split(",")
    if not 1 <= len(targets) <= 9 or any(not part for part in targets):
        raise KISSError("Invalid destination or digipeater path.")
    try:
        info = information.encode("ascii")
    except UnicodeEncodeError as exc:
        raise KISSError("APRS content must use printable ASCII.") from exc
    if not 1 <= len(info) <= 256 or any(not 32 <= octet <= 126 for octet in info):
        raise KISSError("APRS information must be 1–256 printable ASCII bytes.")
    path = []
    for part in targets[1:]:
        repeated = part.endswith("*")
        path.append(_address(part[:-1] if repeated else part, False, repeated))
    addresses = [_address(targets[0], False), _address(source, not path)] + path
    if path:
        addresses[-1] = addresses[-1][:-1] + bytes([addresses[-1][-1] | 1])
    frame = b"".join(addresses) + b"\x03\xF0" + info
    if len(frame) > MAX_FRAME_BYTES:
        raise KISSError("AX.25 frame exceeds KISS size bound.")
    return frame


def ax25_to_tnc2(frame: bytes) -> str:
    """Convert an incoming AX.25 UI frame to aprslib-compatible TNC2."""
    if not isinstance(frame, bytes) or not 17 <= len(frame) <= MAX_FRAME_BYTES:
        raise KISSError("Invalid AX.25 frame length.")
    addresses = []
    offset = 0
    while True:
        if offset + 7 > len(frame) or len(addresses) >= 10:
            raise KISSError("Truncated or oversized AX.25 address list.")
        data = frame[offset:offset + 7]
        if any(octet & 1 for octet in data[:6]):
            raise KISSError("Malformed AX.25 shifted callsign.")
        call = bytes(octet >> 1 for octet in data[:6]).decode("ascii").rstrip()
        ssid = (data[6] >> 1) & 15
        address = call + (f"-{ssid}" if ssid else "")
        if not _STATION.fullmatch(address):
            raise KISSError("Invalid AX.25 callsign.")
        if len(addresses) >= 2 and data[6] & 0x80:
            address += "*"
        addresses.append(address)
        offset += 7
        if data[6] & 1:
            break
    if len(addresses) < 2 or frame[offset:offset + 2] != b"\x03\xF0":
        raise KISSError("Only APRS AX.25 UI frames with PID F0 are supported.")
    try:
        info = frame[offset + 2:].decode("ascii")
    except UnicodeDecodeError as exc:
        raise KISSError("Non-ASCII APRS content.") from exc
    if not info or any(not 32 <= ord(char) <= 126 for char in info):
        raise KISSError("Malformed APRS information field.")
    destination, source, *repeaters = addresses
    return f"{source}>{destination}" + ("," + ",".join(repeaters) if repeaters else "") + ":" + info


def encode_kiss(ax25: bytes) -> bytes:
    if not isinstance(ax25, bytes) or not 1 <= len(ax25) <= MAX_FRAME_BYTES:
        raise KISSError("Invalid AX.25 KISS payload.")
    encoded = ax25.replace(bytes([FESC]), bytes([FESC, TFESC]))
    encoded = encoded.replace(bytes([FEND]), bytes([FESC, TFEND]))
    return bytes([FEND, 0]) + encoded + bytes([FEND])


class KissFramer:
    """Bounded incremental framing; tolerates partial TCP reads and ignores KISS controls."""

    def __init__(self):
        self.reset()

    def reset(self):
        self.started = False
        self.escaped = False
        self.invalid = False
        self.buffer = bytearray()

    def feed(self, chunk: bytes) -> list[bytes]:
        frames = []
        for byte in chunk:
            if byte == FEND:
                if self.started and self.buffer and not self.invalid and not self.escaped:
                    if self.buffer[0] == 0:
                        frames.append(bytes(self.buffer[1:]))
                self.started, self.escaped, self.invalid = True, False, False
                self.buffer.clear()
                continue
            if not self.started or self.invalid:
                continue
            if self.escaped:
                self.escaped = False
                if byte == TFEND:
                    byte = FEND
                elif byte == TFESC:
                    byte = FESC
                else:
                    self.invalid = True
                    continue
            elif byte == FESC:
                self.escaped = True
                continue
            if len(self.buffer) >= MAX_FRAME_BYTES + 1:
                self.invalid = True
                self.buffer.clear()
            else:
                self.buffer.append(byte)
        return frames


def decode_kiss_chunk(framer: KissFramer, chunk: bytes) -> list[dict]:
    decoded = []
    for ax25 in framer.feed(chunk):
        try:
            decoded.append(parse_packet(ax25_to_tnc2(ax25)))
        except (APRSError, UnicodeDecodeError):
            continue
    return decoded


class KissTcpClient:
    """One TCP socket shared by the persistent receiver and serialized transmit thread."""

    def __init__(self, host="127.0.0.1", port=8001):
        self.host, self.port = host, port
        self._lock = Lock()
        self._socket: socket.socket | None = None

    @property
    def connected(self):
        with self._lock:
            return self._socket is not None

    def connect(self):
        connection = socket.create_connection((self.host, self.port), timeout=2)
        connection.settimeout(0.5)
        with self._lock:
            if self._socket is None:
                self._socket = connection
            else:
                connection.close()

    def recv(self):
        with self._lock:
            connection = self._socket
        if connection is None:
            raise ConnectionError("Dire Wolf KISS socket is disconnected.")
        return connection.recv(4096)

    def send(self, packet: str):
        payload = encode_kiss(tnc2_to_ax25(packet))
        with self._lock:
            if self._socket is None:
                raise ConnectionError("Dire Wolf KISS socket is disconnected.")
            self._socket.sendall(payload)

    def close(self):
        with self._lock:
            connection, self._socket = self._socket, None
        if connection is not None:
            try:
                connection.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            connection.close()
