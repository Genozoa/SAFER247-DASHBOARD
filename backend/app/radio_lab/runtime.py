"""Independent radio worker: durable DB IPC, codec processes, and audio threads.

Nothing in this module is started by importing the web application. The
supervised worker encodes outgoing APRS and independently receives APRS/SSTV.
"""
from __future__ import annotations

import json
import hashlib
import importlib.util
import logging
import multiprocessing as mp
import os
from pathlib import Path
import queue
import signal
import shutil
import subprocess
import sys
import threading
import time
import wave
from uuid import uuid4

from app.radio_lab.audio_devices import AudioDeviceManager
from app.radio_lab.settings import RadioSettings
from app.radio_lab.worker_status import write_status

log = logging.getLogger(__name__)


class CodecProtocolError(RuntimeError):
    pass


def _module_available(name: str) -> bool:
    try:
        return importlib.util.find_spec(name) is not None
    except (ImportError, ValueError):
        return False


def _codec_status(settings: RadioSettings) -> tuple[dict[str, bool], list[str]]:
    capabilities = {
        "aprs_encoder": bool(Path(settings.gen_packets).is_file() or shutil.which(settings.gen_packets))
        and _module_available("aprslib"),
        "aprs_decoder": bool(Path(settings.atest).is_file() or shutil.which(settings.atest))
        and _module_available("aprslib"),
        "sstv_decoder": _module_available("open_sstv.core.decoder"),
    }
    errors = []
    if not capabilities["aprs_encoder"]:
        errors.append("APRS encoder unavailable: Dire Wolf gen_packets and aprslib are required.")
    if not capabilities["aprs_decoder"]:
        errors.append("APRS decoder unavailable: Dire Wolf atest and aprslib are required.")
    if not capabilities["sstv_decoder"]:
        errors.append("SSTV decoder unavailable: Open-SSTV is not installed.")
    return capabilities, errors


def encode_job(job: dict, settings: RadioSettings) -> dict:
    """Encode an APRS transmission in the worker process."""
    if job.get("compound_id"):
        raise ValueError("Legacy incident compound transmissions are no longer supported.")
    output = settings.output_dir / f"{job['id']}.wav"
    output.parent.mkdir(parents=True, exist_ok=True)
    partial = output.with_suffix(".partial.wav")
    try:
        if job["kind"] == "text":
            from app.radio_lab.aprs.codec import encode_text
            encode_text(job["station"], job["text"], partial,
                        addressee=job.get("addressee", "ALL"),
                        gen_packets=settings.gen_packets, sample_rate=settings.sample_rate)
        elif job["kind"] == "position":
            from app.radio_lab.aprs.codec import encode_position
            encode_position(job["station"], job["latitude"], job["longitude"], partial,
                            text=job.get("text", ""), gen_packets=settings.gen_packets,
                            sample_rate=settings.sample_rate)
        else:
            raise ValueError("Only APRS text and position jobs can be transmitted.")
        partial.replace(output)
        return {"audio_path": str(output), "sent": False, "delivery": "wav-file"}
    finally:
        partial.unlink(missing_ok=True)


def encoder_process(settings: RadioSettings, requests, results) -> None:
    while True:
        job = requests.get()
        if job is None:
            return
        try:
            results.put({"id": job["id"], "result": encode_job(job, settings)})
        except Exception as error:
            results.put({"id": job["id"], "error": f"{type(error).__name__}: {error}"})


def read_wav(path: Path, settings: RadioSettings) -> bytes:
    if path.stat().st_size > settings.max_wav_bytes:
        raise ValueError("Recording exceeds the 12 MiB input limit")
    with wave.open(str(path), "rb") as wav:
        if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) != (1, 2, settings.sample_rate):
            raise ValueError("Radio recordings must be mono, 16-bit PCM WAV at 48000 Hz")
        if not 0 < wav.getnframes() <= settings.sample_rate * settings.max_recording_seconds:
            raise ValueError(f"Recordings must contain between one sample and {settings.max_recording_seconds} seconds")
        pcm = wav.readframes(wav.getnframes())
        if len(pcm) != wav.getnframes() * 2:
            raise ValueError("WAV data is truncated")
        return pcm


def decode_recording(
    path: Path,
    settings: RadioSettings,
    warnings: list[str] | None = None,
) -> list[dict]:
    """Mode detection uses valid AX.25 FCS and PD90 VIS/completion events.

    Both candidates inspect the same input. aprslib only parses packets returned
    by Dire Wolf; it never sees PCM audio. Only completed images are published.
    """
    from app.radio_lab.aprs.codec import APRSError, decode_wav as decode_aprs
    from app.radio_lab.sstv.codec import PD90StreamDecoder
    pcm = read_wav(path, settings)
    records = []
    try:
        records.extend(
            decode_aprs(path, atest=settings.atest, maximum_seconds=settings.max_recording_seconds)
        )
    except APRSError as error:
        if warnings is None:
            raise
        warnings.append(f"APRS decoding failed: {error}")
    decoder = PD90StreamDecoder(settings.storage_dir / "decoded", settings.sample_rate,
                                  enhance=settings.enhance)
    for offset in range(0, len(pcm), 8192):
        records.extend(decoder.feed(pcm[offset:offset + 8192]))
    # Identity belongs to this spool delivery, not just its audio content:
    # identical future beacons must remain separate timestamped receptions.
    receipt = hashlib.sha256(path.name.encode() + b"\0" + path.read_bytes()).hexdigest()
    for index, record in enumerate(records):
        record["receipt_id"] = f"wav:{receipt}:{index}"
    return records


def receiver_process(settings: RadioSettings, inputs, results) -> None:
    """Persistent SSTV state survives chunk boundaries on the live PCM path."""
    from app.radio_lab.aprs.codec import APRSError, decode_wav as decode_aprs
    from app.radio_lab.sstv.codec import PD90StreamDecoder
    decoder = PD90StreamDecoder(settings.storage_dir / "decoded", settings.sample_rate,
                                  enhance=settings.enhance)
    aprs_buffer = bytearray()
    last_seen: dict[str, float] = {}
    sample_clock = 0.0
    temp = settings.storage_dir / "listener-aprs.wav"

    def decode_aprs_buffer(warnings):
        if not aprs_buffer:
            return []
        with wave.open(str(temp), "wb") as wav:
            wav.setparams((1, 2, settings.sample_rate, 0, "NONE", "not compressed"))
            wav.writeframes(aprs_buffer)
        recovered = []
        try:
            decoded = decode_aprs(temp, atest=settings.atest)
        except APRSError as error:
            warnings.append(f"APRS decoding failed: {error}")
            return recovered
        for record in decoded:
            key = record.get("raw", "")
            if not isinstance(key, str):
                key = json.dumps(key, sort_keys=True)
            if sample_clock - last_seen.get(key, -100) > 6:
                recovered.append(record)
                last_seen[key] = sample_clock
        for key in list(last_seen):
            if sample_clock - last_seen[key] >= 12:
                del last_seen[key]
        return recovered

    while True:
        item = inputs.get()
        if item is None:
            return
        source = item.get("path")
        warnings = []
        try:
            if item["type"] == "wav":
                records = decode_recording(Path(source), settings, warnings)
            elif item["type"] == "reset":
                # Preserve complete AX.25 frames in the short final window;
                # FCS validation still rejects an actually interrupted frame.
                records = decode_aprs_buffer(warnings)
                decoder.reset()
                aprs_buffer.clear()
                last_seen.clear()
                sample_clock = 0.0
            else:
                pcm = item["pcm"]
                sample_clock += len(pcm) / (2 * settings.sample_rate)
                records = decoder.feed(pcm)
                aprs_buffer.extend(pcm)
                # Five-second windows with two seconds overlap preserve packets
                # crossing listener boundaries; radio frames longer than this
                # profile are not supported by the live APRS window decoder.
                if len(aprs_buffer) >= settings.sample_rate * 2 * 5:
                    records.extend(decode_aprs_buffer(warnings))
                    del aprs_buffer[:-settings.sample_rate * 2 * 2]
            if not source:
                for record in records:
                    record["receipt_id"] = f"live:{uuid4()}"
            results.put({"source": source, "records": records, "warnings": warnings})
        except Exception as error:
            results.put({"source": source, "error": f"{type(error).__name__}: {error}"})
            decoder.reset()
            aprs_buffer.clear()


def run_command(command: tuple[str, ...], wav: Path, stop: threading.Event,
                timeout: float, on_start=None) -> None:
    """Send one WAV through an explicitly configured local command, without a shell."""
    if stop.is_set():
        raise InterruptedError("Audio output cancelled before playback")
    args = [arg.replace("{wav}", str(wav)) for arg in command]
    if not any("{wav}" in arg for arg in command):
        raise ValueError("RADIO_OUTPUT_COMMAND must contain a {wav} argument")
    process = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               start_new_session=True)
    started = time.monotonic()
    try:
        if on_start is not None:
            on_start()
        while process.poll() is None:
            if stop.wait(0.05):
                raise InterruptedError("Audio output interrupted; delivery is unknown")
            if time.monotonic() - started > timeout:
                raise TimeoutError("Audio output timed out; delivery is unknown")
        if process.returncode:
            raise RuntimeError(f"Audio output exited with status {process.returncode}")
    finally:
        if process.poll() is None:
            if os.name == "nt":
                process.terminate()
            else:
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                if os.name == "nt":
                    process.kill()
                else:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                process.wait()


class RadioWorker:
    def __init__(self, repository, settings: RadioSettings):
        self.repository = repository
        self.settings = settings
        self.stop = threading.Event()
        context = mp.get_context("spawn")
        self.tx_requests = context.Queue(maxsize=1)
        self.tx_results = context.Queue(maxsize=1)
        self.rx_inputs = context.Queue(maxsize=128)
        self.rx_results = context.Queue(maxsize=128)
        self.processes = [
            context.Process(target=encoder_process, args=(settings, self.tx_requests, self.tx_results), name="radio-encoder"),
            context.Process(target=receiver_process, args=(settings, self.rx_inputs, self.rx_results), name="radio-decoder"),
        ]
        self.capture_process = None
        self._capture_lock = threading.Lock()
        self.audio_devices: AudioDeviceManager | None = None
        self._status_lock = threading.Lock()
        self._status = {
            "state": "starting",
            "pid": os.getpid(),
            "enabled": settings.enabled,
            "input_device": None,
            "output_device": None,
            "input_state": "starting",
            "output_state": "starting",
            "error": None,
        }

    def _publish_status(self, **updates) -> None:
        with self._status_lock:
            self._status.update(updates)
            snapshot = dict(self._status)
            write_status(self.settings.storage_dir, snapshot)

    def _put_input(self, item: dict) -> None:
        while not self.stop.is_set():
            try:
                self.rx_inputs.put(item, timeout=.2)
                return
            except queue.Full:
                continue

    def _listen_spool(self) -> None:
        incoming = self.settings.spool_dir
        processing = incoming / "processing"
        processing.mkdir(parents=True, exist_ok=True)
        # An unacknowledged file remains replayable following a worker crash.
        for path in processing.glob("*.wav"):
            self._put_input({"type": "wav", "path": str(path)})
        while not self.stop.is_set():
            for path in sorted(incoming.glob("*.wav")):
                if self.stop.is_set():
                    return
                if path.is_symlink() or not path.is_file():
                    continue
                claimed = processing / f"{uuid4().hex}_{path.name}"
                try:
                    path.replace(claimed)
                    self._put_input({"type": "wav", "path": str(claimed)})
                except OSError:
                    log.exception("Cannot claim recording %s", path.name)
            self.stop.wait(.25)

    def _listen_audio(self) -> None:
        while not self.stop.is_set():
            try:
                if self.settings.input_command:
                    capture_process = subprocess.Popen(
                        self.settings.input_command,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.DEVNULL,
                        start_new_session=True,
                    )
                    with self._capture_lock:
                        self.capture_process = capture_process
                    self._publish_status(input_state="listening", input_error=None)
                    if capture_process.stdout is None:
                        raise RuntimeError("Audio capture command did not provide stdout.")
                    while not self.stop.is_set():
                        pcm = capture_process.stdout.read(8192)
                        if not pcm:
                            break
                        if len(pcm) % 2:
                            raise ValueError("Audio capture returned an incomplete int16 sample")
                        self._put_input({"type": "pcm", "pcm": pcm})
                    if not self.stop.is_set():
                        return_code = capture_process.poll()
                        raise RuntimeError(
                            f"Audio capture command stopped unexpectedly with status {return_code}."
                        )
                else:
                    if self.audio_devices is None:
                        raise RuntimeError("Audio device selection has not been initialized.")
                    with self.audio_devices.open_input_stream() as stream:
                        self._publish_status(input_state="listening", input_error=None)
                        while not self.stop.is_set():
                            pcm, overflowed = stream.read(4_096)
                            if overflowed:
                                self._put_input({"type": "reset"})
                                message = "Input overrun detected; decoder state was reset."
                                self._publish_status(input_state="degraded", input_error=message)
                            if pcm:
                                self._put_input({"type": "pcm", "pcm": pcm})
            except InterruptedError:
                if not self.stop.is_set():
                    raise
            except Exception as error:
                log.exception("Audio capture failed; retrying the selected input in one second")
                self._publish_status(input_state="error", input_error=str(error))
            finally:
                self._stop_capture_process()
                self._put_input({"type": "reset"})
            self.stop.wait(1)

    def _stop_capture_process(self) -> None:
        with self._capture_lock:
            process = self.capture_process
            self.capture_process = None
        if process is None or process.poll() is not None:
            return
        if os.name == "nt":
            process.terminate()
        else:
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            if os.name == "nt":
                process.kill()
            else:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            process.wait()

    def _send(self) -> None:
        while not self.stop.is_set():
            job = None
            try:
                job = self.repository.claim_next()
                if job is None:
                    self.stop.wait(.25)
                    continue
                self.tx_requests.put(job, timeout=1)
                deadline = time.monotonic() + 120
                while not self.stop.is_set():
                    try:
                        response = self.tx_results.get(timeout=.2)
                        break
                    except queue.Empty:
                        if time.monotonic() > deadline or not self.processes[0].is_alive():
                            raise TimeoutError("Encoder process did not complete")
                else:
                    raise InterruptedError("Encoding interrupted")
                if response["id"] != job["id"]:
                    raise CodecProtocolError("Encoder result does not match queued transmission")
                if "error" in response:
                    raise RuntimeError(response["error"])
                result = response["result"]
                if self.settings.output_enabled:
                    try:
                        if self.settings.output_command:
                            run_command(self.settings.output_command, Path(result["audio_path"]),
                                        self.stop, self.settings.command_timeout,
                                        on_start=lambda: self.repository.mark_sending(job["id"]))
                        else:
                            if self.audio_devices is None:
                                raise RuntimeError("Audio device selection has not been initialized.")
                            pcm = read_wav(Path(result["audio_path"]), self.settings)
                            self.audio_devices.play_pcm(
                                pcm,
                                self.stop,
                                on_start=lambda: self.repository.mark_sending(job["id"]),
                            )
                        self._publish_status(output_state="ready", output_error=None)
                        result.update(audio_complete=True, delivery="audio-output")
                    except Exception as error:
                        self._publish_status(
                            output_state="error",
                            output_error=str(error),
                        )
                        raise
                self.repository.finish(job["id"], result)
            except Exception as error:
                log.exception("Transmission failed")
                if job is not None:
                    try:
                        self.repository.fail(job["id"], str(error))
                    except Exception:
                        log.exception("Cannot persist failed transmission; startup recovery will mark it failed")
                if isinstance(error, (TimeoutError, CodecProtocolError)) or (job and not self.processes[0].is_alive()):
                    # A late response must never be consumed as the next job's
                    # result. A supervised restart creates new IPC queues.
                    self.stop.set()
                self.stop.wait(.5)

    def _persist_result(self, result: dict) -> None:
        source = Path(result["source"]) if result.get("source") else None
        for warning in result.get("warnings", []):
            log.warning("Receive processing warning: %s", warning)
        if "error" not in result:
            for record in result.get("records", []):
                self.repository.receive(record)
        else:
            log.error("Receive failed: %s", result["error"])
        if source and source.exists():
            destination = self.settings.spool_dir / ("failed" if "error" in result else "processed")
            destination.mkdir(parents=True, exist_ok=True)
            source.replace(destination / source.name)
            (destination / (source.name + ".json")).write_text(json.dumps(result, default=str, indent=2))

    def run(self, health_check=None) -> None:
        for directory in (self.settings.storage_dir, self.settings.spool_dir, self.settings.output_dir):
            directory.mkdir(parents=True, exist_ok=True)
        self.audio_devices = AudioDeviceManager(self.settings)
        capabilities, codec_errors = _codec_status(self.settings)
        self._publish_status(
            **self.audio_devices.status(),
            codec_capabilities=capabilities,
            codec_errors=codec_errors,
        )
        self.repository.recover_interrupted()
        recovery = self.settings.storage_dir / "recovery"
        if recovery.exists():
            for path in sorted(recovery.glob("*.json")):
                try:
                    self._persist_result(json.loads(path.read_text()))
                    path.unlink()
                except Exception:
                    log.exception("Cannot replay receive recovery record %s", path.name)
        threads = [
            threading.Thread(target=self._listen_spool, name="audio-spool-listener", daemon=True),
            threading.Thread(target=self._send, name="audio-sender", daemon=True),
        ]
        if self.settings.input_enabled:
            threads.append(
                threading.Thread(target=self._listen_audio, name="audio-listener", daemon=True)
            )
        started_processes = []
        started_threads = []
        try:
            for process in self.processes:
                process.start()
                started_processes.append(process)
            for thread in threads:
                thread.start()
                started_threads.append(thread)
            self._publish_status(state="running", error=None)
            heartbeat = 0.0
            while not self.stop.is_set():
                if health_check is not None:
                    health_check()
                if not all(process.is_alive() for process in started_processes):
                    raise RuntimeError("Radio codec process exited; restart worker to recover")
                if not all(thread.is_alive() for thread in started_threads):
                    raise RuntimeError("Radio audio thread exited; restart worker to recover")
                try:
                    result = self.rx_results.get(timeout=.2)
                except queue.Empty:
                    if time.monotonic() - heartbeat >= 1:
                        self._publish_status()
                        heartbeat = time.monotonic()
                    continue
                try:
                    self._persist_result(result)
                except Exception:
                    # Preserve decoded results for recovery instead of losing a
                    # live receive event if PostgreSQL becomes unavailable.
                    recovery = self.settings.storage_dir / "recovery"
                    recovery.mkdir(parents=True, exist_ok=True)
                    (recovery / f"{time.time_ns()}.json").write_text(json.dumps(result, default=str))
                    log.exception("Receive persistence failed; result saved in recovery directory")
        finally:
            self.stop.set()
            try:
                self._publish_status(state="stopping")
            finally:
                self._stop_capture_process()
                for thread in started_threads:
                    thread.join(timeout=3)
                for requests in (self.tx_requests, self.rx_inputs):
                    try:
                        requests.put_nowait(None)
                    except queue.Full:
                        pass
                for process in started_processes:
                    process.join(timeout=3)
                    if process.is_alive():
                        process.terminate()
                        process.join(timeout=2)
                self._stop_capture_process()
                self._publish_status(
                    state="stopped",
                    input_state="stopped",
                    output_state="stopped",
                )


def main() -> None:
    from sqlalchemy import text
    from app.config import load_environment
    from app.db.session import create_session_factory, get_engine
    from app.radio_lab.repository import RadioRepository
    from app.radio_lab.worker_status import read_status
    load_environment()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    settings = RadioSettings.from_env()
    if not settings.enabled:
        raise SystemExit("Set RADIO_ENABLED=true to run the radio worker")
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    lock_handle = (settings.storage_dir / "worker.lock").open("a+")
    if os.name == "nt":
        import msvcrt
        try:
            lock_handle.seek(0)
            msvcrt.locking(lock_handle.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            lock_handle.close()
            raise SystemExit("A radio worker already owns this storage directory")
    else:
        import fcntl
        try:
            fcntl.flock(lock_handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            lock_handle.close()
            raise SystemExit("A radio worker already owns this storage directory")
    worker = None
    try:
        with get_engine().connect() as connection:
            if not connection.scalar(text("SELECT pg_try_advisory_lock(2470036)")):
                raise SystemExit("A radio worker already owns the shared transmission queue")
            connection.commit()
            try:
                worker = RadioWorker(RadioRepository(create_session_factory(get_engine()), settings), settings)

                def stop_when_parent_closes_pipe():
                    sys.stdin.readline()
                    worker.stop.set()

                if os.environ.get("RADIO_MANAGED_WORKER") == "1":
                    threading.Thread(
                        target=stop_when_parent_closes_pipe,
                        name="radio-parent-shutdown",
                        daemon=True,
                    ).start()

                def health_check():
                    # Fail closed if the connection/session holding our singleton
                    # lock is lost, including an implicit SQLAlchemy reconnect.
                    owns_lock = connection.scalar(text(
                        "SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype='advisory' "
                        "AND pid=pg_backend_pid() AND classid=0 AND objid=2470036)"
                    ))
                    connection.commit()
                    if not owns_lock:
                        raise RuntimeError("Radio worker lost the shared transmission lock")

                for signum in (signal.SIGTERM, signal.SIGINT):
                    signal.signal(signum, lambda *_: worker.stop.set())
                worker.run(health_check=health_check)
            finally:
                connection.execute(text("SELECT pg_advisory_unlock(2470036)"))
                connection.commit()
    except Exception as error:
        snapshot = read_status(settings.storage_dir) or {}
        snapshot.update(
            state="error",
            pid=os.getpid(),
            enabled=True,
            error=f"{type(error).__name__}: {error}",
        )
        write_status(settings.storage_dir, snapshot)
        raise
    finally:
        lock_handle.close()


if __name__ == "__main__":
    main()
