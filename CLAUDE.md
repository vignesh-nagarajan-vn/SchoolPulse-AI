# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SchoolPulse AI** is the umbrella repo for **SchoolPulse**, an entry for USAII Global AI Hackathon 2026, High School Challenge 2 (Direction B: My School's Hidden Footprint). It is a suite of three independent edge AI modules plus a unifying web dashboard, all aimed at cutting a school's hidden water, energy, and food waste.

The repo holds four independently deployable pieces:

| Piece | Dir | Stack | What it is |
|---|---|---|---|
| **Aqualert AI** | `aqualert-ai/` | Python (stdlib + numpy) | Edge detector for running/leaking toilets. **No ML** — OLS regression + statistical CIs + a state machine. Runs on a Raspberry Pi Zero, simulates fully without hardware. |
| **Compost AI** | `Compost-AI/` | Jupyter + TensorFlow | EfficientNetB0 CNN (~96% acc) that sorts waste as garbage/recycling/compost. Weights are checked in as `.keras` + quantized `.tflite`. |
| **Pulse Agent AI** | `pulse-agent-ai/` | FastAPI + Next.js | The "brain" + dashboard. Backend does analytics, RAG, and a Gemma-or-fallback agent over synthetic/real logs; `web/` is the Next.js dashboard. |
| **Aqualert frontend** | `aqualert-frontend/` | Next.js + Vercel KV | Tiny standalone ingest app: receives live readings from the physical sensor (`/api/ingest`) and serves the latest (`/api/latest`). Separate from `pulse-agent-ai/web`. |

The umbrella repo is a plain git repo (no monorepo tooling) — each piece manages its own deps (`requirements.txt` for Python, `package.json` for Next apps).

## Cross-cutting design principles

These hold across every module and are the main thing to internalize:

- **Advisory only.** No module ever actuates anything irreversible — no purchases, repairs, schedule/route changes, or valve control. Every output is a *human-checkable action card* carrying a confidence score, a CI or evidence string, and an explicit "human check" step.
- **Graceful degradation is layered, by design.** Two independent fallbacks mean a demo always renders:
  1. **Backend** (`app/agent.py`): if no GPU/LLM is configured (`LLM_BASE_URL` unset) it returns a *deterministic* answer built from analytics — never errors out.
  2. **Frontend** (`web/lib/api.ts`): every `/api/*` call is wrapped; on failure it falls back to **bundled synthetic JSON** in `web/lib/fallback/*.json`. So the dashboards render with believable data even with the backend fully down. The proxy errors to `127.0.0.1:8000` you'll see in dev logs are expected when the backend isn't running.
- **Secrets only via env vars.** Never in `config.yaml`, `.env` (gitignored), or code. See `pulse-agent-ai/.env.example` and `aqualert-ai/config.example.yaml` for the full list.
- **Reproducible sims.** Simulators are seeded so demo runs repeat exactly.

---

## Prerequisites & Setup

**Python:** 3.9+ (tested on 3.10, 3.11)  
**Node.js:** 18+ (for Next.js apps)  
**Optional:** GPU + CUDA for faster TensorFlow training (Compost-AI) or Gemma inference (Pulse Agent)

All modules manage deps independently. Python projects use `requirements.txt`; Next apps use `package.json`. No monorepo tooling. Each venv is isolated and gitignored.

---

## Pulse Agent AI (`pulse-agent-ai/`)

This is where most active work happens. It is **two apps that talk over `/api/*`**.

### Data flow (read this before touching the backend)

```
data/synthetic/*.csv  (+ context docs, research_sources.json)
   │
   ├─ scripts/generate_synthetic_data.py → the CSV logs
   ├─ scripts/init_db.py                 → SQLite (DATABASE_PATH)
   ├─ scripts/build_rag_index.py         → rag_index/index.joblib (TF-IDF + matrix + chunks)
   └─ scripts/train_models.py            → energy/event models in models/
                         │
                         ▼
   app/analytics.py (AnalyticsService) ─ overview / energy / water / waste / events summaries
   app/rag.py       (RagRetriever)     ─ cosine sim over the joblib TF-IDF index (lazy-loaded)
   app/agent.py     (PulseAgent)       ─ RAG + analytics → Gemma (if configured) else deterministic fallback
                         │
                         ▼
   app/main.py  FastAPI  →  /api/* endpoints  →  dashboard(s)
```

`overview()` is the keystone: it produces `impact_totals` + `top_action_cards`, and both the home page and the agent answer are built on top of it.

### Backend: install & run

```bash
cd pulse-agent-ai
python -m venv .venv && source .venv/bin/activate   # .venv\Scripts\activate on Windows
pip install -r requirements.txt                     # +requirements-gpu.txt / -google.txt for those paths

# One-time data/index/db build:
python scripts/generate_synthetic_data.py
python scripts/init_db.py
python scripts/build_rag_index.py
python scripts/train_models.py

# Run the API. NOTE: the web app proxies to :8000 by default, so use 8000 if you
# want the Next dashboard to reach it (the backend README's :8010 is for the
# built-in test page only).
uvicorn app.main:app --reload --port 8000
```

- Built-in test dashboard: `http://127.0.0.1:8000/` (serves `app/static/index.html`)
- OpenAPI docs: `http://127.0.0.1:8000/docs`

Demo / smoke / full tests:

```bash
python scripts/run_demo.py              # asks a few sample questions end-to-end
python scripts/run_full_tests.py        # broader backend check
python scripts/run_gemma_smoke_test.py  # requires a GPU/Lambda LLM endpoint — see docs/gemma_lambda.md
```

Additional scripts:

```bash
python scripts/train_models.py          # train/retrain the energy + event detection models (outputs to models/)
python scripts/fetch_real_energy_sample.py  # fetch sample real energy logs (if data source is configured)
python scripts/sync_google_sheets.py    # sync analytics to a Google Sheet (requires GOOGLE_SHEETS_ID env var)
python scripts/sync_supabase_seed.py    # seed Supabase with synthetic data (requires SUPABASE_URL + KEY)
```

### Backend: the Gemma vs. fallback switch

The agent is CPU-safe by default. To enable Gemma, point it at any **OpenAI-compatible** `/chat/completions` endpoint (vLLM on a GPU box, Lambda, etc.) and restart uvicorn:

```bash
export LLM_BASE_URL="http://YOUR_GPU_IP:8000/v1"
export LLM_MODEL="google/gemma-4-12B-it"
export LLM_API_KEY="EMPTY"
```

`agent.py::_try_llm` calls it; any exception silently falls back to `_fallback_answer`. Voice (ElevenLabs) and Supabase/Google-Sheets sync are similarly optional and keyed off env vars.

### Frontend: `pulse-agent-ai/web` (Next.js 14, App Router)

```bash
cd pulse-agent-ai/web
npm install
npm run dev          # localhost:3000; proxies /api/* → PULSE_API_BASE (default http://127.0.0.1:8000)
npm run build
npm run lint
npm run gen:fallback # regenerate web/lib/fallback/*.json from ../data/synthetic/*.csv
```

- **API plumbing:** browser code calls *same-origin* `/api/*`. `next.config.mjs` rewrites those to `PULSE_API_BASE`. On Vercel, `pulse-agent-ai/vercel.json` instead rewrites `/api/*` to a **Cloudflare tunnel** URL that fronts the GPU box. So changing where the backend lives is a config change, never a code change.
- **Fallback data** in `web/lib/fallback/` is **generated, not hand-edited** — change the source CSVs (or `gen-fallback.mjs`) and rerun `npm run gen:fallback`.
- Pages: `app/page.tsx` (voice agent + footprint summary + action cards), and `app/{food,water,energy,events}/page.tsx` (per-module data tables). Shared UI in `components/` (shadcn-style primitives under `components/ui/`). Black-and-white design system; red is reserved exclusively for critical-row highlights.
- Live feeds: `/water` and `/food` poll `/api/water/live` and `/api/waste/live` on an interval; ingestion is `POST /api/{water,waste}/live` (backed by `app/water_live.py` / `app/waste_live.py`).

---

## Aqualert AI (`aqualert-ai/`)

### Detection pipeline

```
HC-SR04 sensor
  → sensor.py     (SimulatedSensor / HCSR04Sensor + VirtualClock)
  → measurement.py (7 samples, MAD outlier rejection, Student's-t 95% CI → Measurement)
  → detector.py   (event unwrap → OLS slope CI → state machine → Detection)
  → telemetry.py  (MQTT/TLS + REST fallback + SQLite store-and-forward)
```

**States:** `NORMAL`, `WATCH`, `LEAK_SUSPECTED`, `SENSOR_FAULT`. A leak is flagged only when the *upper* bound of the slope CI clears the threshold (conservative by design); during occupied hours a trend must sustain 3 consecutive windows before `WATCH → LEAK_SUSPECTED`. `gpiozero`/`RPi.GPIO` are imported lazily, and the REST fallback uses stdlib `urllib`, so nothing GPU/GPIO is a hard dependency — simulation runs anywhere.

### Run & test

```bash
cd aqualert-ai
pip install -r requirements.txt
# Secrets via AQUALERT_* env vars. Simulation needs no config file (scripts/simulate.py
# has a built-in default); only the real-Pi paths below require a config.yaml you supply
# with --config (set sensor.mode: real in it).

python scripts/simulate.py --scenario normal      # also: leak_slow --json, leak_fast, sensor_fault
python scripts/serial_reader.py                   # forwards a real Arduino serial feed (115200 baud JSON lines) → aqualert-frontend POST /api/ingest

# On a Pi with a real HC-SR04:
python scripts/calibrate.py --config config.yaml --empty   # then again for full tank
python -m aqualert.runner --config config.yaml

python server/receiver.py --config config.yaml --db telemetry.sqlite  # MQTT subscriber + read API (--no-mqtt for read-only)

python -m pytest                       # all tests
python -m pytest tests/test_detector.py            # one file
python -m pytest tests/test_detector.py::test_name # one test
```

`aqualert-frontend/` is the deployable counterpart: a Vercel app using `@vercel/kv` to receive those live sensor posts (`app/api/ingest`) and serve the latest reading (`app/api/latest`).

---

## Compost AI (`Compost-AI/`)

### The model

The model lives entirely in `Compost-AI/Compost AI (EfficientNetB0 ~96% Accuracy).ipynb`. Pre-trained weights are checked in:

- `Models/efficientnet-b0-weights.keras` — full Keras model
- `Models/quantized-tflite-weights.tflite` — quantized for Pi 4

To retrain/audit: open the notebook and run all cells (TensorFlow; a GPU helps, CPU works). Inference helpers are in `inference/`; evaluation artifacts in `Results/` and `Audit/`.

### Web app: `Compost-AI/web` (Next.js 14, camera capture)

A standalone Next.js app for real-time waste classification with camera capture and feedback:

```bash
cd Compost-AI/web
npm install
npm run dev          # localhost:3000
npm run build
npm run lint
```

- **Camera capture**: shoots a photo, POSTs it to `/api/classify`
- **Inference**: the backend calls the `.keras` model (via a Python server or Lambda) and returns class + confidence
- **Grad-CAM visualization**: highlights what the model focused on
- **Feedback loop**: logs corrections to Upstash Redis for retraining signals

Requires `NEXT_PUBLIC_INFERENCE_URL` env var pointing to the classification endpoint (e.g., a FastAPI server running the notebook's inference code).

---

## Environment Variables Reference

### Pulse Agent AI

Core:
- `DATABASE_PATH` — SQLite database path (default: `./data/agent.db`)
- `RAG_INDEX_PATH` — TF-IDF index path (default: `./rag_index/index.joblib`)
- `PULSE_API_BASE` — base URL for frontend to reach backend (default: `http://127.0.0.1:8000`)

LLM (Gemma):
- `LLM_BASE_URL` — OpenAI-compatible endpoint (e.g., `http://YOUR_GPU_IP:8000/v1`); unset = fallback only
- `LLM_MODEL` — model ID (e.g., `google/gemma-4-12B-it`)
- `LLM_API_KEY` — API key (can be `EMPTY` for local endpoints)

Optional features:
- `GOOGLE_SHEETS_ID` — Google Sheet ID for syncing analytics
- `SUPABASE_URL` + `SUPABASE_KEY` — Supabase project for data sync
- `ELEVENLABS_API_KEY` — ElevenLabs for voice output (agent page)

Frontend:
- `NEXT_PUBLIC_API_BASE` — backend URL visible to browser (default: `http://127.0.0.1:8000`)
- `NEXT_PUBLIC_FALLBACK_MODE` — force fallback data (set to `true` for offline testing)

### Aqualert AI

Sensor/hardware:
- `AQUALERT_MQTT_BROKER` — MQTT broker address
- `AQUALERT_MQTT_TOPIC` — topic to publish detections
- `AQUALERT_REST_ENDPOINT` — HTTP fallback URL
- `AQUALERT_SENSOR_MODE` — `simulated` or `real` (config file only)

See `aqualert-ai/config.example.yaml` for the full schema.

### Aqualert Frontend

- `KV_REST_API_URL` — Vercel KV endpoint URL
- `KV_REST_API_TOKEN` — Vercel KV auth token

### Compost AI Web

- `NEXT_PUBLIC_INFERENCE_URL` — API endpoint for the classification service

---

## Common Development Tasks

**Running the full stack locally:**

```bash
# Terminal 1: Python backend
cd pulse-agent-ai
source .venv/bin/activate  # .venv\Scripts\activate on Windows
uvicorn app.main:app --reload --port 8000

# Terminal 2: Next.js dashboard
cd pulse-agent-ai/web
npm run dev  # starts on :3000, proxies /api/* → :8000
```

**Testing a single module in isolation:**

- Pulse agent: `python scripts/run_demo.py` (no frontend needed)
- Aqualert: `cd aqualert-ai && python -m pytest tests/test_detector.py::test_name`
- Compost-AI: open the notebook in Jupyter, run cells to validate model changes

**Debugging API calls:**

- Built-in test page: `http://127.0.0.1:8000/` (html + fetch form)
- OpenAPI docs: `http://127.0.0.1:8000/docs` (Swagger)
- Frontend network tab: check browser DevTools to see actual `/api/*` calls

**Regenerating fallback data after CSV changes:**

```bash
cd pulse-agent-ai/web
npm run gen:fallback  # reads ../data/synthetic/*.csv and creates web/lib/fallback/*.json
```

**Windows-specific notes:**

- Use `python -m venv .venv` (not `python3`); activate with `.venv\Scripts\activate`
- Paths use backslashes in PowerShell; wrap in quotes or use forward slashes in Python strings
- Git hooks (pre-commit, etc.) may need Unix line endings — configure in `.git/config`

---

## Context & docs

`context/` holds the hackathon brief, challenge notes, and email/Doc synthesis that the RAG index ingests — start there for the "why." Deployment specifics (Vercel + GPU + Supabase + Google Sheets, and Lambda/Gemma) live in `pulse-agent-ai/docs/`.
