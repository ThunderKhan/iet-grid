"""Critical availability safety regression: never trust truncated PostgREST results."""
from datetime import datetime, timezone
import pytest
from fastapi import HTTPException
from app.modules.campus import get_allocations

S = datetime(2026, 11, 7, 9, tzinfo=timezone.utc)
E = datetime(2026, 11, 7, 10, tzinfo=timezone.utc)

def entry(i: int) -> dict:
    return {
        "id": str(i), "room_id": "IET" + str(i),
        "starts_at": S.isoformat(), "ends_at": E.isoformat(),
        "source_type": "booking", "source_id": str(i),
    }

class Pages:
    def __init__(self, pages):
        self.pages = pages
        self.calls = []

    async def select(self, table, params):
        assert table == "room_allocations"
        self.calls.append(params)
        return self.pages.get(int(params["offset"]), [])

@pytest.mark.asyncio
async def test_allocation_reads_second_page_without_false_free():
    db = Pages({0: [entry(i) for i in range(500)], 500: [entry(500)]})
    result = await get_allocations(db, S, E)
    assert len(result) == 501
    assert result[-1]["room_id"] == "IET500"
    assert [int(x["offset"]) for x in db.calls] == [0, 500]
    assert all(int(x["limit"]) == 500 for x in db.calls)

@pytest.mark.asyncio
async def test_small_allocation_result_uses_one_request():
    db = Pages({0: [entry(1)]})
    rows = await get_allocations(db, S, E)
    assert len(rows) == 1
    assert len(db.calls) == 1

class AlwaysFull:
    def __init__(self):
        self.calls = 0
    async def select(self, _table, params):
        self.calls += 1
        return [entry(i) for i in range(int(params["limit"]))]

@pytest.mark.asyncio
async def test_unbounded_occupancy_fails_closed():
    db = AlwaysFull()
    with pytest.raises(HTTPException) as exc:
        await get_allocations(db, S, E)
    assert exc.value.status_code == 503
    assert db.calls == 20
