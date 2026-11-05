"""Prevent accidental loss of applied migrations from the public repository."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "supabase" / "migrations"
EXPECTED = {
    "001_iet_grid.sql",
    "002_security_hardening.sql",
    "003_canonical_occupancy_and_academics.sql",
    "004_transactional_booking_engine.sql",
    "005_administration_and_timetables.sql",
    "006_imports_and_in_app_receipts.sql",
    "007_fix_allocation_trigger_dispatch.sql",
    "008_scoped_reads_and_notice_publication.sql",
    "009_exam_approval_notices.sql",
    "010_confirmed_identity_provisioning.sql",
    "011_room_eligibility_and_scoped_audit.sql",
    "012_persist_equipment_booking_requirements.sql",
}


def test_applied_migrations_all_exist():
    actual = {f.name for f in ROOT.glob("*.sql")}
    assert EXPECTED.issubset(actual), f"Missing schema migrations: {sorted(EXPECTED - actual)}"


def test_migrations_are_substantive():
    for file in EXPECTED:
        content = (ROOT / file).read_text(encoding="utf-8")
        assert len(content) > 150, f"Empty or corrupted SQL migration: {file}"


def test_room_allocation_and_security_triggers_are_versioned():
    assert "room_allocations" in (ROOT / "003_canonical_occupancy_and_academics.sql").read_text()
    assert "request_room_booking" in (ROOT / "004_transactional_booking_engine.sql").read_text()
    assert "sync_iet_grid_people" in (ROOT / "007_fix_allocation_trigger_dispatch.sql").read_text()
