from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app import models  # noqa: F401  -- registers tables on Base
from app.config import settings
from app.db import Base, engine
from app.routers import interview, jobs


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Fine for the prototype; switch to Alembic migrations once the schema settles.
    Base.metadata.create_all(bind=app.state.engine)
    yield


app = FastAPI(title="Career Decision Assistant API", version="0.1.0", lifespan=lifespan)
# The one place the app gets its database from; tests replace it with a throwaway engine.
app.state.engine = engine

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router)
app.include_router(interview.router)


@app.get("/api/health")
def health(request: Request, response: Response) -> dict[str, str]:
    """Runs a real query, so "ok" means backend *and* database are reachable."""
    engine = request.app.state.engine
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except SQLAlchemyError:
        response.status_code = 503
        return {"status": "error", "database": engine.dialect.name}
    return {"status": "ok", "database": engine.dialect.name}
