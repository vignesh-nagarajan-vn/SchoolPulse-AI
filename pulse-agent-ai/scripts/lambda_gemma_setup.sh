#!/usr/bin/env bash
set -euo pipefail

# Run this on a Lambda GPU instance, not on the local laptop.
# You may need to accept the Gemma model license on Hugging Face first.

python3 -m venv .venv-gemma
source .venv-gemma/bin/activate
pip install --upgrade pip
pip install -r requirements-gpu.txt

# Optional if the model requires authentication:
# huggingface-cli login

vllm serve google/gemma-4-12B-it \
  --host 0.0.0.0 \
  --port 8000 \
  --dtype bfloat16 \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.9 \
  --trust-remote-code

