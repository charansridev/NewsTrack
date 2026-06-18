from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import (
    addresses,
    auth,
    deliveries,
    drivers,
    organizations,
    products,
    universal_ids,
    users,
    vehicles,
)
from app.core.errors import (
    APIError,
    api_error_handler,
    http_exception_handler,
    validation_error_handler,
)

app = FastAPI(
    title="NewsTrack API",
    version="1.0.0",
    description="Newspaper Distribution Tracking System backend.",
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


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
