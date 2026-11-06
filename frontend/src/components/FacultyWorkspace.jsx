import React from 'react';
import {BookOpen,CalendarDays,DoorOpen,GraduationCap,ShieldCheck} from 'lucide-react';
import {BookingsPage} from './WorkspacePages';
import './FacultyWorkspace.css';

/** The same backend RPCs and booking form used by university staff are reused.
 * This is a role-scoped teaching workspace, not a second insecure booking path.
 */
export default function FacultyWorkspace({
  bookings=[],rooms=[],userId,setView,onOpenRoom,bookingBusy='',
  onCancelBooking,onRescheduleBooking
}){
  const ownBookings=bookings.filter(b=>b.created_by===userId);
  const now=Date.now();
  const upcoming=ownBookings.filter(b=>b.status==='confirmed'&&Date.parse(b.ends_at)>now);
  const pending=ownBookings.filter(b=>b.status==='pending');
  const uniqueRooms=new Set(ownBookings.filter(b=>b.status==='confirmed').map(b=>b.room_id)).size;
  return <div className="faculty-workspace ig-page-stack">
    <section className="faculty-hero">
      <div className="faculty-hero-copy">
        <span className="faculty-eyebrow"><GraduationCap size={16}/> FACULTY WORKSPACE</span>
        <h1>Plan and manage your classes</h1>
        <p>Select a classroom, check live room availability, schedule a lecture or practical, and track requests awaiting approval.</p>
        <div className="faculty-hero-actions">
          <button type="button" className="ig-btn ig-btn-primary" onClick={()=>setView('Explore rooms')}>
            <DoorOpen size={17}/> Select a classroom
          </button>
          <button type="button" className="ig-btn ig-btn-outline" onClick={()=>setView('Calendar')}>
            <CalendarDays size={17}/> Campus timetable
          </button>
        </div>
      </div>
      <div className="faculty-hero-mark" aria-hidden="true"><BookOpen size={42}/></div>
    </section>
    <section className="faculty-stats" aria-label="Your teaching schedule">
      <div><span>Upcoming confirmed classes</span><strong>{upcoming.length}</strong></div>
      <div><span>Requests pending approval</span><strong>{pending.length}</strong></div>
      <div><span>Rooms in confirmed bookings</span><strong>{uniqueRooms}</strong></div>
    </section>
    <div className="faculty-permission-note"><ShieldCheck size={18}/>
      <p>Faculty can request and manage their own reservations. Examination and event requests require administrator review. Campus administration and identity provisioning are not available to faculty.</p>
    </div>
    <BookingsPage bookings={ownBookings} rooms={rooms} setView={setView} onOpenRoom={onOpenRoom}
      userId={userId} bookingBusy={bookingBusy}
      onCancelBooking={onCancelBooking} onRescheduleBooking={onRescheduleBooking}/>
  </div>;
}
