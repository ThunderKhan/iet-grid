/**
 * Which visible, confirmed campus allocations are running at this instant?
 *
 * The booking time filter and "running now" deliberately use separate clocks:
 * a user may browse tomorrow's availability while a class is happening today.
 * Calendar responses already apply backend RLS and redact unreadable titles.
 */
export function getActiveRoomSessions(events = [], nowMs = Date.now()) {
  const result = {};
  for (const item of events) {
    if (!item?.room_id || !item.starts_at || !item.ends_at) continue;
    // Maintenance and institutional room blocks are occupancy, not classes.
    if (item.kind === 'block') continue;
    if (item.status && item.status !== 'confirmed' && item.status !== 'scheduled') continue;
    const from = Date.parse(item.starts_at);
    const until = Date.parse(item.ends_at);
    if (!Number.isFinite(from) || !Number.isFinite(until) || from > nowMs || nowMs >= until) continue;
    const titleVisible = item.details_visible !== false
      && !!String(item.title || '').trim() && item.title !== 'Occupied';
    const active = {
      roomId: item.room_id,
      title: titleVisible ? String(item.title).trim() : 'Occupied — class details unavailable',
      detailsVisible: titleVisible,
      start: item.starts_at,
      end: item.ends_at,
      kind: item.kind || 'session',
    };
    // A room should never have two simultaneous allocations, but when upstream
    // data is inconsistent preserve the earlier event rather than duplicating.
    if (!result[item.room_id] || Date.parse(result[item.room_id].start) > from)
      result[item.room_id] = active;
  }
  return result;
}

export const sessionTimeIST = iso => new Date(iso).toLocaleTimeString('en-IN', {
  hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
});
