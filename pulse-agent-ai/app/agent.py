from __future__ import annotations

import json
import re
from typing import Any

import requests

from .analytics import AnalyticsService
from .config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
from .rag import RagRetriever
from .scenarios import build_scenario_brief


SYSTEM_PROMPT = """You are Pulse Agent, the operations assistant for SchoolPulse AI.
You help school staff cut hidden water, energy, food, event, and transportation waste.

Voice and tone:
- Talk like a sharp, friendly colleague who sits down next to the staff member, not a report generator.
- Warm, direct, and encouraging. Use "you" and "we". Plain spoken language a busy teacher can act on.
- Answer the actual question FIRST, in the first sentence, with a concrete number or action. No throat-clearing.
- Keep it short enough to be read aloud comfortably.

Grounding rules:
- Use the retrieved school context and the analytics provided. Do not invent numbers.
- Be honest about confidence, and always include one quick human verification step.
- Never order purchases, repairs, route changes, or schedule changes on your own -- you recommend, a human approves.
- Do not use Markdown, asterisks, bullet symbols, code fences, or raw JSON. Use short titled sections and plain sentences."""


SCENARIO_SYSTEM_PROMPT = """You are Pulse Agent, the operations assistant for SchoolPulse AI -- a sharp, friendly colleague helping school staff plan smarter and waste less.

You will be given a Scenario brief that already contains the correct, pre-computed numbers for this exact question. Your job is to deliver those numbers as a warm, confident, conversational answer.

Hard rules:
- Use the numbers in the Scenario brief EXACTLY. Do not recompute, round differently, or invent new figures.
- Answer the question directly in the first sentence (the recommended order size or the cost impact).
- Then briefly show the reasoning the way a helpful colleague would: what happened last time, what went wrong (the waste), and why your recommendation is better.
- If the brief says it used the closest event because there was no exact match, say so honestly in one phrase.
- End with one short, friendly human-check line, using the HUMAN CHECK LINE idea given in the brief (do not swap in an unrelated one).
- Warm and spoken, like you are talking to one person. No Markdown, no asterisks, no bullet characters, no JSON. Short paragraphs that read well aloud."""


LANGUAGE_NAMES = {
    "en-US": "English",
    "es-US": "Spanish",
    "hi-IN": "Hindi",
    "zh-CN": "Simplified Chinese",
    "ar": "Arabic",
    "fr-FR": "French",
}


SECTION_LABELS = {
    "en-US": {
        "priority": "Highest priority",
        "why": "Why",
        "next": "Next step",
        "human": "Human check",
    },
    "es-US": {
        "priority": "Prioridad máxima",
        "why": "Por qué",
        "next": "Siguiente paso",
        "human": "Verificación humana",
    },
    "hi-IN": {
        "priority": "सबसे ज़रूरी काम",
        "why": "क्यों",
        "next": "अगला कदम",
        "human": "मानवीय जांच",
    },
    "zh-CN": {
        "priority": "最高优先级",
        "why": "原因",
        "next": "下一步",
        "human": "人工确认",
    },
    "ar": {
        "priority": "الأولوية الأعلى",
        "why": "السبب",
        "next": "الخطوة التالية",
        "human": "تحقق بشري",
    },
    "fr-FR": {
        "priority": "Priorité principale",
        "why": "Pourquoi",
        "next": "Prochaine étape",
        "human": "Vérification humaine",
    },
}


LABEL_ALIASES = {
    "highest priority": "priority",
    "most important next action": "priority",
    "why": "why",
    "details": "why",
    "next step": "next",
    "human check": "human",
    "human verification required": "human",
}


class PulseAgent:
    def __init__(self):
        self.analytics = AnalyticsService()
        self.rag = RagRetriever()

    def answer(self, query: str, language: str = "en-US") -> dict[str, Any]:
        retrieved = self.rag.search(query, top_k=5)
        overview = self.analytics.overview()
        cards = overview["top_action_cards"]
        scenario = build_scenario_brief(query)

        llm_answer = self._try_llm(query, retrieved, overview, language, scenario)
        if llm_answer:
            answer = llm_answer
            used_llm = True
        else:
            answer = self._fallback_answer(query, retrieved, overview, language, scenario)
            used_llm = False

        return {
            "answer": answer,
            "action_cards": cards,
            "scenario": scenario["kind"] if scenario else None,
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

    def _try_llm(
        self,
        query: str,
        retrieved: list[dict],
        overview: dict,
        language: str,
        scenario: dict | None = None,
    ) -> str | None:
        if not LLM_BASE_URL:
            return None

        language_name = LANGUAGE_NAMES.get(language, "English")
        context = "\n\n".join(
            f"[{item['title']} | {item['source']}]\n{item['text']}" for item in retrieved
        )

        if scenario:
            system_prompt = SCENARIO_SYSTEM_PROMPT
            user_content = (
                f"Question: {query}\n\n"
                f"Scenario brief (authoritative, pre-computed -- use these exact numbers):\n"
                f"{scenario['text']}\n\n"
                f"Supporting school context:\n{context}\n\n"
                f"Write the answer in {language_name}, warm and conversational, "
                "leading with the direct recommendation. Do not use Markdown or JSON."
            )
            max_tokens = 550
            temperature = 0.4
        else:
            system_prompt = SYSTEM_PROMPT
            labels = self._section_labels(language)
            label_list = ", ".join(labels.values())
            user_content = (
                f"Question: {query}\n\n"
                f"Retrieved context:\n{context}\n\n"
                f"Current analytics JSON:\n{json.dumps(overview, indent=2)}\n\n"
                f"Answer in {language_name}. "
                "Lead with a direct, helpful first sentence, then name the most important next action. "
                f"Format with these plain {language_name} labels only: {label_list}. "
                "If English is not selected, do not use English section labels. "
                "Do not use Markdown, bullets with asterisks, code fences, or raw JSON."
            )
            max_tokens = 700
            temperature = 0.3

        payload = {
            "model": LLM_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
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
            answer = data["choices"][0]["message"]["content"].strip()
            if scenario:
                return answer
            return self._localize_section_labels(answer, language)
        except Exception:
            return None

    def _fallback_answer(
        self,
        query: str,
        retrieved: list[dict],
        overview: dict,
        language: str,
        scenario: dict | None = None,
    ) -> str:
        # Scenario questions: the brief already has the right numbers, so return a
        # clean templated answer even when the LLM is offline.
        if scenario:
            if scenario["kind"] == "event_food":
                lead = f"Here's my recommendation: {scenario['headline']}."
            else:
                lead = f"Here's the estimate: {scenario['headline']}."
            return (
                f"{lead}\n\n"
                f"{scenario['text']}\n\n"
                "Human check: confirm the final numbers with the office or facilities before you commit."
            )

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

    def _section_labels(self, language: str) -> dict[str, str]:
        return SECTION_LABELS.get(language, SECTION_LABELS["en-US"])

    def _localize_section_labels(self, answer: str, language: str) -> str:
        labels = self._section_labels(language)
        if labels == SECTION_LABELS["en-US"]:
            return answer

        localized_lines: list[str] = []
        pattern = re.compile(
            r"^(Highest priority|Most important next action|Why|Details|Next step|Human check|Human verification required)\s*:?\s*(.*)$",
            re.IGNORECASE,
        )
        for line in answer.splitlines():
            match = pattern.match(line.strip())
            if not match:
                localized_lines.append(line)
                continue

            key = LABEL_ALIASES.get(match.group(1).lower())
            if not key:
                localized_lines.append(line)
                continue

            suffix = match.group(2).strip()
            localized = labels[key]
            localized_lines.append(f"{localized}: {suffix}" if suffix else localized)

        return "\n".join(localized_lines).strip()
