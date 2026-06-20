#!/usr/bin/env python3
"""
AquaLert Serial Reader
Reads sensor values from an Arduino over USB serial and pushes them live to
the Vercel frontend via POST /api/ingest.

Run on any device that has the Arduino plugged in:
    pip install -r scripts/requirements.txt
    cp scripts/.env.example scripts/.env   # fill in VERCEL_INGEST_URL
    python scripts/serial_reader.py
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import uuid
import signal
import logging
from typing import Any

import requests
import serial
import serial.tools.list_ports
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the same directory as this script
load_dotenv(Path(__file__).parent / ".env")

# ---------------------------------------------------------------------------
# Config (all overridable via environment / .env)
# ---------------------------------------------------------------------------

VERCEL_INGEST_URL: str = os.getenv("VERCEL_INGEST_URL", "")
INGEST_SECRET: str    = os.getenv("INGEST_SECRET", "")
SERIAL_PORT: str      = os.getenv("SERIAL_PORT", "")
BAUD_RATE: int        = int(os.getenv("BAUD_RATE", "115200"))
DEVICE_ID: str        = os.getenv("DEVICE_ID", "aqualert-1")
PUSH_INTERVAL: float  = float(os.getenv("PUSH_INTERVAL", "1.0"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-5s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("serial_reader")

_running = True


def _handle_stop(sig, frame):
    global _running
    log.info("Stopping…")
    _running = False


signal.signal(signal.SIGINT, _handle_stop)
signal.signal(signal.SIGTERM, _handle_stop)


# ---------------------------------------------------------------------------
# Port auto-detection
# ---------------------------------------------------------------------------

_ARDUINO_KEYWORDS = (
    "arduino", "ch340", "ch341", "cp210", "cp2102",
    "ftdi", "usb serial", "usb-serial", "acm",
)


def auto_detect_port() -> str | None:
    """Return the first port that looks like an Arduino, or the first port."""
    ports = serial.tools.list_ports.comports()
    for p in ports:
        desc = (p.description or "").lower()
        if any(kw in desc for kw in _ARDUINO_KEYWORDS):
            log.info("Auto-detected Arduino on %s (%s)", p.device, p.description)
            return p.device
    if ports:
        log.info("No Arduino keyword found; using first available port %s", ports[0].device)
        return ports[0].device
    return None


# ---------------------------------------------------------------------------
# Serial line parsing
# ---------------------------------------------------------------------------

# Matches the first decimal/integer number in a line, e.g.:
#   "23.5", "Distance: 23.5 cm", "level=23.50", "d=017", "-1.2"
_NUMBER_RE = re.compile(r"[-+]?\d+(?:\.\d+)?")
_STRUCTURED_KEYS = (
    "arduino_sequence",
    "uptime_ms",
    "distance_cm",
    "fill_depth_cm",
    "tank_depth_cm",
    "fill_percent",
    "status",
    "confidence",
    "sample_count",
    "spread_cm",
)


def _as_float(value: object) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_json_payload(line: str) -> dict[str, Any] | None:
    """Parse a JSON serial line from the current Arduino sketch."""
    if not line.startswith("{"):
        return None
    try:
        payload = json.loads(line)
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    return payload


def parse_value(line: str) -> float | None:
    """Extract the first numeric value from a serial output line."""
    line = line.strip()
    if not line:
        return None
    try:
        return float(line)
    except ValueError:
        pass
    m = _NUMBER_RE.search(line)
    if m:
        try:
            return float(m.group())
        except ValueError:
            pass
    return None


def build_payload(raw_line: str) -> dict[str, Any] | None:
    """Convert either structured JSON or plain-text serial output into one ingest payload."""
    line = raw_line.strip()
    if not line:
        return None

    serial_payload = parse_json_payload(line)
    if serial_payload is not None:
        value = _as_float(serial_payload.get("value"))
        if value is None:
            value = _as_float(serial_payload.get("distance_cm"))
        if value is None:
            return None

        payload: dict[str, Any] = {
            "msg_id": str(uuid.uuid4()),
            "device_id": str(serial_payload.get("device_id") or DEVICE_ID),
            "ts": datetime.now(timezone.utc).isoformat(),
            "value": value,
            "raw": line,
        }
        for key in _STRUCTURED_KEYS:
            if key in serial_payload:
                payload[key] = serial_payload[key]
        return payload

    value = parse_value(line)
    if value is None:
        return None
    return {
        "msg_id": str(uuid.uuid4()),
        "device_id": DEVICE_ID,
        "ts": datetime.now(timezone.utc).isoformat(),
        "value": value,
        "raw": line,
    }


def format_payload(payload: dict[str, Any]) -> str:
    """Render a short operator-friendly summary for the terminal."""
    value = _as_float(payload.get("value"))
    status = payload.get("status")
    fill_percent = _as_float(payload.get("fill_percent"))

    parts = []
    if value is not None:
        parts.append(f"{value:.2f} cm")
    if status:
        parts.append(f"status={status}")
    if fill_percent is not None:
        parts.append(f"fill={fill_percent:.1f}%")
    return ", ".join(parts) if parts else "unparsed"


# ---------------------------------------------------------------------------
# Vercel push
# ---------------------------------------------------------------------------


def push_payload(payload: dict[str, Any]) -> bool:
    """POST one reading to the Vercel ingest endpoint. Returns True on success."""
    if not VERCEL_INGEST_URL:
        log.warning("VERCEL_INGEST_URL not set — skipping push (%s)", format_payload(payload))
        return False

    headers: dict[str, str] = {"Content-Type": "application/json"}
    if INGEST_SECRET:
        headers["x-ingest-secret"] = INGEST_SECRET

    try:
        r = requests.post(VERCEL_INGEST_URL, json=payload, headers=headers, timeout=5)
        r.raise_for_status()
        return True
    except requests.exceptions.Timeout:
        log.warning("POST timed out")
    except requests.exceptions.ConnectionError as exc:
        log.warning("Connection error: %s", exc)
    except requests.exceptions.HTTPError as exc:
        log.warning("HTTP %s: %s", exc.response.status_code, exc.response.text[:200])
    except Exception as exc:  # noqa: BLE001
        log.error("Unexpected push error: %s", exc)
    return False


# ---------------------------------------------------------------------------
# Serial helpers
# ---------------------------------------------------------------------------


def open_serial(port: str) -> serial.Serial:
    ser = serial.Serial(port, BAUD_RATE, timeout=2)
    time.sleep(2)          # wait for Arduino bootloader to finish
    ser.reset_input_buffer()
    return ser


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------


def main() -> None:
    port = SERIAL_PORT or auto_detect_port()
    if not port:
        log.error("No serial port found. Set SERIAL_PORT in .env or connect your Arduino.")
        sys.exit(1)

    log.info("=== AquaLert Serial Reader ===")
    log.info("Port      : %s @ %d baud", port, BAUD_RATE)
    log.info("Device ID : %s", DEVICE_ID)
    log.info("Endpoint  : %s", VERCEL_INGEST_URL or "(not set)")
    log.info("Interval  : %.1f s", PUSH_INTERVAL)
    log.info("")

    ser: serial.Serial | None = None
    last_push = 0.0
    pending_payload: dict[str, Any] | None = None
    errors = 0

    while _running:
        # --- Ensure serial connection ---
        if ser is None or not ser.is_open:
            try:
                ser = open_serial(port)
                errors = 0
                log.info("Serial connected on %s", port)
            except serial.SerialException as exc:
                log.error("Cannot open %s: %s — retry in %ds", port, exc, min(errors * 2 + 3, 15))
                time.sleep(min(errors * 2 + 3, 15))
                errors += 1
                continue

        # --- Read one line ---
        try:
            raw = ser.readline().decode("utf-8", errors="replace")
        except serial.SerialException as exc:
            log.error("Read error: %s — reconnecting", exc)
            try:
                ser.close()
            except Exception:  # noqa: BLE001
                pass
            ser = None
            errors += 1
            time.sleep(min(errors * 2, 10))
            continue

        payload = build_payload(raw)
        if payload is not None:
            pending_payload = payload
            print(f"  ← {raw.strip()!r:<96}  →  {format_payload(payload)}", end="", flush=True)

        # --- Push at interval ---
        now = time.time()
        if pending_payload is not None and (now - last_push) >= PUSH_INTERVAL:
            ok = push_payload(pending_payload)
            last_push = now
            print(f"  [{'OK' if ok else 'FAIL'}]", flush=True)
            pending_payload = None
        elif payload is not None:
            print(flush=True)

    if ser and ser.is_open:
        ser.close()
    log.info("Disconnected. Bye.")


if __name__ == "__main__":
    main()
