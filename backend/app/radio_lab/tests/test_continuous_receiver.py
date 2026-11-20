"""Real codec/process IPC coverage for a continuous synthetic PCM stream.

No physical capture/playback device, radio, or Android endpoint is involved.
"""
import math
import multiprocessing as mp
import os
from pathlib import Path
import queue
import shutil
import wave

import pytest

from app.radio_lab.runtime import receiver_process
from app.radio_lab.settings import RadioSettings


def _pcm(path):
    with wave.open(str(path), "rb") as source:
        assert (source.getnchannels(), source.getsampwidth(), source.getframerate()) == (1, 2, 48000)
        return source.readframes(source.getnframes())


def test_receiver_process_decodes_mixed_continuous_pcm_across_window_boundaries(tmp_path):
    """APRS frames straddle two rolling-window edges; SSTV spans many windows."""
    generator = os.environ.get("RADIO_GEN_PACKETS", "gen_packets")
    decoder = os.environ.get("RADIO_ATEST", "atest")
    if not shutil.which(generator) or not shutil.which(decoder):
        pytest.skip("Dire Wolf tools unavailable; continuous mixed audio not exercised")
    pytest.importorskip("aprslib")
    pytest.importorskip("numpy")
    pytest.importorskip("pysstv")
    pytest.importorskip("open_sstv.core.decoder")
    from PIL import Image
    from pysstv.color import PD90
    from app.radio_lab.aprs.codec import encode_position, encode_text

    text_pcm = _pcm(encode_text("N0CALL", "Continuous boundary text", tmp_path / "text.wav",
                                gen_packets=generator))
    position_pcm = _pcm(encode_position("N0CALL-1", 7.9186, 125.3286,
                                        tmp_path / "position.wav", text="Continuous position",
                                        gen_packets=generator))
    image_audio = tmp_path / "pd90.wav"
    PD90(Image.new("RGB", (320, 256), (120, 80, 160)), 48_000, 16).write_wav(str(image_audio))
    image_pcm = _pcm(image_audio)

    # The runtime checks a five-second buffer and retains two seconds. Account
    # for actual 8192-byte capture chunks when locating its first two edges.
    bytes_per_second = 48000 * 2
    chunk_size = 8192
    first_edge = math.ceil(5 * bytes_per_second / chunk_size) * chunk_size
    second_edge = first_edge + math.ceil(3 * bytes_per_second / chunk_size) * chunk_size
    first_start = first_edge - (len(text_pcm) // 4) * 2
    second_start = second_edge - (len(position_pcm) // 4) * 2
    assert first_start < first_edge < first_start + len(text_pcm)
    assert second_start < second_edge < second_start + len(position_pcm)
    assert first_start + len(text_pcm) < second_start
    stream = (bytes(first_start) + text_pcm
              + bytes(second_start - first_start - len(text_pcm)) + position_pcm
              + bytes(bytes_per_second) + image_pcm + bytes(5 * bytes_per_second))
    # A real full-duration PD90 signal passes only through raw PCM IPC here.
    assert len(stream) > 90 * bytes_per_second

    storage = tmp_path / "receiver"
    storage.mkdir()
    settings = RadioSettings(storage_dir=storage, gen_packets=generator, atest=decoder,
                             enhance=True)
    context = mp.get_context("spawn")
    incoming = context.Queue(maxsize=2)
    outgoing = context.Queue(maxsize=2)
    process = context.Process(target=receiver_process, args=(settings, incoming, outgoing))
    process.start()
    received = []
    try:
        # Send only raw PCM chunks over IPC. Wait for each acknowledgment to
        # bound queue memory; the same child decoder handles the whole stream.
        for offset in range(0, len(stream), chunk_size):
            incoming.put({"type": "pcm", "pcm": stream[offset:offset + chunk_size]}, timeout=10)
            try:
                reply = outgoing.get(timeout=30)
            except queue.Empty:
                pytest.fail(f"Receiver stalled at PCM byte {offset}; exit={process.exitcode}")
            assert "error" not in reply, reply
            assert reply["source"] is None
            received.extend(reply["records"])
        incoming.put(None, timeout=10)
        process.join(timeout=10)
        assert process.exitcode == 0
    finally:
        if process.is_alive():
            process.terminate()
            process.join(timeout=5)
        incoming.close()
        outgoing.close()
        incoming.join_thread()
        outgoing.join_thread()

    text = [record for record in received if record["kind"] == "text"]
    positions = [record for record in received if record["kind"] == "position"]
    images = [record for record in received if record["kind"] == "image"]
    # Overlap must recover complete packets exactly once, despite the first
    # appearance of each frame ending halfway through a decode window.
    assert len(text) == len(positions) == len(images) == 1
    assert text[0]["text"] == "Continuous boundary text"
    assert text[0]["station"] == "N0CALL"
    assert positions[0]["latitude"] == pytest.approx(7.9186, abs=1 / 6000)
    assert positions[0]["longitude"] == pytest.approx(125.3286, abs=1 / 6000)
    assert positions[0]["station"] == "N0CALL-1"
    image = images[0]
    assert image["station"] == "SSTV-UNKNOWN"
    assert image["raw"]["mode"] == "PD90"
    assert image["raw"]["vis_code"] == 99
    assert image["raw"]["source"] == "continuous_audio"
    original = Path(image["original_path"])
    enhanced = Path(image["enhanced_path"])
    assert original != enhanced and original.is_file() and enhanced.is_file()
    with Image.open(original) as decoded:
        assert decoded.size == (320, 256)
        assert abs(decoded.convert("L").getpixel((160, 120)) - 101) < 20
    assert all(record["receipt_id"].startswith("live:") for record in received)
    assert len({record["receipt_id"] for record in received}) == 3


@pytest.fixture
def continuous_modem():
    generator = os.environ.get("RADIO_GEN_PACKETS", "gen_packets")
    decoder = os.environ.get("RADIO_ATEST", "atest")
    if not shutil.which(generator) or not shutil.which(decoder):
        pytest.skip("Dire Wolf tools unavailable; continuous APRS not exercised")
    pytest.importorskip("aprslib")
    pytest.importorskip("numpy")
    pytest.importorskip("open_sstv.core.decoder")
    return generator, decoder


def _start_receiver(tmp_path, modem):
    generator, decoder = modem
    settings = RadioSettings(storage_dir=tmp_path, gen_packets=generator, atest=decoder,
                             enhance=False)
    context = mp.get_context("spawn")
    incoming = context.Queue(maxsize=2)
    outgoing = context.Queue(maxsize=2)
    process = context.Process(target=receiver_process, args=(settings, incoming, outgoing))
    process.start()
    return process, incoming, outgoing


def _exchange(incoming, outgoing, item):
    incoming.put(item, timeout=10)
    try:
        reply = outgoing.get(timeout=30)
    except queue.Empty:
        pytest.fail("Receiver failed to acknowledge a continuous PCM/reset IPC message")
    assert "error" not in reply, reply
    return reply["records"]


def _send_pcm(incoming, outgoing, pcm):
    records = []
    for offset in range(0, len(pcm), 8192):
        records.extend(_exchange(incoming, outgoing,
                                 {"type": "pcm", "pcm": pcm[offset:offset + 8192]}))
    return records


def _finish_receiver(process, incoming, outgoing):
    try:
        if process.is_alive():
            incoming.put(None, timeout=10)
            process.join(timeout=10)
        assert process.exitcode == 0
    finally:
        if process.is_alive():
            process.terminate()
            process.join(timeout=5)
        incoming.close()
        outgoing.close()
        incoming.join_thread()
        outgoing.join_thread()


def test_capture_reset_flushes_short_final_aprs_window_and_preserves_next_session(tmp_path,
                                                                                continuous_modem):
    from app.radio_lab.aprs.codec import encode_text

    generator, _ = continuous_modem
    pcm = _pcm(encode_text("N0CALL", "Short capture", tmp_path / "short.wav",
                           gen_packets=generator))
    assert len(pcm) < 5 * 48000 * 2
    process, incoming, outgoing = _start_receiver(tmp_path, continuous_modem)
    records = []
    try:
        # A complete frame exists before a five-second rolling window is ready.
        assert _send_pcm(incoming, outgoing, pcm) == []
        first = _exchange(incoming, outgoing, {"type": "reset"})
        assert len(first) == 1
        records.extend(first)
        # Reconnecting the capture starts a new session: the same beacon must
        # not be discarded merely because its packet bytes match the last one.
        assert _send_pcm(incoming, outgoing, pcm) == []
        second = _exchange(incoming, outgoing, {"type": "reset"})
        assert len(second) == 1
        records.extend(second)
    finally:
        _finish_receiver(process, incoming, outgoing)
    assert [record["text"] for record in records] == ["Short capture", "Short capture"]
    assert records[0]["raw"] == records[1]["raw"]
    assert records[0]["receipt_id"] != records[1]["receipt_id"]
    assert all(record["receipt_id"].startswith("live:") for record in records)


def test_repeated_beacon_survives_sample_time_gap_in_fast_continuous_input(tmp_path,
                                                                         continuous_modem):
    from app.radio_lab.aprs.codec import encode_text

    generator, _ = continuous_modem
    pcm = _pcm(encode_text("N0CALL", "Periodic beacon", tmp_path / "beacon.wav",
                           gen_packets=generator))
    bytes_per_second = 48000 * 2
    # Identical beacons begin eight seconds apart in sample time. Feed all
    # chunks as fast as decoding permits, without sleeps or capture resets.
    first_start = bytes_per_second // 4
    second_start = first_start + 8 * bytes_per_second
    stream = (bytes(first_start) + pcm
              + bytes(second_start - first_start - len(pcm)) + pcm
              + bytes(5 * bytes_per_second))
    process, incoming, outgoing = _start_receiver(tmp_path, continuous_modem)
    try:
        records = _send_pcm(incoming, outgoing, stream)
    finally:
        _finish_receiver(process, incoming, outgoing)
    assert len(records) == 2
    assert all(record["kind"] == "text" and record["text"] == "Periodic beacon"
               for record in records)
    assert records[0]["raw"] == records[1]["raw"]
    assert records[0]["receipt_id"] != records[1]["receipt_id"]
