from __future__ import annotations

import json
import re
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize


ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parent
OUT = ROOT / "rag_index"


DOC_PATHS = [
    REPO_ROOT / "README.md",
    REPO_ROOT / "context" / "README.md",
    REPO_ROOT / "context" / "briefs" / "README.md",
    REPO_ROOT / "context" / "source-notes" / "google-doc-final-idea.md",
    REPO_ROOT / "context" / "source-notes" / "repo-understanding.md",
    REPO_ROOT / "context" / "evidence" / "README.md",
    REPO_ROOT / "info" / "email-summary.md",
    ROOT / "docs" / "architecture.md",
    ROOT / "docs" / "data_strategy.md",
    ROOT / "data" / "raw" / "research_sources.json",
]


def chunks_from_text(text: str, title: str, source: str) -> list[dict]:
    parts = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    chunks = []
    buffer: list[str] = []
    for part in parts:
        buffer.append(part)
        if sum(len(item.split()) for item in buffer) >= 90:
            chunks.append({"title": title, "source": source, "text": "\n\n".join(buffer)})
            buffer = []
    if buffer:
        chunks.append({"title": title, "source": source, "text": "\n\n".join(buffer)})
    return chunks


def read_document(path: Path) -> list[dict]:
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8")
    if path.suffix == ".json":
        data = json.loads(raw)
        text = json.dumps(data, indent=2)
    else:
        text = raw
    title = path.stem.replace("-", " ").replace("_", " ").title()
    source = str(path.relative_to(REPO_ROOT))
    return chunks_from_text(text, title, source)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    chunks: list[dict] = []
    for path in DOC_PATHS:
        chunks.extend(read_document(path))

    if not chunks:
        raise SystemExit("No documents found for RAG index.")

    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), max_features=7000)
    matrix = vectorizer.fit_transform([chunk["text"] for chunk in chunks])
    matrix = normalize(matrix)
    joblib.dump({"vectorizer": vectorizer, "matrix": matrix, "chunks": chunks}, OUT / "index.joblib")
    (OUT / "chunks.json").write_text(json.dumps(chunks, indent=2), encoding="utf-8")
    print(f"Built RAG index with {len(chunks)} chunks at {OUT / 'index.joblib'}")


if __name__ == "__main__":
    main()
