import React, {useEffect, useState} from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Dialog from '@radix-ui/react-dialog';
import VelarisGradient from './VelarisGradient';
import {ArrowRight, BookOpenText, Building2, CalendarDays, CheckCircle2, ChevronDown, Clock3, DoorOpen, Info, Layers3, List, Map as MapIcon, Settings2, SlidersHorizontal, Users, X} from 'lucide-react';
import BlueprintSitePlan from './BlueprintSitePlan';
import './CampusExperience.css';

const TIMES=Array.from({length:11},(_,i)=>8+i);
const monthDay=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const clock=h=>String(h).padStart(2,'0')+':00';
const statuses={available:'Available',occupied:'Occupied',restricted:'Not eligible',unknown:'Not verified',pending:'Approval pending'};
function Badge({value}){const s=statuses[value]?value:'unknown';return <span className={'cx-status cx-status-'+s}><span className="cx-status-dot"/>{statuses[s]}</span>}
// DESIGN.md: use navy/cobalt only. This is decorative, not a status indicator.
const HERO_COLORS=['#315CE5','#10213B','#6C8FF7','#CFDDFC'];
export default function CampusExperience({
  buildings,rooms,building,setBuilding,floor,setFloor,selected,setSelected,
  date,setDate,hour,setHour,duration,setDuration,capacity,setCapacity,
  bookingKind,setBookingKind,requiredEquipment,setRequiredEquipment,
  apiAvailability,apiWarning,isAvailable,matching,current,canBook,
  setShowBooking,setView,demo,selectedCohortLabel
}) {
  const [mode,setMode]=useState('plan');
  const [sheetOpen,setSheetOpen]=useState(false);
  const [mobile,setMobile]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(max-width:720px)').matches);
  useEffect(()=>{
    const media=window.matchMedia('(max-width:720px)');
    const change=()=>setMobile(media.matches);change();
    media.addEventListener?.('change',change);
    return()=>media.removeEventListener?.('change',change);
  },[]);
  useEffect(()=>{if(!mobile)setSheetOpen(false)},[mobile]);
  const getStatus=room=>{
    if(room.capacity<capacity)return 'restricted';
    if(!demo){
      if(!apiAvailability)return 'unknown';
      const status=apiAvailability.find(r=>r.id===room.id);
      if(!status)return 'unknown';
      if(status.reason==='ineligible')return 'restricted';
    }
    return isAvailable(room)?'available':'occupied';
  };
  const currentStatus=current?getStatus(current):'unknown';
  const bookable=!!current&&canBook&&currentStatus==='available';
  const selectRoom=room=>{
    setSelected(room.id);
    if(mobile)setSheetOpen(true);
  };
  const chooseBuilding=code=>{
    setBuilding(code);
    setFloor(buildings.find(b=>b.id===code)?.floors?.[0]||'Ground');
    setSelected('');setSheetOpen(false);
  };
  const selectAlternative=room=>{
    setBuilding(room.building);setFloor(room.floor);
    setSelected(room.id);
    if(mobile)setSheetOpen(true);
  };
  const roomInfo=current?<div className="cx-room-info">
    <div className="cx-room-name"><div><span className="cx-overline">SELECTED CLASSROOM</span><h2>{current.id}</h2>
      <p>{current.building==='IET'?'IET':'Deeksha Bhawan'} · {current.floor} floor</p></div><Badge value={currentStatus}/></div>
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
    {canBook&&!bookable&&<p className="cx-assist">This room is not confirmed available for the requested capacity and time.</p>}
    {!current.verified&&<p className="cx-assist">* Capacity is provisional until verified by the institute.</p>}
  </div>:<div className="cx-no-room"><DoorOpen size={27}/><h3>Choose a classroom</h3>
    <p>Select a room from the floor map to see its status and reserve it for your class.</p></div>;
  const buildingName=building==='IET'?'IET':'Deeksha Bhawan';
  return <div className="cx-page">
    <header className="cx-hero">
      <VelarisGradient className="cx-gradient" colors={HERO_COLORS}
        background="#07162C" speed={0.42} grain={0.16}/>
      <div className="cx-gradient-overlay" aria-hidden="true"/>
      <div className="cx-hero-copy">
        <span className="cx-hero-overline">IET GRID · CAMPUS BOOKING</span>
        <h1>Find space for the next class.</h1>
        <p>Choose a classroom on the campus map. Check its schedule and reserve in a few steps.</p>
      </div>
      <div className="cx-hero-mark" aria-hidden="true"><span>02</span><small>BUILDINGS</small></div>
    </header>
    <section className="cx-nav" aria-label="Campus floor and schedule">
      <div className="cx-nav-main">
        <div className="cx-building-tabs" role="group" aria-label="Select building">
          {buildings.map(b=><button type="button" key={b.id} aria-pressed={building===b.id}
            className={building===b.id?'active':''} onClick={()=>chooseBuilding(b.id)}>
            <Building2 size={16}/>{b.short}</button>)}
        </div>
        <span className="cx-divider" aria-hidden="true"/>
        <div className="cx-floor-tabs" role="group" aria-label="Select floor">
          {buildings.find(b=>b.id===building)?.floors.map(f=><button type="button" key={f}
            aria-pressed={f===floor} className={f===floor?'active':''}
            onClick={()=>{setFloor(f);setSelected('');setSheetOpen(false)}}>{f}</button>)}
        </div>
      </div>
      <Popover.Root>
        <Popover.Trigger asChild><button type="button" className="cx-schedule-trigger" aria-label="Edit selected date, time and room requirements">
          <CalendarDays size={17}/>
          <span><strong>{monthDay(date)}</strong><small>{clock(hour)} – {clock(Number(hour)+duration)} IST · {capacity} seats</small></span>
          <ChevronDown size={16}/></button></Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="bottom" align="end" sideOffset={8} className="cx-schedule-popover">
            <div className="cx-popover-heading"><span><Settings2 size={16}/> Plan a session</span><Popover.Close aria-label="Close scheduling options"><X size={17}/></Popover.Close></div>
            <div className="cx-popover-fields">
              <label>Date <input aria-label="Session date" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
              <label>Start · IST <select value={hour} onChange={e=>setHour(e.target.value)}>{TIMES.map(h=><option key={h} value={String(h)}>{clock(h)}</option>)}</select></label>
              <label>Duration <select value={duration} onChange={e=>setDuration(Number(e.target.value))}>{[1,2,3].map(d=><option key={d} value={d}>{d} hour{d>1?'s':''}</option>)}</select></label>
              <label>Minimum seats <select value={capacity} onChange={e=>setCapacity(Number(e.target.value))}>{[30,75,150,200].map(n=><option key={n} value={n}>{n} seats</option>)}</select></label>
            </div>
            <div className="cx-popover-foot"><Info size={13}/> Availability updates for this interval.
              <Popover.Close className="cx-done">Done</Popover.Close></div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </section>
    {apiWarning&&<div className="cx-warning" role="alert"><Info size={17}/>{apiWarning}</div>}
    <div className="cx-content">
      <div className="cx-floor-column">
        <div className="cx-floor-label">
          <div><span className="cx-overline">FLOOR OVERVIEW</span><h2>{buildingName} <span>/ {floor}</span></h2></div>
          <div className="cx-view-toggle" role="group" aria-label="Floor display mode">
            <button type="button" aria-pressed={mode==='plan'} className={mode==='plan'?'active':''} onClick={()=>setMode('plan')}><MapIcon size={15}/> Map</button>
            <button type="button" aria-pressed={mode==='list'} className={mode==='list'?'active':''} onClick={()=>setMode('list')}><List size={15}/> List</button>
          </div>
        </div>
        <BlueprintSitePlan rooms={rooms} building={building} floor={floor} selected={selected}
          onSelect={selectRoom} getStatus={getStatus} mode={mode}/>
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