"""Sends the same prompt, unchanged, to Aivana and a baseline model.

Each side gets one call, so speed and cost describe exactly what the user waited for
and what it cost. A failed call is returned with its error, not raised, so one side
failing doesn't hide the other's reply.
"""

import time
from collections.abc import Callable
from typing import Literal

from app import aivana, baseline
from app.config import settings
from app.schemas import ModelReply

System = Literal["aivana", "baseline"]
CostUnit = Literal["credits", "usd"]


def _timed(call: Callable[[], ModelReply]) -> ModelReply:
    start = time.perf_counter()
    reply = call()
    reply.latency_ms = round((time.perf_counter() - start) * 1000)
    return reply


def ask_aivana(prompt: str) -> ModelReply:
    if settings.aivana_mode == "mock":
        return _mock("aivana", "aivana-mmi", "credits", prompt)

    def call() -> ModelReply:
        try:
            res = aivana.generate(prompt)
        except aivana.AivanaError as e:
            return _failed("aivana", "aivana-mmi", "credits", str(e), e.request_id)
        usage = res.get("usage") or {}
        answer = res.get("answer")
        return ModelReply(
            system="aivana",
            model=", ".join(res.get("models_used") or ["aivana-mmi"]),
            mock=False,
            text=answer if isinstance(answer, str) else None,
            latency_ms=0,
            cost=usage.get("credits"),
            cost_unit="credits",
            input_tokens=usage.get("input_tokens"),
            output_tokens=usage.get("output_tokens"),
            error=None if isinstance(answer, str) else "Aivana's reply had no answer text",
            request_id=res.get("request_id"),
        )

    return _timed(call)


def ask_baseline(prompt: str) -> ModelReply:
    if settings.baseline_mode == "mock":
        return _mock("baseline", settings.baseline_model, "usd", prompt)

    def call() -> ModelReply:
        try:
            res = baseline.chat(prompt)
        except baseline.BaselineError as e:
            return _failed("baseline", settings.baseline_model, "usd", str(e))
        return ModelReply(
            system="baseline",
            model=settings.baseline_model,
            mock=False,
            text=res["text"],
            latency_ms=0,
            cost=baseline.cost_usd(res["input_tokens"], res["output_tokens"]),
            cost_unit="usd",
            input_tokens=res["input_tokens"],
            output_tokens=res["output_tokens"],
        )

    return _timed(call)


def _mock(system: System, model: str, cost_unit: CostUnit, prompt: str) -> ModelReply:
    return ModelReply(
        system=system,
        model=model,
        mock=True,
        text=f"(Mock reply) You asked: {prompt[:200]}",  # the same on both sides, so it can't reveal the model
        latency_ms=0,
        cost=None,
        cost_unit=cost_unit,
        input_tokens=None,
        output_tokens=None,
    )


def _failed(
    system: System, model: str, cost_unit: CostUnit, error: str, request_id: str | None = None
) -> ModelReply:
    return ModelReply(
        system=system,
        model=model,
        mock=False,
        text=None,
        latency_ms=0,
        cost=None,
        cost_unit=cost_unit,
        input_tokens=None,
        output_tokens=None,
        error=error,
        request_id=request_id,
    )
