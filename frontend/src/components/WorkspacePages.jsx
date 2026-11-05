import React, {useMemo, useState} from 'react';
import {ArrowRight, ArrowUpRight, Bell, BookOpen, Building2, CalendarDays, Check, CheckCheck, CheckCircle2, ChevronLeft, ChevronRight, Clock3, DoorOpen, Filter, Info, Layers, ListFilter, LockKeyhole, MapPin, Plus, RefreshCcw, Search, Send, Shield, SlidersHorizontal, Sparkles, Users, X} from 'lucide-react';
import FloorPlan from './FloorPlan';
import './WorkspacePages.css';

const strDate = (value) => new Date(value).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'});
const strTime = (value) => new Date(value).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'Asia/Kolkata'});
function localDay(value) {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  const pick=(type)=>parts.find(p=>p.type===type)?.value||'';
  return pick('year')+'-'+pick('month')+'-'+pick('day');
}
function offsetDay(date,n){
  const d=new Date(date+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);
}
const dayLabel=(date)=>new Date(date+'T12:00:00Z').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'});
const StatePill=({status,children})=>{
  const key=status==='confirmed'?'available':status==='cancelled'||status==='rejected'?'occupied':status==='pending'?'pending':status==='available'?'available':status==='occupied'?'occupied':status==='restricted'?'restricted':'unknown';
  const labels={confirmed:'Confirmed',pending:'Pending review',cancelled:'Cancelled',rejected:'Rejected',available:'Available',occupied:'Occupied',restricted:'Restricted',unknown:'Not verified'};
  return <span className={'ig-status ig-status-'+key}>{children||labels[status]||status||'Unknown'}</span>;
};
function PanelHead({eyebrow,title,description,action,icon:Icon}){
  return <div className="ig-card-head"><div className="ig-card-head-text">{eyebrow&&<span className="ig-overline">{eyebrow}</span>}
    <h2>{Icon&&<Icon size={19}/>} {title}</h2>{description&&<p>{description}</p>}</div>{action&&<div className="ig-card-head-action">{action}</div>}</div>;
}
function Empty({icon:Icon=BookOpen,title,body,action}) {
  return <div className="ig-empty"><div className="ig-empty-icon"><Icon size={24}/></div><h3>{title}</h3><p>{body}</p>{action}</div>;
}
function MiniRoom({room,isAvailable,onClick,selected}) {
  const good=!!isAvailable?.(room);
  const status=good?'available':'unknown';
  return <button className={'ig-mini-room '+(good?'is-free':'is-unverified')+(selected?' is-selected':'')}
    key={room.id} onClick={()=>onClick(room)} type="button">
    <span className="ig-mini-room-id">{room.id}</span><small>{room.capacity}{room.verified?'':'*'} seats</small><span className={'ig-mini-indicator '+status}>{good?'Free':'Check'}</span>
  </button>;
}
export function OverviewPage({rooms,bookings,notices,matching,buildings,selected,setSelected,setBuilding,setFloor,setView,demo,apiAvailability,isAvailable,canBook}) {
  const sample=rooms.filter(r=>r.building==='IET'&&r.floor==='First').slice(0,6);
  const availableCount=demo?rooms.filter(r=>isAvailable(r)).length:
    apiAvailability?rooms.filter(r=>isAvailable(r)).length:null;
  const upcoming=[...bookings].filter(b=>new Date(b.ends_at).getTime()>=Date.now()).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at)).slice(0,4);
  const metrics=[
    {label:'Campus buildings',value:buildings.length,caption:'IET + Deeksha Bhawan',icon:Building2},
    {label:'Mapped rooms',value:rooms.length,caption:'Across 5 campus floors',icon:DoorOpen},
    {label:'Availability checked',value:availableCount===null?'—':availableCount,caption:availableCount===null?'Live verification unavailable':'Free for your selected slot',icon:CheckCircle2},
    {label:'Upcoming activity',value:upcoming.length,caption:'Reservations in the visible feed',icon:CalendarDays}
  ];
  const openRoom=(room)=>{setBuilding(room.building);setFloor(room.floor);setSelected(room.id);setView('Explore rooms')};
  return <div className="ig-page-stack">
    <section className="ig-hero">
      <div className="ig-hero-content"><span className="ig-hero-kicker"><Sparkles size={15}/> UNIVERSITY SPACE INTELLIGENCE</span>
        <h2>Make space for<br/><em>what matters.</em></h2>
        <p>Find suitable classrooms, see what is free, and manage the academic day from one connected campus workspace.</p>
        <div className="ig-hero-actions">
          <button className="ig-btn ig-btn-light" type="button" onClick={()=>setView('Explore rooms')}>Explore rooms <ArrowRight size={17}/></button>
          <button className="ig-btn ig-btn-ghost-light" type="button" onClick={()=>setView('Calendar')}>View timetable <CalendarDays size={17}/></button>
        </div>
      </div>
      <div className="ig-hero-visual" aria-hidden="true"><div className="ig-hero-orbit orbit-a"/><div className="ig-hero-orbit orbit-b"/><div className="ig-hero-orbit orbit-c"/>
        <div className="ig-hero-ui"><div className="ig-hero-ui-top"><Layers size={15}/> CAMPUS GRID <span>01 / 02</span></div>
          <div className="ig-hero-ui-rooms"><span>IET22</span><span>IET16</span><i>MAIN CORRIDOR</i><span className="accent">IET19</span><span>IET18</span></div>
          <div className="ig-hero-ui-bottom"><CheckCircle2 size={13}/> ILLUSTRATIVE FLOOR PREVIEW</div>
        </div>
      </div>
    </section>
    <section className="ig-metric-grid" aria-label="Campus overview">
      {metrics.map(m=><article className="ig-metric" key={m.label}><div className="ig-metric-icon"><m.icon size={18}/></div>
        <span>{m.label}</span><strong>{m.value}</strong><small>{m.caption}</small></article>)}
    </section>
    <div className="ig-dashboard-grid">
      <section className="ig-card ig-dashboard-map">
        <PanelHead eyebrow="SPATIAL OVERVIEW" title="Quick room finder" description="IET · First floor · Schematic"
          icon={MapPin} action={<button className="ig-link" onClick={()=>setView('Explore rooms')}>Full explorer <ArrowUpRight size={16}/></button>}/>
        <div className="ig-mini-floor">
          <div className="ig-mini-floor-label">IET / FIRST FLOOR</div>
          <div className="ig-mini-floor-grid">{sample.map(room=><MiniRoom room={room} key={room.id} isAvailable={isAvailable} onClick={openRoom} selected={selected===room.id}/>)}</div>
          <span className="ig-mini-corridor">— CAMPUS CORRIDOR —</span>
          <div className="ig-mini-floor-foot"><span><i className="ig-dot ig-dot-green"/> Verified available</span><span><i className="ig-dot ig-dot-gray"/> Check status</span></div>
        </div>
        <p className="ig-note"><Info size={14}/> Room arrangement is schematic, not a verified floor blueprint.</p>
      </section>
      <section className="ig-card">
        <PanelHead eyebrow="COMING UP" title="Upcoming schedule" description="Next visible classroom commitments" icon={CalendarDays}
          action={<button className="ig-link" onClick={()=>setView('Calendar')}>Calendar <ArrowUpRight size={16}/></button>}/>
        {upcoming.length?<div className="ig-activity-list">{upcoming.map(b=><button type="button" className="ig-activity" key={b.id} onClick={()=>{const room=rooms.find(r=>r.id===b.room_id);if(room)openRoom(room);else setView('Calendar')}}>
          <span className="ig-activity-date"><b>{new Date(b.starts_at).toLocaleDateString('en-IN',{day:'2-digit',timeZone:'Asia/Kolkata'})}</b><small>{new Date(b.starts_at).toLocaleDateString('en-IN',{month:'short',timeZone:'Asia/Kolkata'})}</small></span>
          <span className="ig-activity-info"><b>{b.title}</b><small>{b.room_id} · {strTime(b.starts_at)}</small></span><StatePill status={b.status}/></button>)}</div>:
          <Empty icon={CalendarDays} title="No upcoming sessions" body="Scheduled bookings will appear here when available."/>}
      </section>
    </div>
    <section className="ig-card">
      <PanelHead eyebrow="CAMPUS BULLETIN" title="Latest announcements" description="Updates relevant to your academic day" icon={Bell}
        action={<button className="ig-link" onClick={()=>setView('Announcements')}>View all <ArrowUpRight size={16}/></button>}/>
      <div className="ig-bulletin-row">{notices.slice(0,3).map(n=><article className="ig-bulletin" key={n.id}>
        <span className={'ig-bulletin-icon '+(n.priority==='high'?'high':'')}><Bell size={16}/></span>
        <div><b>{n.title}</b><p>{n.body}</p><small>{strDate(n.created_at)}</small></div></article>)}
        {!notices.length&&<Empty icon={Bell} title="No announcements" body="No notices have been published in this workspace."/>}</div>
    </section>
  </div>;
}
const TIME_OPTIONS=Array.from({length:11},(_,i)=>i+8);
function FieldSelect({label,value,onChange,children}){return <label className="ig-control-field"><span>{label}</span><select value={value} onChange={onChange}>{children}</select></label>}
export function ExplorePage({buildings,rooms,building,setBuilding,floor,setFloor,selected,setSelected,date,setDate,hour,setHour,duration,setDuration,capacity,setCapacity,apiAvailability,apiWarning,isAvailable,matching,current,canBook,setShowBooking,setView,demo}) {
  const getStatus=(r)=>{
    if(!demo&&!apiAvailability)return 'unknown';
    const record=apiAvailability?.find(a=>a.id===r.id);
    if(!demo&&!record)return 'unknown';
    if(!demo && record.reason==='ineligible')return 'restricted';
    if(r.capacity<capacity)return 'restricted';
    return isAvailable(r)?'available':'occupied';
  };
  const getCurrentStatus=current?getStatus(current):'unknown';
  const eligible=!!current&&getCurrentStatus==='available'&&canBook;
  const chooseBuilding=id=>{setBuilding(id);setFloor(buildings.find(b=>b.id===id)?.floors?.[0]||'Ground');setSelected('')};
  return <div className="ig-page-stack">
    <section className="ig-card ig-filters-card">
      <div className="ig-filter-title"><div><span className="ig-overline">BOOKING CONSOLE</span><h2><SlidersHorizontal size={19}/> Find a space</h2></div><span className="ig-filter-help"><Info size={14}/> Availability is checked for the selected interval.</span></div>
      <div className="ig-building-select" role="group" aria-label="Campus building">{buildings.map(b=><button type="button" key={b.id}
        aria-pressed={building===b.id} className={building===b.id?'active':''} onClick={()=>chooseBuilding(b.id)}><Building2 size={16}/>{b.short}</button>)}</div>
      <div className="ig-filter-controls">
        <FieldSelect label="Floor" value={floor} onChange={e=>{setFloor(e.target.value);setSelected('')}}>
          {buildings.find(b=>b.id===building)?.floors.map(f=><option key={f} value={f}>{f} floor</option>)}</FieldSelect>
        <label className="ig-control-field"><span>Date</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
        <FieldSelect label="Start time (IST)" value={hour} onChange={e=>setHour(e.target.value)}>
          {TIME_OPTIONS.map(h=><option key={h} value={String(h)}>{String(h).padStart(2,'0')}:00</option>)}</FieldSelect>
        <FieldSelect label="Duration" value={duration} onChange={e=>setDuration(Number(e.target.value))}><option value={1}>1 hour</option><option value={2}>2 hours</option><option value={3}>3 hours</option></FieldSelect>
        <FieldSelect label="Seats required" value={capacity} onChange={e=>setCapacity(Number(e.target.value))}>{[30,75,150,200].map(n=><option key={n} value={n}>{n} seats</option>)}</FieldSelect>
      </div>
    </section>
    {apiWarning&&<div className="ig-alert" role="alert"><Info size={18}/>{apiWarning}</div>}
    <div className="ig-explore-columns">
      <section className="ig-map-column"><FloorPlan rooms={rooms} building={building} floor={floor} selected={selected} onSelect={r=>setSelected(r.id)} getStatus={getStatus}/></section>
      <aside className="ig-explore-inspector">
        <section className="ig-card ig-inspector-card">
          <PanelHead eyebrow="ROOM INSPECTOR" title="Selected space" icon={DoorOpen}/>
          {current?<div className="ig-inspector-body">
            <div className="ig-inspector-title"><div><h3>{current.id}</h3><small>{current.building==='IET'?'IET':'Deeksha Bhawan'} · {current.floor} floor</small></div><StatePill status={getCurrentStatus}/></div>
            <div className="ig-inspector-features">
              <div><Users size={18}/><span>Capacity</span><strong>{current.capacity}{current.verified?'':'*'} seats</strong></div>
              <div><Layers size={18}/><span>Room type</span><strong className="ig-capitalize">{current.type}</strong></div>
              <div><Clock3 size={18}/><span>Requested interval</span><strong>{String(hour).padStart(2,'0')}:00 · {duration}h</strong></div>
              <div><CalendarDays size={18}/><span>Date</span><strong>{dayLabel(date)}</strong></div>
            </div>
            <button type="button" className="ig-btn ig-btn-primary ig-btn-block" disabled={!eligible} onClick={()=>setShowBooking(true)}>Reserve this room <ArrowRight size={17}/></button>
            {!canBook&&<p className="ig-inspector-explain">Only verified faculty and approved staff can book rooms.</p>}
            {canBook&&!eligible&&<p className="ig-inspector-explain">This room is not confirmed eligible for the selected time and capacity. Choose a verified available alternative.</p>}
            {!current.verified&&<p className="ig-note"><Info size={14}/> Capacity is provisional until validated by the institute.</p>}
            <button type="button" className="ig-btn ig-btn-outline ig-btn-block" onClick={()=>setView('Calendar')}><CalendarDays size={16}/> View schedule</button>
          </div>:<Empty icon={DoorOpen} title="Choose a classroom" body="Select any room from the map or list to inspect its eligibility and reservation options."/>}
        </section>
        <section className="ig-card ig-alternative-card">
          <PanelHead eyebrow="ALTERNATIVE SPACES" title="Recommended rooms" icon={Sparkles} description="Constraint-checked suggestions, not AI confidence"/>
          <div className="ig-alternatives">{matching.slice(0,5).map((r,i)=><button key={r.id} className="ig-alternative" onClick={()=>{setBuilding(r.building);setFloor(r.floor);setSelected(r.id)}}>
            <span className="ig-alternative-rank">{String(i+1).padStart(2,'0')}</span><span className="ig-alternative-meta"><b>{r.id}</b><small>{r.building} · {r.floor} · {r.capacity} seats</small></span>
            <span className="ig-fit">{typeof r.score==='number'?r.score+' fit':'Matched'}</span><ArrowUpRight size={16}/></button>)}
            {!matching.length&&<Empty icon={Search} title="No matching rooms" body="Try another date, start time, or capacity."/>}</div>
        </section>
      </aside>
    </div>
  </div>;
}
export function CalendarPage({date,setDate,initialDate,calendarBookings,rooms,onOpenRoom}) {
  const [mode,setMode]=useState('week');
  const days=mode==='day'?[date]:Array.from({length:5},(_,n)=>offsetDay(date,n));
  const events=[...calendarBookings].filter(b=>b.starts_at&&b.ends_at).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
  const byDay=day=>events.filter(e=>localDay(e.starts_at)===day);
  return <div className="ig-page-stack"><section className="ig-card ig-calendar-page">
    <div className="ig-calendar-top">
      <div><span className="ig-overline">TEMPORAL VIEW</span><h2><CalendarDays size={20}/> Campus timetable</h2><p>Bookings and campus allocations, shown in India Standard Time (IST).</p></div>
      <div className="ig-calendar-actions"><button className="ig-icon-button" aria-label="Previous day" onClick={()=>setDate(offsetDay(date,mode==='day'?-1:-5))}><ChevronLeft size={18}/></button>
        <input type="date" value={date} aria-label="Calendar start date" onChange={e=>setDate(e.target.value)}/>
        <button className="ig-icon-button" aria-label="Next day" onClick={()=>setDate(offsetDay(date,mode==='day'?1:5))}><ChevronRight size={18}/></button>
        <button className="ig-btn ig-btn-outline ig-btn-small" onClick={()=>setDate(initialDate)}>Today</button></div>
    </div>
    <div className="ig-calendar-mode" role="group" aria-label="Calendar layout">
      {['day','week','agenda'].map(m=><button key={m} type="button" aria-pressed={mode===m} className={mode===m?'selected':''} onClick={()=>setMode(m)}>{m[0].toUpperCase()+m.slice(1)}</button>)}
    </div>
    {mode==='agenda'?<div className="ig-agenda">
      {events.filter(b=>localDay(b.starts_at)>=date).slice(0,40).map(b=><button key={b.id} className="ig-agenda-event" onClick={()=>onOpenRoom(b.room_id,b.starts_at)}>
        <div className="ig-agenda-date"><b>{strDate(b.starts_at)}</b><span>{strTime(b.starts_at)}</span></div>
        <div><b>{b.title}</b><span>{b.room_id} · {b.kind||'Session'}</span></div><StatePill status={b.status}/><ArrowUpRight size={16}/></button>)}
      {!events.some(b=>localDay(b.starts_at)>=date)&&<Empty icon={CalendarDays} title="No upcoming allocations" body="No scheduled events were returned for this period."/>}
    </div>:<div className={'ig-cal-columns '+(mode==='day'?'is-day':'')}>
      {days.map(day=><div className="ig-cal-day-column" key={day}><div className="ig-cal-day-head"><strong>{new Date(day+'T12:00:00Z').toLocaleDateString('en-IN',{weekday:'short',timeZone:'UTC'})}</strong>
        <span>{new Date(day+'T12:00:00Z').getUTCDate()}</span>{day===initialDate&&<small>Today</small>}</div>
        <div className="ig-cal-day-body">{byDay(day).map(b=><button className={'ig-cal-booking '+(b.status==='pending'?'pending':'')} key={b.id}
          type="button" onClick={()=>onOpenRoom(b.room_id,b.starts_at)}>
          <small><Clock3 size={12}/>{strTime(b.starts_at)} – {strTime(b.ends_at)}</small>
          <strong>{b.title}</strong><span>{b.room_id}</span><StatePill status={b.status}/></button>)}
          {!byDay(day).length&&<div className="ig-cal-empty-day"><span>No events</span><small>No availability claim</small></div>}
        </div></div>)}
    </div>}
    <p className="ig-note"><Info size={14}/> Select a scheduled event to locate its room on the floor board. The backend remains authoritative for overlaps and approval status.</p>
  </section></div>;
}
export function BookingsPage({bookings,rooms,setView,onOpenRoom}) {
  const [filter,setFilter]=useState('upcoming');
  const now=Date.now();
  const filtered=[...bookings].filter(b=>{
    if(filter==='pending')return b.status==='pending';
    if(filter==='past')return new Date(b.ends_at).getTime()<now||['cancelled','rejected'].includes(b.status);
    if(filter==='upcoming')return new Date(b.ends_at).getTime()>=now&&!['cancelled','rejected'].includes(b.status);
    return true;
  }).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
  return <div className="ig-page-stack"><section className="ig-card ig-booking-page">
    <PanelHead eyebrow="BOOKING REGISTRY" title="Classroom reservations" description="All bookings visible to your account under institutional access rules." icon={BookOpen}
      action={<button className="ig-btn ig-btn-primary ig-btn-small" onClick={()=>setView('Explore rooms')}><Plus size={16}/> New reservation</button>}/>
    <div className="ig-tabs" role="group" aria-label="Booking status filter">{[
      ['upcoming','Upcoming'],['pending','Pending'],['past','Past / cancelled'],['all','All records']
    ].map(([key,label])=><button key={key} className={filter===key?'active':''} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div>
    {filtered.length?<div className="ig-booking-list">{filtered.map(b=><button className="ig-booking-item" key={b.id} onClick={()=>onOpenRoom(b.room_id,b.starts_at)}>
      <span className="ig-booking-room"><DoorOpen size={18}/></span>
      <span className="ig-booking-main"><b>{b.title}</b><small>{b.room_id} · {b.kind||'lecture'}</small></span>
      <span className="ig-booking-when"><b>{strDate(b.starts_at)}</b><small>{strTime(b.starts_at)} – {strTime(b.ends_at)}</small></span>
      <StatePill status={b.status}/><ArrowUpRight size={16} className="ig-booking-arrow"/></button>)}</div>:
      <Empty icon={BookOpen} title="Nothing in this category" body="When bookings match this status, they will appear here." action={<button className="ig-btn ig-btn-outline" onClick={()=>setView('Explore rooms')}>Find a room <ArrowRight size={16}/></button>}/>}
  </section></div>;
}
export function AnnouncementsPage({notices,demo,markNoticeRead,noticeReadBusy,setReport}) {
  const [filter,setFilter]=useState('all');
  const filtered=notices.filter(n=>filter==='all'||(filter==='important'?n.priority==='high':!n.read_at));
  return <div className="ig-page-stack"><section className="ig-card ig-notice-page">
    <PanelHead eyebrow="INSTITUTIONAL BULLETIN" title="Campus announcements" icon={Bell}
      description="Official notices and critical schedule updates, visible according to your account."/>
    <div className="ig-tabs" role="group" aria-label="Announcement filter">{[['all','All updates'],['important','Important'],['unread','Unread']].map(([k,v])=>
      <button key={k} aria-pressed={filter===k} className={filter===k?'active':''} onClick={()=>setFilter(k)}>{v}</button>)}</div>
    {filtered.length?<div className="ig-notice-feed">{filtered.map(n=><article className="ig-notice-entry" key={n.id}>
      <span className={'ig-notice-emblem '+(n.priority==='high'?'high':'')}><Bell size={19}/></span>
      <div className="ig-notice-text"><div className="ig-notice-heading"><h3>{n.title}</h3>{n.priority==='high'&&<span className="ig-urgent">IMPORTANT</span>}</div>
        <p>{n.body}</p><div className="ig-notice-footer"><time>{strDate(n.created_at)}</time>
          {!demo&&(n.read_at?<span className="ig-read"><CheckCheck size={14}/> Read</span>:<button className="ig-link" disabled={noticeReadBusy===n.id} onClick={()=>markNoticeRead(n.id)}><Check size={15}/> {noticeReadBusy===n.id?'Saving…':'Mark as read'}</button>)}</div>
      </div></article>)}</div>:<Empty icon={Bell} title="No announcements found" body="Try another filter, or check back when new campus notices are published."/>}
    <div className="ig-report-callout"><div><h3>See incorrect timetable information?</h3><p>Report an issue for review. Reports do not change university schedules automatically.</p></div>
      <button className="ig-btn ig-btn-outline" type="button" onClick={()=>setReport(true)}>Report an issue <ArrowUpRight size={16}/></button></div>
  </section></div>;
}
export function AdminPage({canAdmin,demo,userRole,rooms,bookings,notices,noticeTitle,setNoticeTitle,noticeBody,setNoticeBody,noticePriority,setNoticePriority,noticeBusy,addNotice,pendingQueue,pendingLoading,pendingError,reviewBusy,reviewPendingBooking,setRefreshTick,accountUuid,setAccountUuid,accountRole,setAccountRole,accountBusy,grantTestRole,apiWarning,apiAvailability}) {
  return <div className="ig-page-stack">
    <section className="ig-admin-intro"><div><span className="ig-overline">OPERATIONS CENTER</span><h2>Campus administration</h2><p>Review allocations, publish academic updates, and manage permitted access.</p></div><StatePill status={canAdmin?'available':'restricted'}>{canAdmin?(demo?'Demo view':'Verified operator'):'Restricted access'}</StatePill></section>
    {!canAdmin?<section className="ig-card"><Empty icon={LockKeyhole} title="Administrator access required" body="These controls are limited to verified university administrators and coordinators."/></section>:<>
      <div className="ig-admin-metrics"><div><DoorOpen size={18}/><strong>{rooms.length}</strong><span>Rooms registered</span></div><div><BookOpen size={18}/><strong>{bookings.length}</strong><span>Visible bookings</span></div><div><Clock3 size={18}/><strong>{demo?'—':pendingQueue.length}</strong><span>Approval requests</span></div></div>
      <div className="ig-admin-grid">
        <section className="ig-card"><PanelHead eyebrow="INSTITUTIONAL MESSAGING" title="Publish announcement" description="Create an official campus notice" icon={Send}/>
          <div className="ig-admin-form">
            <label>Priority<select value={noticePriority} onChange={e=>setNoticePriority(e.target.value)}><option value="normal">Routine update</option><option value="high">Important / examination</option></select></label>
            <label>Title<input value={noticeTitle} onChange={e=>setNoticeTitle(e.target.value)} placeholder="Examination room change"/></label>
            <label>Announcement details<textarea rows={4} value={noticeBody} onChange={e=>setNoticeBody(e.target.value)} placeholder="Describe the revised room, session, and time."/></label>
            <button className="ig-btn ig-btn-primary" onClick={addNotice} disabled={noticeBusy||noticeTitle.trim().length<3}><Send size={16}/>{noticeBusy?'Publishing…':'Publish notice'}</button>
            {demo&&<p className="ig-note"><Info size={14}/> Demonstration only. This action is not saved to official records.</p>}
          </div>
        </section>
        <section className="ig-card">
          <PanelHead eyebrow="WORKFLOW" title="Booking approvals" icon={Shield} description="Examinations and events requiring review"
            action={<button className="ig-icon-button" aria-label="Refresh approvals" disabled={pendingLoading} onClick={()=>setRefreshTick(n=>n+1)}><RefreshCcw size={17}/></button>}/>
          {demo?<Empty icon={Shield} title="Demo review unavailable" body="Sign in as a verified campus operator to approve requests. Demonstration data is not persisted."/>:
            pendingLoading?<p className="ig-muted">Loading approval requests…</p>:
            pendingError?<div role="alert" className="ig-alert">{pendingError}</div>:
            pendingQueue.length===0?<Empty icon={CheckCircle2} title="All caught up" body="New pending examination and event requests will appear here."/>:
            <div className="ig-approval-list">{pendingQueue.map(b=><article key={b.id} className="ig-approval">
              <div className="ig-approval-head"><StatePill status="pending"/><small>{b.kind||'event'}</small></div>
              <h3>{b.title}</h3><p>{b.room_id} · {strDate(b.starts_at)} · {strTime(b.starts_at)}–{strTime(b.ends_at)}</p>
              <div className="ig-approval-actions"><button className="ig-btn ig-btn-primary ig-btn-small" onClick={()=>reviewPendingBooking(b,true)} disabled={!!reviewBusy}><Check size={15}/>{reviewBusy===b.id?'Working…':'Approve'}</button>
                <button className="ig-btn ig-btn-outline ig-btn-small" onClick={()=>reviewPendingBooking(b,false)} disabled={!!reviewBusy}><X size={15}/> Reject</button></div>
            </article>)}</div>}
          <p className="ig-note"><Info size={14}/> Server permissions and database conflict constraints are checked again on approval.</p>
        </section>
      </div>
      <div className="ig-admin-grid">
        {userRole==='admin'&&<section className="ig-card">
          <PanelHead eyebrow="IDENTITY & ACCESS" title="Provision test account" icon={Users} description="For previously registered, verified accounts only"/>
          {demo?<Empty icon={LockKeyhole} title="Sign in to provision" body="An institutional administrator account is required for live user provisioning."/>:
            <div className="ig-admin-form"><label>Registered user UUID<input value={accountUuid} onChange={e=>setAccountUuid(e.target.value)} placeholder="Supabase Auth user UUID"/></label>
              <label>Verified role<select value={accountRole} onChange={e=>setAccountRole(e.target.value)}><option value="faculty">Faculty</option><option value="student">Student</option></select></label>
              <button className="ig-btn ig-btn-primary" disabled={accountBusy||!accountUuid.trim()} onClick={grantTestRole}><Shield size={16}/>{accountBusy?'Provisioning…':'Grant verified role'}</button>
              <p className="ig-note"><Info size={14}/> Confirm user ownership before granting access. The backend enforces role restrictions.</p>
            </div>}
        </section>}
        <section className="ig-card">
          <PanelHead eyebrow="SERVICE READINESS" title="Integration status" icon={CheckCircle2} description="No simulated uptime or fabricated service-health metrics"/>
          <div className="ig-health-lines"><div><span>Application</span><b>Authenticated workspace</b></div>
            <div><span>Data mode</span><StatePill status={demo?'pending':'available'}>{demo?'Demo data':'Connected session'}</StatePill></div>
            <div><span>Live availability</span><StatePill status={demo||!apiAvailability||apiWarning?'unknown':'available'}>{demo?'Demo only':apiWarning||!apiAvailability?'Not verified':'API response received'}</StatePill></div>
            <div><span>Floor geometry</span><StatePill status="unknown">Schematic / unverified</StatePill></div>
          </div>
        </section>
      </div>
    </>}
  </div>;
}
