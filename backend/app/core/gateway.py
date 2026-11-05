"""PostgREST gateway: every request carries the user's Supabase JWT.

No service-role key; PostgreSQL RLS and guarded RPC functions remain authoritative.
"""
from dataclasses import dataclass
from typing import Any
import httpx
from fastapi import Request, HTTPException
from app.core.config import get_settings


@dataclass
class BackendError(Exception):
    http_status: int
    code: str
    message: str


def _convert_error(status: int, body: Any) -> BackendError:
    data = body if isinstance(body, dict) else {}
    code = str(data.get("code", status))
    message = str(data.get("message", "Backend request failed"))[:240]
    if code in {"23P01", "23505"} or "CONFLICT:" in message:
        return BackendError(409, code, message)
    if code in {"42501", "PGRST301"} or "FORBIDDEN:" in message:
        return BackendError(403, code, message)
    if code in {"28000"} or "AUTH_REQUIRED:" in message:
        return BackendError(401, code, message)
    if code in {"22023", "23514", "23503", "23502"}:
        return BackendError(422, code, message)
    if status in {400, 401, 403, 404, 409, 422}:
        return BackendError(status, code, message)
    return BackendError(502, "UPSTREAM_ERROR", "Database service unavailable or failed")


class Gateway:
    def __init__(self, request: Request, token: str):
        self.request = request
        self.token = token

    @property
    def headers(self) -> dict[str, str]:
        key = get_settings().publishable_key
        return {
            "apikey": key,
            "Authorization": "Bearer " + self.token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def call(self, method: str, path: str, *,
                   params: dict | None = None, json: Any = None) -> Any:
        settings = get_settings()
        if not settings.configured:
            raise BackendError(503, "BACKEND_NOT_CONFIGURED", "Supabase configuration is missing")
        url = settings.supabase_url + "/rest/v1/" + path.lstrip("/")
        try:
            r: httpx.Response = await self.request.app.state.http.request(
                method, url, headers=self.headers, params=params, json=json
            )
        except (httpx.TimeoutException, httpx.TransportError):
            raise BackendError(503, "DATABASE_UNREACHABLE", "Database is temporarily unavailable")
        try:
            body = r.json() if r.content else None
        except ValueError:
            body = None
        if r.status_code >= 400:
            raise _convert_error(r.status_code, body)
        return body

    async def select(self, table: str, params: dict | None = None) -> list[dict]:
        result = await self.call("GET", table, params=params or {})
        if not isinstance(result, list):
            raise BackendError(502, "BAD_UPSTREAM_DATA", "Unexpected database response")
        return result

    async def rpc(self, name: str, payload: dict) -> Any:
        return await self.call("POST", "rpc/" + name, json=payload)


def gateway(request: Request, token: str) -> Gateway:
    return Gateway(request, token)
