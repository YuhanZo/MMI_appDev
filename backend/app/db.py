from collections.abc import Generator

from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session

from app.config import settings

# check_same_thread is a SQLite-only argument.
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args)


class Base(DeclarativeBase):
    pass


def get_db(request: Request) -> Generator[Session, None, None]:
    # Uses the engine on app.state (not the module global) so tests can swap in their own.
    db = Session(bind=request.app.state.engine, autoflush=False, expire_on_commit=False)
    try:
        yield db
    finally:
        db.close()
