"""No-radio unit tests for the Dire Wolf TCP KISS integration."""
from __future__ import annotations

import socket
import threading
from unittest.mock import Mock
import pytest

from app.radio_lab.aprs.codec import build_text, build_position
from app.radio_lab.aprs.kiss import (
    FEND, FESC, TFEND, TFESC, KISSError, KissFramer, KissTcpClient,
    ax25_to_tnc2, tnc2_to_ax25, encode_kiss, decode_kiss_chunk,
)
from app.radio_lab.settings import RadioSettings
from app.radio_lab.runtime import RadioWorker


@pytest.mark.parametrize("packet", [
    build_text("N0CALL", "Aid required", "ALL"),
    build_position("N0CALL-5", 7.9186, 125.3286, "Responder moving"),
])
def test_ax25_ui_tnc2_roundtrip(packet):
    frame = tnc2_to_ax25(packet)
    assert b"\x03\xf0" in frame
    assert ax25_to_tnc2(frame) == packet


def test_kiss_escapes_and_partial_chunks():
    payload = bytes([0x03, 0xF0, FEND, FESC])
    wire = encode_kiss(payload)
    assert bytes([FESC, TFEND]) in wire
    assert bytes([FESC, TFESC]) in wire
    parser = KissFramer()
    assert parser.feed(wire[:4]) == []
    assert parser.feed(wire[4:]) == [payload]
    assert parser.feed(bytes([FEND, 0x01, 0x02, FEND])) == []
    assert parser.feed(bytes([FEND, 0x00, FESC, 0xAA, FEND])) == []


def test_malformed_ax25_and_oversize_frames_rejected():
    with pytest.raises(KISSError):
        tnc2_to_ax25("N0CALL>APRS:test\nunsafe")
    with pytest.raises(KISSError):
        ax25_to_tnc2(b"\0" * 18)
    parser = KissFramer()
    assert parser.feed(bytes([FEND, 0]) + bytes(600) + bytes([FEND])) == []


def test_decode_kiss_stream_uses_aprslib_for_text_and_position():
    pytest.importorskip("aprslib")
    parser = KissFramer()
    stream = b"".join([
        encode_kiss(tnc2_to_ax25(build_text("N0CALL", "Need help"))),
        encode_kiss(tnc2_to_ax25(build_position("N0CALL-1", 7.9186, 125.3286, "Patrol"))),
    ])
    halfway = len(stream) // 2
    data = decode_kiss_chunk(parser, stream[:halfway])
    data += decode_kiss_chunk(parser, stream[halfway:])
    assert [d["kind"] for d in data] == ["text", "position"]
    assert data[0]["text"] == "Need help"
    assert data[1]["latitude"] == pytest.approx(7.9186, abs=1 / 6000)
    assert data[1]["longitude"] == pytest.approx(125.3286, abs=1 / 6000)


def test_loopback_socket_round_trip_no_radio(monkeypatch):
    wire_one, wire_two = socket.socketpair()
    class FakeConnection:
        @staticmethod
        def create_connection(addr, timeout):
            assert addr == ("127.0.0.1", 8001)
            assert timeout == 2
            return wire_one

    monkeypatch.setattr(socket, "create_connection", FakeConnection.create_connection)
    client = KissTcpClient()
    client.connect()
    try:
        packet = build_text("N0CALL", "Local test")
        client.send(packet)
        wire_two.settimeout(2)
        assert wire_two.recv(4096) == encode_kiss(tnc2_to_ax25(packet))
        wire_two.sendall(encode_kiss(tnc2_to_ax25(packet)))
        assert decode_kiss_chunk(KissFramer(), client.recv())[0]["text"] == "Local test"
    finally:
        client.close()
        wire_two.close()


def test_kiss_mode_requires_explicit_config_and_keeps_wav_default(monkeypatch):
    for name in (
        "RADIO_APRS_TRANSPORT", "RADIO_DIREWOLF_CONFIG",
        "RADIO_KISS_HOST", "RADIO_KISS_SSTV_INPUT_ENABLED",
        "RADIO_INPUT_DEVICE", "RADIO_INPUT_COMMAND",
    ):
        monkeypatch.delenv(name, raising=False)
    assert RadioSettings.from_env().aprs_transport == "wav"
    monkeypatch.setenv("RADIO_APRS_TRANSPORT", "kiss")
    with pytest.raises(ValueError, match="RADIO_DIREWOLF_CONFIG"):
        RadioSettings.from_env()
    monkeypatch.setenv("RADIO_DIREWOLF_CONFIG", "dirwolf.conf")
    assert RadioSettings.from_env().kiss_host == "127.0.0.1"
    monkeypatch.setenv("RADIO_KISS_HOST", "0.0.0.0")
    with pytest.raises(ValueError, match="loopback"):
        RadioSettings.from_env()
    monkeypatch.setenv("RADIO_KISS_HOST", "127.0.0.1")
    monkeypatch.setenv("RADIO_KISS_SSTV_INPUT_ENABLED", "true")
    with pytest.raises(ValueError, match="independent"):
        RadioSettings.from_env()


def test_kiss_worker_does_not_start_aprs_wav_encoder():
    worker = RadioWorker(Mock(), RadioSettings(aprs_transport="kiss"))
    assert len(worker.processes) == 1
    assert worker.processes[0].name == "radio-decoder"


def test_kiss_queued_job_reports_uncertain_delivery_without_real_radio():
    repository = Mock()
    repository.claim_next.side_effect = [{
        "id": "tx-1", "kind": "text", "station": "N0CALL",
        "text": "Test", "addressee": "ALL",
    }, None]
    worker = RadioWorker(repository, RadioSettings(aprs_transport="kiss"))
    worker.kiss_client = Mock()
    worker.kiss_client.connected = True
    repository.finish.side_effect = lambda *_: worker.stop.set()
    worker._send()
    repository.mark_sending.assert_called_once_with("tx-1")
    repository.finish.assert_called_once_with(
        "tx-1", {"kiss_accepted": True, "delivery": "kiss-tnc"}
    )
    worker.kiss_client.send.assert_called_once_with(build_text("N0CALL", "Test"))


def test_kiss_disconnect_keeps_database_queue_unclaimed():
    repository = Mock()
    worker = RadioWorker(repository, RadioSettings(aprs_transport="kiss", output_enabled=True))
    worker.kiss_client = Mock(connected=False)
    worker.stop.set()
    worker._send()
    repository.claim_next.assert_not_called()
