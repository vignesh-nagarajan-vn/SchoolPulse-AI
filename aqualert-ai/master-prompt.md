# Master Build Prompt — Aqualert Edge Leak Detector

> Paste everything below this line into Claude Opus 4.8 (High) as a single message.

---

## Role

You are a senior embedded/IoT engineer who values **simplicity, explainability, and code that actually runs**. Build a complete, production-lean repository in **one shot**. Do not stop to ask clarifying questions — make sensible engineering decisions, **state every assumption inline in the README**, and deliver the full repo. Favor a lean, dependency-light, explainable implementation over cleverness. No stubs or `# TODO` placeholders: every file must be complete and runnable.

## What you are building

**Aqualert** — an edge AI device that detects a *running / leaking toilet* (worn flapper or fill valve that won't fully seat) by watching the water level inside a **tank-type toilet**. An ultrasonic sensor mounted above the tank water surface measures the level over time. A healthy toilet shows a flat level that holds steady between flushes; a leaking one shows a slow **sawtooth decline** (level creeps down, with periodic micro-refills as the fill valve tops off) — *even when nobody has flushed in hours*. The device classifies this pattern, attaches a **confidence level with explicit margins of error**, and transmits telemetry to a remote server. A human reviews flags and decides on repairs — **the device never takes an irreversible action.**

## Target hardware (build to this exactly)

- **Compute:** Raspberry Pi Zero 2W, Python 3.11+, Raspberry Pi OS.
- **Sensor:** HC-SR04 ultrasonic rangefinder, mounted above the tank pointing straight down at the water surface.
- **Wiring (already finalized — encode these as config defaults):**
  | HC-SR04 | Pi connection | Notes |
  |---|---|---|
  | VCC | Pin 2 (5V) | sensor needs full 5V |
  | GND | Pin 6 (GND) | shared common ground |
  | Trig | GPIO23 (Pin 16) | 3.3V drive, direct |
  | Echo | GPIO24 (Pin 18) | **through a 1kΩ/2kΩ voltage divider** (5V→3.3V); Pi GPIO is not 5V-tolerant |
- Level `L = mount_height_cm − measured_distance_cm`. Rising water = shorter distance.

## Hardware abstraction (mandatory)

Provide a `Sensor` interface with **two interchangeable implementations** selected by config:
1. `HCSR04Sensor` — real driver using `gpiozero` (preferred) or `RPi.GPIO`, with the trigger-pulse/echo-timing measurement loop and a sane timeout.
2. `SimulatedSensor` — generates synthetic waveforms with **no hardware**, driven by a scenario parameter (`normal`, `leak_slow`, `leak_fast`, `sensor_fault`). It must reproduce realistic flush→refill→flat cycles and sawtooth-leak patterns, plus Gaussian noise and occasional out-of-range spurious readings.

**The entire system must run end-to-end in simulation mode on a laptop with zero hardware.** This is non-negotiable.

## Measurement layer (confidence intervals start here)

Raw ultrasonic readings are noisy and occasionally spurious. For each logical measurement:
- Take **N rapid samples** (configurable, default 7).
- Reject outliers using **median absolute deviation (MAD)**.
- Report `mean`, plus a **(1−α) confidence interval** using the **Student's t-distribution** (small N). Confidence level configurable, default **95%**.
- Ignore samples flagged as taken during **active refill turbulence** (level changing rapidly / high variance) — a churning surface scatters the echo; flag and skip those, never guess.
- On total sensor failure (no echo / all samples invalid), emit an explicit `SENSOR_FAULT` status. **Never fabricate or interpolate a value.**

## Detection layer (the "AI" / reasoning — keep it explainable)

No heavy ML. Use transparent statistics + a small state machine. Over a rolling time window:
- **Flush/refill detection:** identify sharp drops (flush) and recoveries (refill) to a learned full-line setpoint.
- **Trend test:** fit **ordinary least-squares regression** of level vs. time over the idle/hold window; report **slope and its standard error → a CI for the slope**.
- **Conservative flagging (two-sided "better safe than sorry"):**
  - *Noise gate (no false alarms):* only flag a decline when the **upper bound of the slope CI is below a configurable negative rate threshold** — i.e., the drop is both statistically real beyond measurement noise **and** large enough to matter.
  - *No silent misses:* a weak-but-nonzero anomaly is **never dropped** — surface it as `WATCH`.
- **Refill-event evidence:** count fill-valve micro-refills during the idle window; multiple refills with no human use is strong leak evidence.
- **Context weighting — idle window:** a configurable overnight window (default 23:00–05:00, school closed) where any significant decline or refill is **high confidence** (no legitimate use). During occupied hours, require a sustained multi-window trend before flagging, at lower per-event confidence.
- **Output:** a state in `{NORMAL, WATCH, LEAK_SUSPECTED, SENSOR_FAULT}` plus a **confidence score in [0,1]** derived from how far the slope CI sits from zero (effect size / t-statistic mapped to confidence), combined with refill evidence and idle-window context. Include the **reasoning trace** (slope, CI, refill count, window) on every detection so a human can audit it.
- **Impact estimate:** convert decline rate × tank cross-sectional area into **estimated gallons/day wasted, reported as a range** by propagating the slope CI — never a bare point estimate.

## Telemetry / wireless transport to remote server

- **Transport:** **MQTT over TLS (port 8883)** to a configurable broker, QoS 1. Provide an HTTPS-REST publisher as a fallback class behind the same interface.
- **Store-and-forward:** on publish failure (network down), persist messages to a **local SQLite queue** and flush them on reconnect. No data loss. Include a message id/timestamp so the server can **dedupe idempotently**.
- **Security:** credentials from **environment variables**, never hardcoded; `config.example.yaml` ships placeholders only.
- **Payload (JSON):** `device_id`, `timestamp_utc` (ISO-8601), `level_cm` (mean), `level_ci` `[low, high]`, `state`, `confidence`, `slope_cm_per_hr` (mean + CI), `refill_events`, `est_waste_gpd` `[low, high]`, `config_version`, `firmware_version`.

## Server-side ingestion (minimal — not a dashboard)

- A small receiver: an **MQTT subscriber** (paho-mqtt) that writes telemetry to **SQLite**, plus a tiny **Flask** read API exposing `GET /devices/{id}/latest` and `GET /devices/{id}/history` as JSON.
- A separate web dashboard is **out of scope** (another team owns it). Your job is to expose clean JSON they can consume.

## Configuration (no magic numbers in code)

Single `config.yaml` (with `config.example.yaml` template) holding: GPIO pins, `mount_height_cm`, tank `cross_section_cm2`, sample count, confidence level, sample interval, rolling-window length, min leak-rate threshold, idle-window times, broker host/port/topic, sensor mode (`real`/`sim`) and sim scenario. Validate config on load and fail loudly on bad values.

## Repository structure (lean — don't over-modularize)

```
aqualert/
  README.md
  requirements.txt
  config.example.yaml
  src/aqualert/
    __init__.py
    config.py          # load + validate
    models.py          # dataclasses: Reading, Measurement, Detection, TelemetryMsg
    sensor.py          # Sensor interface + HCSR04Sensor + SimulatedSensor
    measurement.py     # sampling, MAD outlier rejection, mean ± t-CI
    detector.py        # flush/refill detection, OLS slope+CI, state machine, confidence, impact range
    telemetry.py       # MQTT(TLS)/REST publisher + SQLite store-and-forward
    runner.py          # main loop wiring sensor → measurement → detector → telemetry
  server/
    receiver.py        # MQTT subscriber + Flask read API
    schema.sql
  scripts/
    calibrate.py       # measure mount height & learn full-line; write to config
    simulate.py        # run full pipeline on synthetic data (demo)
  tests/
    test_measurement.py
    test_detector.py
    test_telemetry.py
```

## Code quality constraints

- Python 3.11+, type hints throughout, `dataclasses` for data, `logging` (not `print`), graceful error handling, clean docstrings.
- Lightweight deps only (`gpiozero`, `paho-mqtt`, `numpy`, `scipy` for the t-distribution, `pyyaml`, `flask`, `pytest`). Justify anything beyond these.
- **Tests with pytest** that prove the core behavior: CI math is correct; MAD rejects outliers; the detector **flags `leak_slow`/`leak_fast` and does NOT flag `normal`**; the telemetry buffer persists during a simulated outage and flushes on reconnect.

## Responsible-AI / human-in-the-loop (must be enforced in code, not just docs)

- Every alert carries its **confidence and the numeric reasoning** behind it.
- Alerts are **advisory only**. The system **never** closes a valve, calls a plumber, or takes any irreversible action — it flags, a human confirms. State this explicitly in the README as the human-in-the-loop boundary.
- On sensor fault or insufficient data, emit explicit status — never a guessed value or a silent pass.

## README must include

Overview; the wiring table above; install steps; config guide; how to **calibrate**, **run on the Pi**, **run in simulation**, **run the server**, and **run tests**; the JSON payload schema; and a short **Assumptions** section listing every default you chose and a **Responsible-AI** section stating the risk (e.g., inaccurate estimate from a single noisy sensor), the mitigation (confidence intervals + noise gate + transparent reasoning), and the human-in-the-loop decision the device does not make.

## Acceptance criteria (self-check before you finish)

1. `python scripts/simulate.py --scenario normal` runs with no hardware and reports `NORMAL`.
2. `--scenario leak_slow` and `leak_fast` report `LEAK_SUSPECTED` with a confidence and a gallons/day range.
3. `--scenario sensor_fault` reports `SENSOR_FAULT`, never a fabricated value.
4. `pytest` passes.
5. The server receiver ingests simulated telemetry and serves it as JSON.
6. No credentials are hardcoded anywhere.

Deliver the complete repository now.
