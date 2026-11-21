"""Private Argon2 registration code verification and bounded attempt tracking."""
from collections import deque
import getpass
import os
import time
from threading import Lock

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import HTTPException, Request

_CODE_HASHER = PasswordHasher()


class AttemptLimiter:
    """Single-process throttle. Use an edge rate limit for multi-worker deployments."""

    def __init__(self):
        self._lock = Lock()
        self._per_client = {}
        self._global = deque()

    def check(self, client_key: str):
        now = time.monotonic()
        window = 900
        with self._lock:
            while self._global and self._global[0] <= now - window:
                self._global.popleft()
            if len(self._per_client) > 4096:
                self._per_client = {
                    key: records for key, records in self._per_client.items()
                    if records and records[-1] > now - window
                }
            records = self._per_client.setdefault(client_key, deque())
            while records and records[0] <= now - window:
                records.popleft()
            if len(records) >= 5 or len(self._global) >= 200:
                retry = max(1, int((records[0] if len(records) >= 5 else self._global[0]) + window - now) + 1)
                raise HTTPException(
                    status_code=429,
                    detail="Too many registration code attempts. Try again later.",
                    headers={"Retry-After": str(retry)},
                )
            records.append(now)
            self._global.append(now)

    def reset(self):
        """Test isolation only."""
        with self._lock:
            self._per_client.clear()
            self._global.clear()


attempt_limiter = AttemptLimiter()


def verify_registration_code(candidate: str, request: Request) -> None:
    encoded = os.environ.get("OPERATOR_REGISTRATION_CODE_HASH", "").strip()
    if not encoded:
        raise HTTPException(status_code=503, detail="Operator registration is disabled.")
    attempt_limiter.check(request.client.host if request.client else "unknown")
    try:
        _CODE_HASHER.verify(encoded, candidate)
    except VerifyMismatchError as error:
        raise HTTPException(status_code=403, detail="Invalid personnel registration code.") from error
    except (InvalidHashError, VerificationError) as error:
        raise HTTPException(status_code=503, detail="Registration code configuration is invalid.") from error


def main():
    code = getpass.getpass("New personnel registration code: ")
    if not code:
        raise SystemExit("A nonempty registration code is required.")
    if code != getpass.getpass("Repeat registration code: "):
        raise SystemExit("Registration codes did not match.")
    print("OPERATOR_REGISTRATION_CODE_HASH=" + _CODE_HASHER.hash(code))


if __name__ == "__main__":
    main()
