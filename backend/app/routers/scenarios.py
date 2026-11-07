import asyncio

from fastapi import APIRouter, HTTPException

from app import scenarios
from app.routers.benchmark import _running as aivana_busy
from app.schemas import ModelReply, Scenario, ScenarioJudgement, ScenarioJudgeRequest

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


@router.get("", response_model=list[Scenario])
def list_scenarios() -> list[Scenario]:
    return scenarios.SCENARIOS


@router.post("/{scenario_id}/answer", response_model=ModelReply)
async def answer(scenario_id: str) -> ModelReply:
    """Aivana's answer to one scenario. The page asks for them one at a time; the lock
    is the Benchmark's, so the two never call Aivana at once (it caps concurrency)."""
    scenario = scenarios.BY_ID.get(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail={"message": f"No scenario {scenario_id!r}", "code": "not_found"})
    if aivana_busy.locked():
        raise HTTPException(
            status_code=429,
            detail={"message": "Aivana is busy with another request. Wait for it to finish.", "code": "aivana_busy"},
        )
    async with aivana_busy:
        return await asyncio.to_thread(scenarios.answer, scenario)


@router.post("/judge", response_model=ScenarioJudgement)
async def judge(req: ScenarioJudgeRequest) -> ScenarioJudgement:
    """One call to the judge model, grading all the answers sent."""
    ids = [a.scenario_id for a in req.answers]
    unknown = [i for i in ids if i not in scenarios.BY_ID]
    if unknown or len(set(ids)) != len(ids):
        raise HTTPException(
            status_code=422,
            detail={"message": f"Unknown or repeated scenarios: {unknown or ids}", "code": "bad_answers"},
        )
    try:
        return await asyncio.to_thread(scenarios.judge, req.answers)
    except scenarios.JudgeError as e:
        raise HTTPException(status_code=502, detail={"message": str(e), "code": e.code}) from e
