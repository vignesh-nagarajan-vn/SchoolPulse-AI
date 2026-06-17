from __future__ import annotations

from pathlib import Path

import joblib

from .config import RAG_INDEX_PATH


class RagRetriever:
    def __init__(self, index_path: Path = RAG_INDEX_PATH):
        self.index_path = index_path
        self._index = None

    def _load(self) -> None:
        if self._index is None and self.index_path.exists():
            self._index = joblib.load(self.index_path)

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        self._load()
        if self._index is None:
            return []

        vectorizer = self._index["vectorizer"]
        matrix = self._index["matrix"]
        chunks = self._index["chunks"]

        query_vector = vectorizer.transform([query])
        scores = (matrix @ query_vector.T).toarray().ravel()
        ranked = scores.argsort()[::-1][:top_k]

        results = []
        for index in ranked:
            if scores[index] <= 0:
                continue
            chunk = dict(chunks[int(index)])
            chunk["score"] = float(scores[index])
            results.append(chunk)
        return results

