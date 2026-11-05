"""Delegated authentication against Supabase Auth /auth/v1/user.

The Auth server validates the bearer token; we do NOT trust unverified JWT payloads
or caller-controlled user_metadata for roles. Verified roles live in profiles.
"""
from dataclasses import dataclass
from uuid import UUID
import httpx
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import get_settings
from app.core.gateway import Gateway, BackendError

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    user_id: UUID
    token: str
    role: str
    verified: bool
    full_name: str | None

    @property
    def staff(self) -> bool:
        return self.verified and self.role in ("faculty", "coordinator", "admin")

    @property
    def coordinator(self) -> bool:
        return self.verified and self.role in ("coordinator", "admin")

    @property
    def admin(self) -> bool:
        return self.verified and self.role == "admin"


async def require_user(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> Principal:
    settings = get_settings()
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(401, "Bearer token required")
    if not settings.configured:
        raise HTTPException(503, "Supabase backend not configured")
    token = credentials.credentials
    headers = {"apikey": settings.publishable_key, "Authorization": "Bearer " + token}
    try:
        response: httpx.Response = await request.app.state.http.get(
            settings.supabase_url + "/auth/v1/user", headers=headers,
        )
    except (httpx.TimeoutException, httpx.TransportError):
        raise HTTPException(503, "Authentication provider unavailable")
    if response.status_code != 200:
        raise HTTPException(401, "Invalid or expired session")
    try:
        user_id = UUID(response.json()["id"])
    except (ValueError, KeyError, TypeError):
        raise HTTPException(401, "Invalid user identity")
    gateway = Gateway(request, token)
    profiles = await gateway.select("profiles", {
        "select": "id,full_name,role,verified",
        "id": f"eq.{user_id}",
        "limit": "1",
    })
    if not profiles:
        raise HTTPException(403, "University profile not provisioned")
    profile = profiles[0]
    return Principal(
        user_id=user_id, token=token,
        role=str(profile["role"]), verified=bool(profile["verified"]),
        full_name=profile.get("full_name"),
    )


def require_staff(principal: Principal = Depends(require_user)) -> Principal:
    if not principal.staff:
        raise HTTPException(403, "Verified faculty/staff account required")
    return principal


def require_coordinator(principal: Principal = Depends(require_user)) -> Principal:
    if not principal.coordinator:
        raise HTTPException(403, "Verified coordinator/administrator required")
    return principal


def require_admin(principal: Principal = Depends(require_user)) -> Principal:
    if not principal.admin:
        raise HTTPException(403, "Verified university administrator required")
    return principal
