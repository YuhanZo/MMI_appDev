"""Runs the same fit analysis prompt through Aivana and a baseline model.

Each side gets exactly one attempt -- unlike the app's fit analysis, there is no
retry on a wrong format -- so speed, cost and format reflect a single call.
"""

import time
from collections.abc import Callable
from typing import Literal

from pydantic import ValidationError

from app import aivana, baseline, mock_data
from app.config import settings
from app.fit_analysis import build_prompt
from app.schemas import FitAnalysisRequest, FitAnalysisResult, ModelRun

System = Literal["aivana", "baseline"]
CostUnit = Literal["credits", "usd"]


def _answer(data: object) -> FitAnalysisResult | None:
    try:
        return FitAnalysisResult.model_validate(data)
    except ValidationError:
        return None


def _timed(run: Callable[[], ModelRun]) -> ModelRun:
    start = time.perf_counter()
    result = run()
    result.latency_ms = round((time.perf_counter() - start) * 1000)
    return result


def run_aivana(req: FitAnalysisRequest) -> ModelRun:
    if settings.aivana_mode == "mock":
        return _mock("aivana", "aivana-mmi", "credits")

    def call() -> ModelRun:
        try:
            res = aivana.generate(build_prompt(req), output_shape="extract")
        except aivana.AivanaError as e:
            return _failed("aivana", "aivana-mmi", "credits", str(e), e.request_id)
        answer = _answer(res.get("structured"))
        usage = res.get("usage") or {}
        return ModelRun(
            system="aivana",
            model=", ".join(res.get("models_used") or ["aivana-mmi"]),
            mock=False,
            answer=answer,
            format_ok=answer is not None,
            latency_ms=0,
            cost=usage.get("credits"),
            cost_unit="credits",
            input_tokens=usage.get("input_tokens"),
            output_tokens=usage.get("output_tokens"),
            request_id=res.get("request_id"),
        )

    return _timed(call)


def run_baseline(req: FitAnalysisRequest) -> ModelRun:
    if settings.baseline_mode == "mock":
        return _mock("baseline", settings.baseline_model, "usd")

    def call() -> ModelRun:
        try:
            res = baseline.chat(build_prompt(req))
        except baseline.BaselineError as e:
            return _failed("baseline", settings.baseline_model, "usd", str(e))
        answer = _answer(baseline.json_from_text(res["text"]))
        return ModelRun(
            system="baseline",
            model=settings.baseline_model,
            mock=False,
            answer=answer,
            format_ok=answer is not None,
            latency_ms=0,
            cost=baseline.cost_usd(res["input_tokens"], res["output_tokens"]),
            cost_unit="usd",
            input_tokens=res["input_tokens"],
            output_tokens=res["output_tokens"],
        )

    return _timed(call)


def _mock(system: System, model: str, cost_unit: CostUnit) -> ModelRun:
    return ModelRun(
        system=system,
        model=model,
        mock=True,
        answer=mock_data.FIT_ANALYSIS,
        format_ok=True,
        latency_ms=0,
        cost=None,
        cost_unit=cost_unit,
        input_tokens=None,
        output_tokens=None,
    )


def _failed(
    system: System, model: str, cost_unit: CostUnit, error: str, request_id: str | None = None
) -> ModelRun:
    return ModelRun(
        system=system,
        model=model,
        mock=False,
        answer=None,
        format_ok=False,
        latency_ms=0,
        cost=None,
        cost_unit=cost_unit,
        input_tokens=None,
        output_tokens=None,
        error=error,
        request_id=request_id,
    )
