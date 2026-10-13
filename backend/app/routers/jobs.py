from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import job_api, mock_data
from app.config import settings
from app.db import get_db
from app.models import SearchLog
from app.schemas import FitAnalysisRequest, FitAnalysisResult, Job, JobSearchRequest

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.post("/search", response_model=list[Job])
async def search_jobs(req: JobSearchRequest, db: Session = Depends(get_db)) -> list[Job]:
    """Searches real job listings through the JSearch API, with the user's filters."""
    try:
        raw = await job_api.search_jobs(req, settings.jsearch_api_key)
    except job_api.JobApiError as e:
        raise HTTPException(status_code=502, detail=str(e))
    results = [Job(**job) for job in raw]

    db.add(
        SearchLog(
            role=req.role,
            location=req.location,
            # The table predates the new filters; it still records whether the search was remote.
            remote=req.work_arrangement == "remote",
            result_count=len(results),
        )
    )
    db.commit()
    return results


@router.post("/fit-analysis", response_model=FitAnalysisResult)
def fit_analysis(req: FitAnalysisRequest) -> FitAnalysisResult:
    """Mocked fit analysis. This is where the Aivana MMI call goes."""
    return mock_data.FIT_ANALYSIS