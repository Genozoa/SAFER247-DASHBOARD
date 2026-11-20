"""Radio configuration shared by the HTTP API and independent worker."""
from dataclasses import dataclass, field
import json
import os
from pathlib import Path


def _command(name: str) -> tuple[str, ...]:
    value = os.environ.get(name, "")
    if not value:
        return ()
    parsed = json.loads(value)
    if not isinstance(parsed, list) or not parsed or not all(isinstance(v, str) and v for v in parsed):
        raise ValueError(f"{name} must be a nonempty JSON array of command arguments")
    return tuple(parsed)


@dataclass(frozen=True)
class RadioSettings:
    enabled: bool = False
    station: str = "N0CALL"
    storage_dir: Path = field(default_factory=lambda: Path("app/radio_lab/var"))
    spool_dir: Path = field(default_factory=lambda: Path("app/radio_lab/var/incoming"))
    output_dir: Path = field(default_factory=lambda: Path("app/radio_lab/var/outgoing"))
    gen_packets: str = "gen_packets"
    atest: str = "atest"
    sample_rate: int = 48000
    input_command: tuple[str, ...] = ()
    output_command: tuple[str, ...] = ()
    input_device: str | None = None
    output_device: str | None = None
    input_enabled: bool = True
    output_enabled: bool = True
    enhance: bool = True
    command_timeout: float = 60.0
    max_recording_seconds: int = 120
    max_wav_bytes: int = 12 * 1024 * 1024

    @classmethod
    def from_env(cls) -> "RadioSettings":
        storage = Path(os.environ.get("RADIO_STORAGE_DIR", "app/radio_lab/var")).resolve()
        sample_rate = int(os.environ.get("RADIO_SAMPLE_RATE", "48000"))
        if sample_rate != 48000:
            raise ValueError("The reviewed radio codec profile requires RADIO_SAMPLE_RATE=48000")
        timeout = float(os.environ.get("RADIO_COMMAND_TIMEOUT", "60"))
        if not 1 <= timeout <= 300:
            raise ValueError("RADIO_COMMAND_TIMEOUT must be between 1 and 300 seconds")
        return cls(
            enabled=os.environ.get("RADIO_ENABLED", "false").lower() in {"1", "true", "yes"},
            station=os.environ.get("RADIO_STATION", "N0CALL").upper(),
            storage_dir=storage,
            spool_dir=Path(os.environ.get("RADIO_SPOOL_DIR", str(storage / "incoming"))).resolve(),
            output_dir=Path(os.environ.get("RADIO_OUTPUT_DIR", str(storage / "outgoing"))).resolve(),
            gen_packets=os.environ.get("RADIO_GEN_PACKETS", "gen_packets"),
            atest=os.environ.get("RADIO_ATEST", "atest"),
            sample_rate=sample_rate,
            input_command=_command("RADIO_INPUT_COMMAND"),
            output_command=_command("RADIO_OUTPUT_COMMAND"),
            input_device=os.environ.get("RADIO_INPUT_DEVICE") or None,
            output_device=os.environ.get("RADIO_OUTPUT_DEVICE") or None,
            input_enabled=(
                os.environ.get("RADIO_INPUT_ENABLED", "true").lower()
                in {"1", "true", "yes"}
            ),
            output_enabled=(
                os.environ.get("RADIO_OUTPUT_ENABLED", "true").lower()
                in {"1", "true", "yes"}
            ),
            enhance=os.environ.get("RADIO_ENHANCE", "true").lower() in {"1", "true", "yes"},
            command_timeout=timeout,
        )
