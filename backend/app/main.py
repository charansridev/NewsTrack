from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import (
    addresses,
    analytics,
    auth,
    deliveries,
    drivers,
    issues,
    notifications,
    organizations,
    products,
    realtime,
    universal_ids,
    users,
    vehicles,
)
from app.config import settings
from app.core.errors import (
    APIError,
    api_error_handler,
    http_exception_handler,
    validation_error_handler,
)
from app.realtime.hub import hub
from app.services.jobs import scheduler_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Capture the running loop so sync handlers can publish to WebSockets.
    hub.capture_loop()
    task = None
    if settings.enable_background_jobs:
        import asyncio
        task = asyncio.create_task(scheduler_loop())
    try:
        yield
    finally:
        if task is not None:
            task.cancel()


app = FastAPI(
    title="NewsTrack API",
    version="1.0.0",
    description="Newspaper Distribution Tracking System backend.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(APIError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)

# All routes are served under /v1.
V1 = "/v1"
app.include_router(auth.router, prefix=V1)
app.include_router(universal_ids.router, prefix=V1)
app.include_router(users.router, prefix=V1)
app.include_router(organizations.router, prefix=V1)
app.include_router(addresses.router, prefix=V1)
app.include_router(products.router, prefix=V1)
app.include_router(deliveries.router, prefix=V1)
app.include_router(drivers.router, prefix=V1)
app.include_router(vehicles.router, prefix=V1)
app.include_router(issues.router, prefix=V1)
app.include_router(notifications.router, prefix=V1)
app.include_router(analytics.router, prefix=V1)
app.include_router(realtime.router, prefix=V1)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
