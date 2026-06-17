from __future__ import annotations

import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PROJECT_ROOT.parent


def resolve_project_path(value: str | None, default: str) -> Path:
    candidate = value or default
    path = Path(candidate)
    if path.is_absolute():
        return path
    return PROJECT_ROOT / path


DATABASE_PATH = resolve_project_path(os.getenv("DATABASE_PATH"), "data/processed/schoolprint_ai.db")
RAG_INDEX_PATH = resolve_project_path(os.getenv("RAG_INDEX_PATH"), "rag_index/index.joblib")

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "").rstrip("/")
LLM_MODEL = os.getenv("LLM_MODEL", "google/gemma-4-12B-it")
LLM_API_KEY = os.getenv("LLM_API_KEY", "EMPTY")

SYNTHETIC_DIR = PROJECT_ROOT / "data" / "synthetic"
MODELS_DIR = PROJECT_ROOT / "models"

