"""Role-scoped booking audit history; PostgreSQL RPC owns authorization."""
from fastapi import APIRouter, Depends, Query, Request
from app.core.auth import Principal, require_coordinator
from app.core.gateway import Gateway

router = APIRouter()


@router.get("/admin/audit")
async def booking_audit_history(
    request: Request,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0, le=10000),
    room_id: str | None = Query(None, max_length=30),
    action: str | None = Query(None, pattern="^(created|status)$"),
    me: Principal = Depends(require_coordinator),
):
    """Coordinator sees only delegated buildings; verified admin sees all."""
    db = Gateway(request, me.token)
    rows = await db.rpc("list_booking_audit_history", {
        "p_limit": limit,
        "p_offset": offset,
        "p_room_id": room_id or None,
        "p_action": action or None,
    })
    if not isinstance(rows, list):
        return {"events": [], "limit": limit, "offset": offset, "total": 0,
                "has_more": False}
    total = int(rows[0]["total_rows"]) if rows else 0
    events = [{k: v for k, v in record.items() if k != "total_rows"} for record in rows]
    return {"events": events, "limit": limit, "offset": offset, "total": total,
            "has_more": offset + len(events) < total}
