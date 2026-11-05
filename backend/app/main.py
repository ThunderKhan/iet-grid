"""IET Grid backend application, API version 1."""
from contextlib import asynccontextmanager
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.core.gateway import BackendError
from app.modules import campus, bookings, academics, notices, administration


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with httpx.AsyncClient(timeout=httpx.Timeout(12.0), follow_redirects=False) as client:
        app.state.http = client
        yield


app = FastAPI(
    title="IET Grid API",
    description="Authoritative room booking, timetable and campus APIs.",
    version="1.0.0",
    docs_url="/api/docs", redoc_url=None,
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(get_settings().cors_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


@app.exception_handler(BackendError)
async def backend_error_handler(request: Request, exc: BackendError):
    return JSONResponse(status_code=exc.http_status, content={
        "error": {"code": exc.code, "message": exc.message}
    })


@app.get("/health", tags=["system"])
async def health():
    settings = get_settings()
    return {
        "service": "iet-grid-api",
        "status": "ready" if settings.configured else "unconfigured",
        "supabase_configured": settings.configured,
        "version": app.version,
    }


app.include_router(campus.router, prefix="/api/v1", tags=["campus"])
app.include_router(bookings.router, prefix="/api/v1", tags=["bookings"])
app.include_router(academics.router, prefix="/api/v1", tags=["academics"])
app.include_router(notices.router, prefix="/api/v1", tags=["announcements"])
app.include_router(administration.router, prefix="/api/v1", tags=["administration"])
