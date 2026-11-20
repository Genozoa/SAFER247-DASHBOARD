from contextlib import asynccontextmanager
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import load_environment
from app.auth.api import router as auth_router
from app.operations.api import router as operations_router
from app.radio_lab.api import router as radio_router
from app.maps.api import router as maps_router
from app.radio_lab.settings import RadioSettings
from app.radio_lab.worker_supervisor import RadioWorkerSupervisor

load_environment()


@asynccontextmanager
async def lifespan(app: FastAPI):
    supervisor = None
    try:
        settings = RadioSettings.from_env()
        supervisor = RadioWorkerSupervisor(settings, Path(__file__).resolve().parents[1])
        app.state.radio_worker_supervisor = supervisor
        supervisor.start()
    except (ValueError, TypeError) as error:
        app.state.radio_worker_supervisor = None
        app.state.radio_worker_configuration_error = str(error)
    try:
        yield
    finally:
        if supervisor is not None:
            supervisor.stop()


def create_app() -> FastAPI:
    app = FastAPI(title="SAFER 247 API", lifespan=lifespan)
    allowed_origins = [
        origin.strip()
        for origin in os.environ.get(
            "APP_ALLOWED_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if origin.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["Content-Type"],
    )
    app.include_router(auth_router)
    app.include_router(operations_router)
    app.include_router(maps_router)
    app.include_router(radio_router)
    return app


app = create_app()
