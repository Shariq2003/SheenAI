"""Enumerations shared by the ORM models and the Pydantic schemas."""

import enum


class TaskStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    done = "done"
    missed = "missed"


class PrayerSlot(str, enum.Enum):
    """The five daily prayers, in order. Used by prayer recurring templates."""

    fajr = "fajr"
    dhuhr = "dhuhr"
    asr = "asr"
    maghrib = "maghrib"
    isha = "isha"
