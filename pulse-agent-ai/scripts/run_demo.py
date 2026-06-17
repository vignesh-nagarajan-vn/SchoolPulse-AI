from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.agent import PulseAgent
from app.database import ensure_database


def main() -> None:
    ensure_database()
    agent = PulseAgent()
    questions = [
        "What should we fix first today?",
        "How should we reduce energy waste before the next volleyball game?",
        "What evidence proves this is not just a dashboard?",
    ]
    for question in questions:
        print("=" * 80)
        print(f"Q: {question}")
        response = agent.answer(question)
        print(f"A: {response['answer']}")
        print(f"Cards: {len(response['action_cards'])} Used LLM: {response['used_llm']}")


if __name__ == "__main__":
    main()
