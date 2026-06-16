# Repo Understanding

## Current Repo State

The repository currently contains:

- `README.md`: Aqualert AI problem, solution, software, and hardware summary.
- `Parentsquare Screenshot 1.png`: local evidence of school closure after a water main break.
- `Parentsquare Screenshot 2.png`: local evidence of low water pressure and operational disruption after a water main break.
- `LICENSE`.

## Role Of This Repo

This repo is best treated as the Aqualert AI / LeakListener water module of the broader SchoolPulse system.

The current README already matches the Google Doc's water-leak concept. The next likely development work is to add:

- Sample or synthetic audio clips.
- Audio feature extraction.
- Binary classifier or anomaly detector.
- Edge inference plan for Raspberry Pi Zero.
- Alert payload schema for the SchoolPulse dashboard.
- Demo flow using the ParentSquare screenshots as local problem proof.

## Useful MVP Shape

For the hackathon, a practical version could include:

- Recorded or synthetic normal-flow and leak-flow audio.
- A simple classifier or anomaly detector that outputs normal vs. leak.
- A severity estimate based on duration, confidence, and water-level/flow proxy data.
- A dashboard event such as `Water Ghost Detected`.
- A human verification step before any repair/work-order action.

