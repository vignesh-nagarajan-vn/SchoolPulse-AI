from __future__ import annotations

import json
from typing import Any

import requests

from .analytics import AnalyticsService
from .config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
from .rag import RagRetriever


SYSTEM_PROMPT = """You are Pulse Agent AI for SchoolPrint AI.
You help school staff reduce hidden water, energy, food, event, and transportation waste.
Use retrieved school context and structured analytics.
Do not pretend a recommendation is certain. Include confidence and a human verification step.
Do not order purchases, repairs, route changes, or schedule changes without human approval.
Answer concisely in a school-operations tone."""


class PulseAgent:
    def __init__(self):
        self.analytics = AnalyticsService()
        self.rag = RagRetriever()

    def answer(self, query: str) -> dict[str, Any]:
        retrieved = self.rag.search(query, top_k=5)
        overview = self.analytics.overview()
        cards = overview["top_action_cards"]

        llm_answer = self._try_llm(query, retrieved, overview)
        if llm_answer:
            answer = llm_answer
            used_llm = True
        else:
            answer = self._fallback_answer(query, retrieved, overview)
            used_llm = False

        return {
            "answer": answer,
            "action_cards": cards,
            "citations": [
                {
                    "title": item["title"],
                    "source": item["source"],
                    "score": round(float(item["score"]), 3),
                }
                for item in retrieved
            ],
            "used_llm": used_llm,
        }

    def _try_llm(self, query: str, retrieved: list[dict], overview: dict) -> str | None:
        if not LLM_BASE_URL:
            return None

        context = "\n\n".join(
            f"[{item['title']} | {item['source']}]\n{item['text']}" for item in retrieved
        )
        payload = {
            "model": LLM_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Question: {query}\n\n"
                        f"Retrieved context:\n{context}\n\n"
                        f"Current analytics JSON:\n{json.dumps(overview, indent=2)}\n\n"
                        "Give a concise answer and name the most important next action."
                    ),
                },
            ],
            "temperature": 0.25,
            "max_tokens": 700,
        }
        headers = {"Content-Type": "application/json"}
        if LLM_API_KEY:
            headers["Authorization"] = f"Bearer {LLM_API_KEY}"

        try:
            response = requests.post(
                f"{LLM_BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
                timeout=60,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
        except Exception:
            return None

    def _fallback_answer(self, query: str, retrieved: list[dict], overview: dict) -> str:
        totals = overview["impact_totals"]
        top_card = overview["top_action_cards"][0] if overview["top_action_cards"] else None
        context_note = ""
        if retrieved:
            context_note = f" I grounded this in `{retrieved[0]['title']}`."

        if top_card:
            return (
                f"Highest priority: {top_card['title']} in {top_card['location']}. "
                f"{top_card['recommendation']} Evidence: {top_card['evidence']} "
                f"Estimated impact: {top_card['estimated_impact']} "
                f"Human check: {top_card['human_check']}{context_note} "
                f"Current totals show about {totals['estimated_wasted_kwh']} wasted kWh, "
                f"{totals['open_water_gallons_at_risk']} gallons at water risk, and "
                f"{totals['food_waste_lbs_logged']} lb food waste logged."
            )

        return (
            "I do not have enough logs yet to rank a real action. "
            "Load synthetic or real data, rebuild the RAG index, and ask again."
        )
