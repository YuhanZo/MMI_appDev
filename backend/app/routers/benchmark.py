import asyncio

from fastapi import APIRouter, HTTPException

from app.benchmark import ask_aivana, ask_baseline
from app.schemas import BenchmarkRequest, BenchmarkResult

router = APIRouter(prefix="/api/benchmark", tags=["benchmark"])

# Aivana caps requests per minute and at once, so only one comparison runs at a time.
_running = asyncio.Lock()


@router.post("/chat", response_model=BenchmarkResult)
async def chat(req: BenchmarkRequest) -> BenchmarkResult:
    """The user's prompt, unchanged, to Aivana and the baseline model in parallel."""
    if _running.locked():
        raise HTTPException(
            status_code=429,
            detail={"message": "A comparison is already running. Wait for it to finish.", "code": "benchmark_busy"},
        )
    async with _running:
        replies = await asyncio.gather(
            asyncio.to_thread(ask_aivana, req.prompt), asyncio.to_thread(ask_baseline, req.prompt)
        )
    return BenchmarkResult(replies=list(replies))
