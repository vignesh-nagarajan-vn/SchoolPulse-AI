# Project Context

This repo is for Aqualert AI, the water-leak detection module inside the broader SchoolPulse hackathon concept.

## Current Direction

- Hackathon: USAII Global AI Hackathon 2026.
- Track: High School, Challenge 2, Direction B: My School's Hidden Footprint.
- Core idea: a suite of edge AI tools that reveal hidden school resource waste across water, food, and energy, tied together by a dashboard.
- Product name from the ideation doc: SchoolPulse.
- Repo focus today: Aqualert AI / LeakListener, an acoustic edge AI tool for detecting water leaks before they become major failures.

## Why This Fits The Brief

Challenge 2 asks for an AI-powered MVP that helps a school understand environmental impact and take practical, measurable action. Direction B specifically asks teams to make hidden school footprint patterns visible, show how specific behaviors affect outcomes, and help users prioritize high-impact actions.

Aqualert AI fits because it turns hidden water waste into a local, measurable alert: where the leak is, why the AI thinks it is a leak, estimated impact, confidence, and what a custodian should check.

## System Concept

- Pipe Listener / Aqualert AI: contact microphone or sound sensor on pipes, audio/vibration classifier, leak anomaly alerts.
- Compost AI / BinGuard / LunchLens: camera-based classifier for compost, recycling, landfill, unopened food, and cafeteria waste patterns.
- Energy module options: Cold Chain Node for freezers, Room Ghost Node for empty-room HVAC/lights, or Power Sniffer Node for phantom loads.
- SchoolPulse dashboard: incident cards, school footprint map, confidence, environmental impact, recommended action, and status.
- Voice agent: optional assistant for facilities/cafeteria staff to ask what to fix first or log a resolved issue.

## Judging Lens To Optimize For

- Problem understanding: 30%. Make it local and specific to the school, not generic sustainability.
- AI reasoning: 20%. Show classification, anomaly detection, prediction, or recommendations.
- Solution design: 20%. Make the input -> AI -> insight -> action flow obvious.
- Impact and insight: 20%. Estimate water/food/energy saved and show behavior change.
- Responsible AI: 10%. Include risk, mitigation, and human-in-the-loop review.

## Public Evidence Already In Repo

- `Parentsquare Screenshot 1.png`: BASIS Phoenix school closure due to a water main break affecting campus operations.
- `Parentsquare Screenshot 2.png`: BASIS Phoenix notice about very low water pressure from a water main break.

These are strong local examples for the Aqualert AI problem framing.

## Private Notes

Detailed email-derived information, including the qualifier code, is stored locally under `info/private/` and is intentionally gitignored because this repository is public.

