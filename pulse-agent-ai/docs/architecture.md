# Pulse Agent AI Architecture

Pulse Agent AI is the backend intelligence layer for SchoolPrint AI.

```text
Project docs + challenge brief + email notes + ParentSquare evidence
Synthetic logs + future real logs
Utility/event/waste/water data
        |
        v
SQLite operational database
        |
        +--> Energy anomaly model
        +--> Event food/energy planning model
        +--> Waste and water rule summaries
        |
        v
RAG retriever over project context and research sources
        |
        v
Gemma 4 or CPU fallback Pulse Agent
        |
        v
Action cards + API responses + voice/chat answer
```

## Backend Responsibilities

- Store school footprint logs in one schema.
- Detect energy waste from schedule, event, weather, expected load, and actual load.
- Forecast event needs from past event outcomes.
- Retrieve challenge/project context before the agent answers.
- Convert data into simple action cards for the dashboard.
- Keep every important recommendation human-verifiable.

## Voice Agent

The voice layer should be thin:

```text
speech-to-text
-> POST /api/agent/query
-> RAG + analytics + Gemma response
-> text-to-speech
```

For the MVP, browser speech recognition or Whisper can produce the transcript. The backend only needs text. Later, Gemma 4 audio input can be tested directly on Lambda, but text-in/text-out is easier to demo reliably.

## Why This Is Better Than A Dashboard Alone

The dashboard shows the result. Pulse Agent AI creates the result:

- It retrieves the right context.
- It reasons over live logs.
- It ranks what matters most.
- It explains uncertainty.
- It creates the human-check step.

