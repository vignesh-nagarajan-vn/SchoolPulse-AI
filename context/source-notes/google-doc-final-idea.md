# Google Doc Context: Final Hackathon Idea

Source reviewed: the shared Google Doc tab named `Final Hackathon Idea`.

## Final Chosen Direction

Challenge 2, Direction B: My School's Hidden Footprint.

The doc frames the project as a suite of AI tools that help a school reduce water consumption, energy consumption, and food consumption. The three independent edge AI tools connect into one dashboard that visualizes how each tool reduces school-wide consumption.

## Aqualert AI / LeakListener

Problem: schools lose water and money from hidden restroom, toilet, sink, shower, and pipe leaks. Staff often notice only after a pipe bursts or an expensive water bill arrives.

Solution: an acoustic edge AI device attaches to toilet, sink, shower, and main bathroom supply pipes. It detects potential leaks from water-flow sound patterns and alerts the school so a custodian can verify and call a plumber early.

Software: binary audio classifier for normal pipe sounds vs. leaking pipe sounds.

Hardware: Raspberry Pi Zero, sound sensor module or contact microphone, water level sensor, and optional ultrasonic sensor.

Key pitch angle: "Your school's pipes are screaming. Nobody's listening." A leak has a sustained high-frequency hiss or continuous vibration that differs from normal burst-and-stop water use.

## Compost AI / BinGuard / LunchLens

Problem: food waste goes uneaten and often enters landfills instead of composting. Compost streams can be rejected when contaminated by plastic, glass, or other non-compostable items.

Solution: smart bin or cafeteria scanner using computer vision to classify items as garbage, recycling, compost, unopened food, food scraps, or contaminants. The system can alert when a bin is full and flag low-confidence classifications for human review.

Software: CNN or object detector for waste/food categories.

Hardware: Raspberry Pi 4, camera module, ultrasonic fullness sensor, three-bin container, and servo motors.

## Energy Tool Options

The doc leaves the energy module open but suggests several strong directions:

- Cold Chain Node: freezer/fridge temperature, door, compressor vibration, humidity, and optional power draw to detect spoilage risk and energy waste.
- Room Ghost Node: occupancy, light, temperature, humidity, sound, and optional CO2 sensors to detect lights or HVAC running in empty rooms.
- Power Sniffer Node: current clamp or smart plug to detect phantom loads from projectors, smartboards, vending machines, printers, cafeteria warmers, or lab equipment.

Best MVP: physically build 2-3 modules and simulate the rest in the dashboard. Recommended physical modules are Pipe Listener, Cold Chain Node, and LunchLens/BinGuard.

## Dashboard: SchoolPulse

Dashboard concept: Hidden Footprint Map.

Each incident card should show:

- What happened.
- Where it happened.
- Why the AI thinks it happened.
- Environmental impact.
- Confidence.
- Recommended fix.
- Status: open, confirmed, or resolved.

Example water incident:

- Water Ghost detected.
- Location: B-Wing Bathroom.
- Pattern: continuous pipe vibration for 37 minutes.
- Likely cause: stuck faucet or toilet.
- Confidence: 91%.
- Action: check sink 2 or toilet 3.

## AI Architecture From The Doc

Use narrow models instead of one giant model:

- Time-series anomaly model for freezer temperature drift, power spikes, HVAC ghost patterns, and water-flow anomalies.
- Audio/vibration classifier for pipe leaks, faucets, toilets, compressor vibration, and equipment hum.
- Vision classifier for tray waste, bin contamination, share table safety, plastic/recycling detection, and food categories.
- Small LLM or action agent that converts structured alerts into school-friendly language.
- Voice intent classifier that turns staff replies into incident status updates.

## Demo Story

1. Show baseline dashboard: all systems normal.
2. Trigger or simulate pipe leak: dashboard shows Water Ghost Detected in B-Wing Bathroom.
3. Trigger or simulate freezer issue: dashboard shows Cold Chain Anomaly and food spoilage risk.
4. Scan cafeteria waste: dashboard shows Food Waste Spike and possible share-table rescue.
5. Ask the voice agent what to fix first. It prioritizes the freezer first, then the bathroom leak.

## Best Name And Pitch

Preferred name: SchoolPulse.

Subtitle: Edge AI hardware for detecting a school's hidden water, energy, and food footprint.

Polished pitch: SchoolPulse is a modular edge AI sensor network that reveals hidden school-building waste. Low-cost Raspberry Pi and ESP32 nodes attach to pipes, freezers, rooms, bins, and cafeteria stations to detect silent waste. The dashboard turns anomalies into action cards for students, cafeteria workers, and facilities staff so schools know what to fix first.

