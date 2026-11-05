import React, {useEffect, useMemo, useState} from 'react';
import {ArrowRight, ArrowUpRight, Bell, BookOpen, Building2, CalendarDays, Check, CheckCheck, CheckCircle2, ChevronLeft, ChevronRight, Clock3, DoorOpen, Filter, Info, Layers, ListFilter, LockKeyhole, MapPin, Plus, RefreshCcw, Search, Send, Shield, SlidersHorizontal, Sparkles, Users, X} from 'lucide-react';
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
          {!byDay(day).length&&<div className="ig-cal-empty-day"><span>No events</span><small>Check live availability in Explore rooms</small></div>}
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
export function AdminPage({canAdmin,demo,userRole,rooms,bookings,notices,noticeTitle,setNoticeTitle,noticeBody,setNoticeBody,noticePriority,setNoticePriority,noticeBusy,addNotice,pendingQueue,pendingLoading,pendingError,reviewBusy,reviewPendingBooking,setRefreshTick,accountUuid,setAccountUuid,accountRole,setAccountRole,accountBusy,grantTestRole,apiWarning,apiAvailability,auditRows,auditTotal,auditOffset,setAuditOffset,auditRoom,setAuditRoom,auditAction,setAuditAction,auditLoading,auditError}) {
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
      <section className="ig-card ig-audit-card">
        <PanelHead eyebrow="ACCOUNTABILITY" title="Booking audit history" icon={BookOpen}
          description="Real creation, approval, rejection and cancellation events, permission-scoped by building"
          action={<button className="ig-icon-button" aria-label="Refresh audit history" onClick={()=>setRefreshTick(n=>n+1)}><RefreshCcw size={17}/></button>}/>
        {demo?<Empty icon={Shield} title="Live history unavailable in preview" body="Sign in as a verified administrator to inspect real audit events."/>:<>
          <div className="ig-audit-filters">
            <label>Room ID<input value={auditRoom} onChange={e=>{setAuditRoom(e.target.value);setAuditOffset(0)}} placeholder="All rooms / IET19" maxLength={30}/></label>
            <label>Event type<select value={auditAction} onChange={e=>{setAuditAction(e.target.value);setAuditOffset(0)}}><option value="">All events</option><option value="created">Created</option><option value="status">Status changes</option></select></label>
          </div>
          {auditLoading?<p className="ig-muted">Loading recorded booking changes…</p>:
           auditError?<div className="ig-alert" role="alert">{auditError}</div>:
           !auditRows.length?<Empty icon={BookOpen} title="No recorded changes" body="There are no audit events matching these filters and your building permissions."/>:
           <div className="ig-audit-scroll"><table className="ig-audit-table"><thead><tr><th>When (IST)</th><th>Room / booking</th><th>Event</th><th>Actor</th><th>Current status</th></tr></thead>
             <tbody>{auditRows.map(a=><tr key={a.event_id}><td>{strDate(a.happened_at)}<small>{strTime(a.happened_at)}</small></td><td><b>{a.room_id}</b><small>{a.booking_title}</small></td><td>{a.action}</td><td title="Truncated identifier for privacy">{a.actor_id?a.actor_id.slice(0,8)+'…':'System / not recorded'}</td><td><StatePill status={a.booking_status}/></td></tr>)}</tbody></table></div>}
          <div className="ig-audit-footer"><span>{auditTotal} recorded event{auditTotal===1?'':'s'} · newest first</span><div>
            <button className="ig-btn ig-btn-outline ig-btn-small" disabled={auditLoading||auditOffset===0} onClick={()=>setAuditOffset(n=>Math.max(0,n-20))}><ChevronLeft size={15}/> Previous</button>
            <button className="ig-btn ig-btn-outline ig-btn-small" disabled={auditLoading||auditOffset+20>=auditTotal} onClick={()=>setAuditOffset(n=>n+20)}>Next <ChevronRight size={15}/></button>
          </div></div>
          <p className="ig-note"><Info size={14}/> These records are created by database triggers. Coordinators see only their delegated buildings; students and faculty cannot access this history.</p>
        </>}
      </section>
      </div>
    </>}
  </div>;
}
