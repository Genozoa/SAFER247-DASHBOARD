import os
from contextlib import contextmanager
from functools import lru_cache
from typing import Generator, Iterator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker


def get_database_url() -> str:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Configure it with the PostgreSQL connection "
            "string before creating a database engine."
        )
    return database_url


def create_db_engine(database_url: str | None = None, **engine_options: object) -> Engine:
    engine_options.setdefault("pool_pre_ping", True)
    return create_engine(database_url or get_database_url(), **engine_options)


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    return create_db_engine()


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@contextmanager
def session_scope(
    factory: sessionmaker[Session] | None = None,
) -> Generator[Session, None, None]:
    session = (factory or create_session_factory(get_engine()))()
    try:
        with session.begin():
            yield session
    finally:
        session.close()


def get_db_session() -> Iterator[Session]:
    session = create_session_factory(get_engine())()
    try:
        yield session
    finally:
        if session.in_transaction():
            session.rollback()
        session.close()
