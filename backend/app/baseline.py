"""Client for the general model the Benchmark tab compares Aivana with.

Uses the OpenAI-compatible chat API, which Gemini, OpenAI, Groq and OpenRouter all
offer, so switching providers is only a change in backend/.env. One attempt, no
retries: the benchmark measures what a single call gives.
"""

from typing import Any

import httpx

from app.config import settings

TIMEOUT_S = 90.0

# Tests replace this so no real request is sent.
_transport: httpx.BaseTransport | None = None


class BaselineError(Exception):
    """The baseline model couldn't be reached or returned an error."""


def chat(prompt: str) -> dict[str, Any]:
    """Send one user message; returns {"text", "input_tokens", "output_tokens"}."""
    try:
        with httpx.Client(
            base_url=settings.baseline_base_url,
            headers={"Authorization": f"Bearer {settings.baseline_api_key}"},
            transport=_transport,
        ) as client:
            res = client.post(
                "/chat/completions",
                json={"model": settings.baseline_model, "messages": [{"role": "user", "content": prompt}]},
                timeout=TIMEOUT_S,
            )
    except httpx.HTTPError as e:
        raise BaselineError(f"Could not reach the baseline model ({type(e).__name__})") from e

    if res.status_code != 200:
        raise BaselineError(f"Baseline model returned {res.status_code}: {_error_message(res)}")
    try:
        body = res.json()
        text = body["choices"][0]["message"]["content"] or ""
    except (ValueError, KeyError, IndexError, TypeError) as e:
        raise BaselineError("Baseline model returned an unexpected response") from e

    usage = body.get("usage") or {}
    return {
        "text": text,
        "input_tokens": usage.get("prompt_tokens"),
        "output_tokens": usage.get("completion_tokens"),
    }


def _error_message(res: httpx.Response) -> str:
    """The provider's own message: OpenAI-style {"error": {"message"}}, or Gemini's
    list of those; otherwise the start of the body."""
    try:
        body = res.json()
    except ValueError:
        return res.text[:200]
    if isinstance(body, list) and body:
        body = body[0]
    error = body.get("error") if isinstance(body, dict) else None
    message = error.get("message") if isinstance(error, dict) else None
    return message if isinstance(message, str) else res.text[:200]


def cost_usd(input_tokens: int | None, output_tokens: int | None) -> float | None:
    """Token counts times the prices in backend/.env; None if either is missing."""
    price_in, price_out = settings.baseline_price_in_per_m, settings.baseline_price_out_per_m
    if None in (input_tokens, output_tokens, price_in, price_out):
        return None
    return (input_tokens * price_in + output_tokens * price_out) / 1_000_000
