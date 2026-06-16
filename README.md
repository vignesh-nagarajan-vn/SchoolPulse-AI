<div align="center">

# Aqualert-AI

**An acoustic edge AI tool that reduces a school's water consumption by detecting signs of water leakage before they occur.**

</div>

---

## Problem

Schools quietly lose massive amounts of water (and subsequently money) due to leakages in restrooms, toilets, sinks, showers, etc. Nobody notices the leaks because the pipes are hidden behind school walls, and the school only finds out after either the pipe completely bursts or when they receive an expensive water bill at the month.

## Solution

An acoustic edge AI device attached to the toilet, sink, shower and main bathroom supply pipes, so that it can detect leakages based on how the flow of water sounds. When the AI detects a leak it sends an alert to the school, informing them of the potential leak. The school can then send a custodian to look and see if the leak is legit and immediately hire a plumber to come fix it before the leak causes a massive problem.

### Software

A binary classifier that can take an audio stream as input and determine if it's a normal water pipe or a leaking water pipe.

### Hardware

Raspberry Pi 0 to run model inference + sound sensor module to take in audio input from the pipes + water level sensor to assess the severity of the leak.

## Hackathon Context

This repo is the Aqualert AI / LeakListener water module for the broader SchoolPulse concept in USAII Global AI Hackathon 2026, High School Challenge 2, Direction B: My School's Hidden Footprint.

See [`context/README.md`](context/README.md) for the project brief, Google Doc synthesis, email summary, and challenge notes.
