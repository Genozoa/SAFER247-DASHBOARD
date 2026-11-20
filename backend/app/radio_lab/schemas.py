"""Bounded APRS transmission requests."""
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class TransmissionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    kind: Literal["text", "position"]
    text: str | None = Field(default=None, max_length=67)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    addressee: str = Field(default="ALL", min_length=1, max_length=9)
    station: str | None = Field(default=None, min_length=1, max_length=20)

    @field_validator("addressee")
    @classmethod
    def validate_addressee(cls, value: str) -> str:
        value = value.upper()
        if not re.fullmatch(r"[A-Z0-9_-]{1,9}", value):
            raise ValueError("APRS addressee must contain 1–9 letters, digits, '_' or '-'.")
        return value

    @model_validator(mode="after")
    def validate_kind(self):
        if self.kind == "text":
            if not self.text or not self.text.strip():
                raise ValueError("APRS message text is required.")
            if self.latitude is not None or self.longitude is not None:
                raise ValueError("Use a position request for geographic coordinates.")
            forbidden = "{|~"
        else:
            if self.latitude is None or self.longitude is None:
                raise ValueError("A position requires latitude and longitude.")
            if self.text and len(self.text) > 43:
                raise ValueError("APRS position comments are limited to 43 characters.")
            forbidden = "|"
        if self.text and any(ord(c) < 32 or ord(c) > 126 or c in forbidden for c in self.text):
            raise ValueError("APRS text must use printable ASCII without protocol delimiters.")
        return self
