from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import mock_data
from app.db import get_db
from app.models import SearchLog
from app.schemas import FitAnalysisRequest, FitAnalysisResult, Job, JobSearchRequest

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.post("/search", response_model=list[Job])
def search_jobs(req: JobSearchRequest, db: Session = Depends(get_db)) -> list[Job]:
    """Mocked job search. Filters the placeholder list so the UI has something to react to."""
    needle = req.role.lower()
    results = [j for j in mock_data.JOBS if needle in j.title.lower()] or mock_data.JOBS

    db.add(
        SearchLog(
            role=req.role,
            location=req.location,
            remote=req.remote,
            result_count=len(results),
        )
    )
    db.commit()
    return results


@router.post("/fit-analysis", response_model=FitAnalysisResult)
def fit_analysis(req: FitAnalysisRequest) -> FitAnalysisResult:
    """Mocked fit analysis. This is where the Aivana MMI call goes."""
    return mock_data.FIT_ANALYSIS
