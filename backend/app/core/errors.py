"""Standard error envelope and a small ``APIError`` exception family.

Matches the API contract:
    { "error": { "code": "...", "message": "...", "details": [...] } }
"""

from fastapi import Request
from fastapi.responses import JSONResponse


class APIError(Exception):
    status_code = 500
    code = "INTERNAL_ERROR"

    def __init__(self, message: str, *, code: str | None = None,
                 status_code: int | None = None, details: list | None = None):
        self.message = message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code
        self.details = details or []
        super().__init__(message)


class BadRequest(APIError):
    status_code = 400
    code = "VALIDATION_ERROR"


class Unauthorized(APIError):
    status_code = 401
    code = "UNAUTHORIZED"


class Forbidden(APIError):
    status_code = 403
    code = "FORBIDDEN"


class NotFound(APIError):
    status_code = 404
    code = "NOT_FOUND"


class Conflict(APIError):
    status_code = 409
    code = "CONFLICT"


class ImmutableRecord(APIError):
    status_code = 409
    code = "IMMUTABLE_RECORD"


def error_body(code: str, message: str, details: list | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details or []}}


async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(exc.code, exc.message, exc.details),
    )


async def validation_error_handler(request: Request, exc) -> JSONResponse:
    details = []
    for err in getattr(exc, "errors", lambda: [])():
        loc = ".".join(str(p) for p in err.get("loc", []) if p != "body")
        details.append({"field": loc, "message": err.get("msg", "")})
    return JSONResponse(
        status_code=400,
        content=error_body("VALIDATION_ERROR", "Request body failed validation.", details),
    )


async def http_exception_handler(request: Request, exc) -> JSONResponse:
    # Map FastAPI/Starlette HTTPException to the contract envelope.
    code_map = {
        400: "VALIDATION_ERROR",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        429: "RATE_LIMITED",
    }
    status = getattr(exc, "status_code", 500)
    code = code_map.get(status, "INTERNAL_ERROR")
    detail = getattr(exc, "detail", "Error")
    message = detail if isinstance(detail, str) else "Error"
    return JSONResponse(status_code=status, content=error_body(code, message))
