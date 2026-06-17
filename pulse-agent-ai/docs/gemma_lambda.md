# Gemma 4 On Lambda

Pulse Agent AI is designed to work in two modes:

1. CPU fallback mode for local development.
2. Gemma 4 mode when a GPU server is available.

## Recommended First Model

Use `google/gemma-4-12B-it` first.

Why:

- Stronger than tiny edge models.
- Still realistic on a rented GPU.
- Good fit for agentic reasoning, summaries, and action-card explanations.
- Keeps the prediction models separate, which makes evaluation easier.

If the GPU is very strong, test a larger Gemma 4 model later. Do not start there; get the pipeline working first.

## Lambda Server Shape

On the Lambda GPU box:

```bash
cd pulse-agent-ai
python3 -m venv .venv-gemma
source .venv-gemma/bin/activate
pip install --upgrade pip
pip install -r requirements-gpu.txt
huggingface-cli login

vllm serve google/gemma-4-12B-it \
  --host 0.0.0.0 \
  --port 8000 \
  --dtype bfloat16 \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.9 \
  --trust-remote-code
```

On the backend machine:

```bash
export LLM_BASE_URL="http://YOUR_LAMBDA_IP:8000/v1"
export LLM_MODEL="google/gemma-4-12B-it"
export LLM_API_KEY="EMPTY"
uvicorn app.main:app --reload --port 8010
```

## What Gemma Does

Gemma should:

- Summarize retrieved school context.
- Explain energy, water, waste, and event recommendations.
- Turn model outputs into clear action cards.
- Answer staff questions through the voice/chat interface.

Gemma should not:

- Directly control HVAC, plumbing, routes, or purchases.
- Replace the energy anomaly model.
- Invent numbers that are not in retrieved context or backend analytics.

## Evaluation Plan

Run the same questions against:

- CPU fallback.
- Gemma 4 12B.
- Larger Gemma option if Lambda has enough VRAM.

Compare:

- Does it cite the right project context?
- Does it preserve the human-in-the-loop step?
- Does it avoid making up exact savings?
- Does it rank the same top issues as the backend analytics?
- Is the answer short enough for a school staff member?

Useful references:

- Google Gemma 4 overview: https://ai.google.dev/gemma/docs/core
- Gemma 4 model card: https://ai.google.dev/gemma/docs/core/model_card_4
- Hugging Face model page: https://huggingface.co/google/gemma-4-12B

