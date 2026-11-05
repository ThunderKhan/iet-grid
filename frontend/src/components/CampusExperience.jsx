import React, {useEffect, useRef, useState} from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Dialog from '@radix-ui/react-dialog';
import {ArrowRight, BookOpenText, CalendarDays, CheckCircle2, ChevronDown, Clock3, DoorOpen, Info, Layers3, Settings2, SlidersHorizontal, Users, X} from 'lucide-react';
import BlueprintSitePlan from './BlueprintSitePlan';
import {sessionTimeIST} from '../currentSessions';
import './CampusExperience.css';

const TIMES=Array.from({length:11},(_,i)=>8+i);
const monthDay=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const clock=h=>String(h).padStart(2,'0')+':00';
const statuses={available:'Available',occupied:'Occupied',restricted:'Not eligible',unknown:'Not verified',pending:'Approval pending'};
function Badge({value}){const s=statuses[value]?value:'unknown';return <span className={'cx-status cx-status-'+s}><span className="cx-status-dot"/>{statuses[s]}</span>}
/**
 * The availability API distinguishes conflict, eligibility and missing data.
 * Never paint an unrecognized or failed response as an occupied classroom.
 */
export function resolveRoomStatus(room,requiredSeats,apiAvailability){
  if(!room||!Array.isArray(apiAvailability))return 'unknown';
  const result=apiAvailability.find(entry=>entry.id===room.id);
  if(!result)return 'unknown';
  if(Number(room.capacity)<requiredSeats)return 'restricted';
  if(result.reason==='occupied')return 'occupied';
  if(result.reason==='ineligible')return 'restricted';
  if(result.reason==='available'&&result.available===true)return 'available';
  return 'unknown';
}
export default function CampusExperience({
  buildings,rooms,building,setBuilding,floor,setFloor,selected,setSelected,
  date,setDate,hour,setHour,duration,setDuration,capacity,setCapacity,
  bookingKind,setBookingKind,requiredEquipment,setRequiredEquipment,
  apiAvailability,apiWarning,isAvailable,matching,current,canBook,
  setShowBooking,setView,selectedCohortLabel,
  activeSessions={},nowScheduleState='loading',currentTimeMs=Date.now()
}) {
  const [mode,setMode]=useState('plan');
  const mapRef=useRef(null);
  const [sheetOpen,setSheetOpen]=useState(false);
  const [mobile,setMobile]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(max-width:720px)').matches);
  useEffect(()=>{
    const media=window.matchMedia('(max-width:720px)');
    const change=()=>setMobile(media.matches);change();
    media.addEventListener?.('change',change);
    return()=>media.removeEventListener?.('change',change);
  },[]);
  useEffect(()=>{if(!mobile)setSheetOpen(false)},[mobile]);
  const getStatus=room=>resolveRoomStatus(room,capacity,apiAvailability);
  const currentStatus=current?getStatus(current):'unknown';
  const bookable=!!current&&canBook&&currentStatus==='available';
  const runningInSelectedRoom=activeSessions[current?.id];
  const floorRoomIds=new Set(rooms.filter(r=>r.building===building&&r.floor===floor).map(r=>r.id));
  const floorSessions=Object.values(activeSessions).filter(s=>floorRoomIds.has(s.roomId))
    .sort((a,b)=>a.roomId.localeCompare(b.roomId,undefined,{numeric:true}));
  const revealMap=()=>{
    if(!mapRef.current)return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    mapRef.current.scrollIntoView({block:'start',behavior:reduced?'instant':'smooth'});
  };
  const selectRoom=room=>{
    setSelected(room.id);
    if(mobile)setSheetOpen(true);
  };
  const chooseBuilding=code=>{
    setBuilding(code);
    setFloor(buildings.find(b=>b.id===code)?.floors?.[0]||'Ground');
    setSelected('');setSheetOpen(false);
    revealMap();
  };
  const selectAlternative=room=>{
    setBuilding(room.building);setFloor(room.floor);
    setSelected(room.id);
    if(mobile)setSheetOpen(true);
    else revealMap();
  };
  const roomInfo=current?<div className="cx-room-info">
    <div className="cx-room-name"><div><span className="cx-overline">SELECTED CLASSROOM</span><h2>{current.id}</h2>
      <p>{current.floor} floor · {current.type}</p></div><Badge value={currentStatus}/></div>
    {runningInSelectedRoom&&<section className="cx-running-room" aria-label="Class currently running in selected room">
      <div className="cx-running-heading"><span className="cx-running-indicator"/> CLASS IN PROGRESS NOW</div>
      <strong>{runningInSelectedRoom.title}</strong>
      <small>{sessionTimeIST(runningInSelectedRoom.start)} – {sessionTimeIST(runningInSelectedRoom.end)} IST
        {!runningInSelectedRoom.detailsVisible?' · Details restricted':''}</small>
    </section>}
    {nowScheduleState==='unavailable'&&<p className="cx-assist">
      The current class schedule is unavailable; room activity cannot be confirmed.
    </p>}
    <div className="cx-room-details">
      <span><Users size={16}/> Capacity <b>{current.capacity}{current.verified?'':'*'} seats</b></span>
      <span><Layers3 size={16}/> Space <b className="cx-caps">{current.type}</b></span>
      <span><Clock3 size={16}/> Selected slot <b>{clock(hour)} · {duration}h</b></span>
    </div>
    <div className="cx-cta">
      <button type="button" className="cx-primary" disabled={!bookable}
        onClick={()=>{setSheetOpen(false);setShowBooking(true)}}>Book for a class <ArrowRight size={17}/></button>
      <button type="button" className="cx-subtle" onClick={()=>{setSheetOpen(false);setView('Calendar')}}>
        <CalendarDays size={15}/> View timetable</button>
    </div>
    {!canBook&&<p className="cx-assist">Only authorized faculty and campus operators can reserve classrooms.</p>}
    {canBook&&!bookable&&<p className="cx-assist">
      {currentStatus==='occupied'?'A confirmed allocation conflicts with this time. Try another slot or classroom.':
       currentStatus==='restricted'?'This space does not meet the selected session requirements. Adjust the session type or minimum seats below.':
       'Availability could not be verified for this slot. Try refreshing the campus data.'}
    </p>}
    {!current.verified&&<p className="cx-assist">* Capacity is provisional until verified by the institute.</p>}
  </div>:<div className="cx-no-room"><DoorOpen size={27}/><h3>Choose a classroom</h3>
    <p>Select a room from the floor map to see its status and reserve it for your class.</p></div>;
  const floorOptions=buildings.find(b=>b.id===building)?.floors||[];
  const goToFloor=offset=>{
    const index=floorOptions.indexOf(floor);
    const nextFloor=index>=0?floorOptions[index+offset]:null;
    if(!nextFloor)return;
    setFloor(nextFloor);
    setSelected('');
    setSheetOpen(false);
  };
  return <div className="cx-page">
    {apiWarning&&<div className="cx-warning" role="alert"><Info size={17}/>{apiWarning}</div>}
    <section className="cx-map-hero" ref={mapRef} aria-label="Campus floor explorer">
      <BlueprintSitePlan rooms={rooms} building={building} floor={floor} selected={selected}
        onSelect={selectRoom} getStatus={getStatus} mode={mode}
        floorOptions={floorOptions} onNavigateFloor={goToFloor} onModeChange={setMode}
        buildings={buildings} onBuildingChange={chooseBuilding} onFindRoom={selectAlternative}
        slotSummary={monthDay(date)+' · '+clock(hour)+'–'+clock(Number(hour)+duration)+' IST'}
        requiredSeats={capacity}
        activeSessions={activeSessions} nowScheduleState={nowScheduleState}/>
    </section>
    <div className="cx-lower-workspace">
      <div className="cx-tools-column">
    <section className="cx-nav" aria-label="Reservation time and requirements">
      <span className="cx-nav-heading">Session details</span>
      <Popover.Root>
        <Popover.Trigger asChild><button type="button" className="cx-schedule-trigger" aria-label="Edit session type, date, time and room requirements">
          <CalendarDays size={17}/>
          <span><strong>{monthDay(date)}</strong><small>{clock(hour)}–{clock(Number(hour)+duration)} IST · {capacity} seats · {bookingKind}</small></span>
          <ChevronDown size={16}/></button></Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="bottom" align="end" sideOffset={8} className="cx-schedule-popover">
            <div className="cx-popover-heading"><span><Settings2 size={16}/> Plan a session</span><Popover.Close aria-label="Close scheduling options"><X size={17}/></Popover.Close></div>
            <div className="cx-popover-fields">
              <label>Date <input aria-label="Session date" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
              <label>Start · IST <select value={hour} onChange={e=>setHour(e.target.value)}>{TIMES.map(h=><option key={h} value={String(h)}>{clock(h)}</option>)}</select></label>
              <label>Duration <select value={duration} onChange={e=>setDuration(Number(e.target.value))}>{[1,2,3].map(d=><option key={d} value={d}>{d} hour{d>1?'s':''}</option>)}</select></label>
              <label>Minimum seats <select value={capacity} onChange={e=>setCapacity(Number(e.target.value))}>{[30,75,150,200].map(n=><option key={n} value={n}>{n} seats</option>)}</select></label>
              <label className="cx-popover-type">Session type
                <select value={bookingKind} onChange={e=>setBookingKind(e.target.value)}>
                  <option value="lecture">Lecture</option>
                  <option value="practical">Practical / laboratory</option>
                  <option value="exam">Exam</option>
                  <option value="event">Event</option>
                </select>
              </label>
            </div>
            <div className="cx-popover-foot"><Info size={13}/> Availability updates for this interval.
              <Popover.Close className="cx-done">Done</Popover.Close></div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </section>
      <section className="cx-live-roster" aria-label="Current classes on selected floor">
        <div className="cx-live-roster-head">
          <div><span className="cx-overline">CAMPUS ACTIVITY</span>
            <h2>Running right now</h2></div>
          <span className="cx-live-clock">{sessionTimeIST(new Date(currentTimeMs).toISOString())} IST</span>
        </div>
        {nowScheduleState==='loading'?<p className="cx-live-muted">Checking active classroom sessions…</p>:
         nowScheduleState==='unavailable'?<p className="cx-live-muted">Live schedule unavailable. Current classes cannot be verified.</p>:
         floorSessions.length===0?<p className="cx-live-muted">No ongoing classes are listed on this floor.</p>:
         <div className="cx-live-list">{floorSessions.map(s=><button type="button" key={s.roomId}
           className="cx-live-item" onClick={()=>{const room=rooms.find(r=>r.id===s.roomId);if(room)selectRoom(room);revealMap();}}>
           <span className="cx-live-room">{s.roomId}</span>
           <span className="cx-live-item-content"><strong>{s.title}</strong>
             <small>{sessionTimeIST(s.start)} – {sessionTimeIST(s.end)} IST</small></span>
           <ArrowRight size={15}/></button>)}</div>}
      </section>
      </div>
      <aside className="cx-aside">
        <div className="cx-side-head"><span className="cx-overline">BOOKING DETAILS</span><small>Step 1 of 2 · Select room</small></div>
        {roomInfo}
        {matching.length>0&&<div className="cx-other"><div className="cx-other-head"><span>Other suitable rooms</span><span>{matching.length} found</span></div>
          {matching.filter(r=>r.id!==selected).slice(0,3).map(r=><button type="button" key={r.id} onClick={()=>selectAlternative(r)}>
            <span><b>{r.id}</b><small>{r.building==='IET'?'IET':'Deeksha'} · {r.floor} · {r.capacity} seats</small></span><ArrowRight size={15}/></button>)}
        </div>}
      </aside>
    </div>
    <Dialog.Root open={mobile&&!!current&&sheetOpen} onOpenChange={setSheetOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="cx-mobile-overlay"/>
        <Dialog.Content className="cx-mobile-sheet" aria-describedby="cx-mobile-description">
          <div className="cx-mobile-handle"/>
          <div className="cx-mobile-top"><Dialog.Title>{current?.id||'Room details'}</Dialog.Title>
            <Dialog.Close aria-label="Close room details"><X size={18}/></Dialog.Close></div>
          <Dialog.Description id="cx-mobile-description">Review classroom and availability before booking.</Dialog.Description>
          {roomInfo}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </div>;
}