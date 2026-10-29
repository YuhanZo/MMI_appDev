import asyncio

from fastapi import APIRouter, HTTPException

from app.benchmark import run_aivana, run_baseline
from app.schemas import BenchmarkResult, FitAnalysisRequest

router = APIRouter(prefix="/api/benchmark", tags=["benchmark"])

# Aivana caps requests per minute and at once, so only one benchmark runs at a time.
_running = asyncio.Lock()


@router.post("/run", response_model=BenchmarkResult)
async def run(req: FitAnalysisRequest) -> BenchmarkResult:
    """The same fit analysis prompt through Aivana and the baseline model, in parallel."""
    if _running.locked():
        raise HTTPException(
            status_code=429,
            detail={"message": "A benchmark is already running. Wait for it to finish.", "code": "benchmark_busy"},
        )
    async with _running:
        runs = await asyncio.gather(asyncio.to_thread(run_aivana, req), asyncio.to_thread(run_baseline, req))
    return BenchmarkResult(runs=list(runs))
