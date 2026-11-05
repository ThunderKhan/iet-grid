
import React,{useState,useEffect,useMemo} from 'react';
import {LayoutDashboard,CalendarDays,Map as MapIcon,BookOpen,GraduationCap,Shield,Settings,Search,Bell,ChevronDown,ChevronLeft,ChevronRight,Plus,ArrowUpRight,Clock,Users,CheckCircle2,AlertTriangle,LogOut,Lock,Building2,Layers,PanelLeftClose,Command,Filter,MapPin,Sparkles,ArrowRight,DoorOpen,Check,Menu,X,Info,Send,BookMarked,RefreshCcw} from 'lucide-react';
import {supabase,configured} from './supabase';
import AuthScreen from './components/AuthScreen';
import {buildings,sampleRooms,demoBookings,demoNotices,localDate,occupancy,recommend,dateTimes} from './data';
const initialDate=localDate();
const menu=[['Overview',LayoutDashboard],['Explore rooms',MapIcon],['Calendar',CalendarDays],['My bookings',BookOpen],['Announcements',Bell],['Admin',Shield]];
const fmt=(v,opts)=>new Date(v).toLocaleString('en-IN',opts||{hour:'numeric',minute:'2-digit'});
function IconTag({children}){return <span className="tag">{children}</span>}
function FloorMap({rooms,building,floor,selected,onSelect,getStatus}){
const group=rooms.filter(r=>r.building===building&&r.floor===floor);
const defined=building==='IET'&&floor==='First'?[['IET22','IET16','IET14','IET15'],['IET20','IET19','IET18','IET17']]:building==='IET'&&floor==='Second'?[['IET32','IET24','IET25'],['IET30','IET29','IET28','IET23']]:building==='DEEK'&&floor==='Ground'?[['LH01'],['LH02'],['LH03','LH04','LH05'],['LH06','LH07']]:building==='DEEK'&&floor==='First'?[['LH08'],['LH09'],['LH10','LH11','LH12'],['LH13','LH14']]:[['LIBRARY']];
return <div className="floorboard"><div className="floorboard-head"><span className="floorboard-dot"/><span>{building==='IET'?'IET':'DEEK'} / {floor.toUpperCase()} FLOOR</span><span className="floorboard-scale">SCHEMATIC VIEW · NOT TO SCALE</span></div>
<div className="blueprint">
<div className="blueprint-side"><span className="north">N ↑</span><span>ENTRY</span></div>
<div className="floorplan-body">{defined.map((line,index)=><React.Fragment key={index}><div className={'room-row row-'+index}>{line.map(id=>{let r=group.find(x=>x.id===id);if(!r)return null;let status=getStatus(r);return <button key={id} aria-label={id+' '+status} onClick={()=>onSelect(r)} className={'room-tile '+status+' '+(selected===id?'is-selected':'')}><span className="room-tile-id">{id==='LIBRARY'?'LIBRARY':id}</span><span className="room-type">{r.type==='lab'?'LAB / FLEX':r.type==='seminar'?'SEMINAR HALL':r.type==='library'?'STUDY SPACE':'CLASSROOM'}</span><span className="room-cap">{r.capacity} seats{r.verified?'':'*'}</span></button>})}</div>{index<defined.length-1&&<div className="corridor"><span>← CORRIDOR →</span><span className="stair">▦ STAIRS</span></div>}</React.Fragment>)}</div></div>
<div className="floorfoot"><span><span className="legend-dot available"/> Available</span><span><span className="legend-dot occupied"/> Booked</span><span><span className="legend-dot selected"/> Selected</span><small>* Estimated capacity</small></div></div>
}
export default function App(){
const [session,setSession]=useState(null);const [recovering,setRecovering]=useState(()=>new URLSearchParams(window.location.search).get('auth')==='reset');const [guest,setGuest]=useState(false);const [profile,setProfile]=useState(null);const [rooms,setRooms]=useState(configured?[]:sampleRooms);const [bookings,setBookings]=useState(configured?[]:demoBookings);const [notices,setNotices]=useState(configured?[]:demoNotices);const [view,setView]=useState('Overview');const [building,setBuilding]=useState('IET');const [floor,setFloor]=useState('First');const [date,setDate]=useState(initialDate);const [hour,setHour]=useState('11');const [duration,setDuration]=useState(1);const [capacity,setCapacity]=useState(75);const [selected,setSelected]=useState('IET19');const [toast,setToast]=useState('');const [loading,setLoading]=useState(false);const [mobile,setMobile]=useState(false);const [showBooking,setShowBooking]=useState(false);const [bookingTitle,setBookingTitle]=useState('Extra lecture');const [bookingKind,setBookingKind]=useState('lecture');const [report,setReport]=useState(false);const [noticeTitle,setNoticeTitle]=useState('');const [noticeBody,setNoticeBody]=useState('');
const demo=!configured||guest;
const [liveDataError,setLiveDataError]=useState('');
const API_BASE=import.meta.env.VITE_API_BASE_URL||'';
const [apiAvailability,setApiAvailability]=useState(null);
const [apiRecommendations,setApiRecommendations]=useState([]);
const [apiWarning,setApiWarning]=useState('');
const [refreshTick,setRefreshTick]=useState(0);
async function apiFetch(route,opts={}){
 if(!API_BASE||!session?.access_token)throw new Error('IET Grid API or sign-in is unavailable');
 const response=await fetch(API_BASE.replace(/\/$/,'')+route,{
   ...opts,headers:{'Authorization':'Bearer '+session.access_token,
   'Content-Type':'application/json',...(opts.headers||{})}});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data?.error?.message||data?.detail||'Backend request failed');
 return data;
}
useEffect(()=>{if(!configured)return;supabase.auth.getSession().then(({data})=>setSession(data.session));const {data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setSession(s));return()=>subscription.unsubscribe()},[]);
useEffect(()=>{
 if(!session||demo)return;
 let ignore=false;
 // Authenticated mode must never display the locally seeded demo records.
 setRooms([]);setBookings([]);setNotices([]);setLiveDataError('');
 (async()=>{
  try{
   const [p,r,b,n]=await Promise.all([
    supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle(),
    supabase.from('rooms').select('*').order('id'),
    supabase.from('bookings').select('*').order('starts_at'),
    supabase.from('announcements').select('*').order('created_at',{ascending:false})
   ]);
   if(ignore)return;
   setProfile(p.data||null);
   setRooms(r.data||[]);setBookings(b.data||[]);setNotices(n.data||[]);
   if([p,r,b,n].some(res=>res.error))
    setLiveDataError('Some live campus records could not be loaded. Do not rely on incomplete schedules.');
  }catch(_error){
   if(!ignore){setRooms([]);setBookings([]);setNotices([]);
    setLiveDataError('Live campus records are unavailable. No sample records are shown in authenticated mode.')}
  }
 })();
 return()=>{ignore=true};
},[session,demo]);
function alert(msg){setToast(msg);setTimeout(()=>setToast(''),4000)}
const {start,end}=useMemo(()=>dateTimes(date,hour,duration),[date,hour,duration]);
useEffect(()=>{
 if(demo||!session?.access_token)return;
 let disposed=false;
 setApiAvailability(null);setApiRecommendations([]);setApiWarning('');
 const query='start='+encodeURIComponent(start)+'&end='+encodeURIComponent(end)+
 '&capacity='+encodeURIComponent(capacity)+'&kind='+encodeURIComponent(bookingKind);
 Promise.all([apiFetch('/api/v1/availability?'+query),
   apiFetch('/api/v1/recommendations?'+query+'&building='+encodeURIComponent(building))])
   .then(([availability,recs])=>{if(disposed)return;
     setApiAvailability(availability.rooms||[]);
     setApiRecommendations(recs.recommendations||[]);
   })
   .catch(e=>{if(disposed)return;setApiAvailability(null);setApiRecommendations([]);
     setApiWarning('Live availability could not be verified: '+e.message)});
 return()=>{disposed=true};
},[demo,session?.access_token,start,end,capacity,building,bookingKind,refreshTick]);
const [liveCalendar,setLiveCalendar]=useState([]);
useEffect(()=>{
 if(demo||!session?.access_token)return;
 let disposed=false;setLiveCalendar([]);
 const first=new Date(date+'T00:00:00');
 const last=new Date(first.getTime()+7*86400000);
 apiFetch('/api/v1/calendar?start='+encodeURIComponent(first.toISOString())+
 '&end='+encodeURIComponent(last.toISOString()))
 .then(data=>{if(!disposed)setLiveCalendar((data.events||[]).map(e=>({
   id:e.id,room_id:e.room_id,title:e.title,kind:e.source_type,
   starts_at:e.start,ends_at:e.end,status:'confirmed'
 })))})
 .catch(()=>{if(!disposed)setLiveCalendar([])});
 return()=>{disposed=true};
},[demo,session?.access_token,date,refreshTick]);
const calendarBookings=demo?bookings:liveCalendar;
const current=rooms.find(r=>r.id===selected);
const isAvailable=r=>demo?!occupancy(r.id,start,end,bookings):
    apiAvailability?.some(x=>x.id===r.id&&x.available===true)===true;
const matching=useMemo(()=>demo?recommend(rooms,bookings,start,end,capacity,building):
 apiRecommendations,[demo,rooms,bookings,start,end,capacity,building,apiRecommendations]);
const filtered=rooms.filter(r=>r.building===building&&r.floor===floor);
const userRole=demo?'faculty':profile?.role||'student';
const canBook=demo||(['faculty','coordinator','admin'].includes(userRole)&&profile?.verified);
const canAdmin=demo||(['coordinator','admin'].includes(userRole)&&profile?.verified);
async function doBook(){
 if(!current)return;
 if(!isAvailable(current))return alert('This room is not verified as available at that time.');
 if(current.capacity<capacity)return alert('Requested capacity exceeds room size.');
 setLoading(true);let success=false;
 const title=bookingTitle.trim()||'Extra lecture';
 try{
  if(demo){
   setBookings(prev=>[...prev,{id:'local-'+Date.now(),room_id:current.id,title,
    starts_at:start,ends_at:end,status:'confirmed',kind:bookingKind}]);
   alert('Demo reservation added locally. Not saved to the university database.');
  }else{
   const result=await apiFetch('/api/v1/bookings',{method:'POST',body:JSON.stringify({
     room_id:current.id,title,starts_at:start,ends_at:end,kind:bookingKind,required_capacity:capacity,
     idempotency_key:crypto.randomUUID()})});
   const b=await supabase.from('bookings').select('*').order('starts_at');
   if(b.data)setBookings(b.data);
   setRefreshTick(v=>v+1);
   alert(result.status==='pending'?'Reservation request submitted for approval.':
     'Reservation confirmed and saved in Supabase.');
  }
  success=true;
 }catch(e){alert(e.message||'Booking failed. No reservation was confirmed.')}
 finally{setLoading(false);if(success)setShowBooking(false)}
}
async function submitReport(){
 if(demo){alert('Sample issue recorded for demonstration only.');setReport(false);return}
 try{
  await apiFetch('/api/v1/reports',{method:'POST',body:JSON.stringify({
   details:'Potential incorrect schedule reported for '+(selected||'unselected room')+' on '+date
  })});
  alert('Schedule issue submitted. Official bookings were not changed.');setReport(false);
 }catch(e){alert(e.message||'Could not submit report')}
}
async function addNotice(){
 if(!noticeTitle.trim())return;
 try{
  if(demo){
   setNotices(prev=>[{id:'local-'+Date.now(),title:noticeTitle,body:noticeBody,
    priority:'normal',created_at:new Date().toISOString()},...prev]);
   alert('Demo notice published locally.');
  }else{
   await apiFetch('/api/v1/admin/announcements',{method:'POST',body:JSON.stringify({
    title:noticeTitle,body:noticeBody,priority:'normal'
   })});
   const n=await supabase.from('announcements').select('*').order('created_at',{ascending:false});
   if(n.data)setNotices(n.data);
   alert('Announcement published to the live campus feed.');
  }
  setNoticeTitle('');setNoticeBody('');
 }catch(e){alert(e.message||'Could not publish announcement')}
}
function finishRecovery(){const u=new URL(window.location.href);u.searchParams.delete('auth');u.hash='';window.history.replaceState({},'',u.pathname+u.search);setRecovering(false)}
if(recovering||(!session&&!guest))return <AuthScreen recovery={recovering} onRecoveryComplete={finishRecovery} onRecoveryCancel={finishRecovery}/>;
return <div className="app-shell"><aside className={'sidebar '+(mobile?'mobile-open':'')}><div className="side-brand"><div className="logo-mark"><Layers size={21}/></div><div><strong>IET Grid</strong><span>Campus operations</span></div><button className="mobile-close" onClick={()=>setMobile(false)}><X size={19}/></button></div><div className="side-label">WORKSPACE</div><nav>{menu.map(([n,I])=> <button key={n} className={'nav-item '+(view===n?'active':'')} onClick={()=>{setView(n);setMobile(false)}}><I size={18}/><span>{n}</span>{n==='Announcements'&&<i className="nav-count">{notices.length}</i>}</button>)}</nav><div className="side-bottom"><div className="campus-card"><div className="campus-icon"><Building2 size={19}/></div><b>DDUGU Campus</b><span>Gorakhpur, Uttar Pradesh</span><div className="campus-status"><i/> Campus grid active</div></div><div className="side-profile"><div className="avatar">{(profile?.full_name||session?.user?.email||'Guest').slice(0,1).toUpperCase()}</div><div><b>{profile?.full_name|| (demo?'Demo Faculty':session?.user?.email?.split('@')[0])}</b><span>{demo?'Preview workspace':userRole+' account'}</span></div><button title="Sign out" onClick={()=>{if(demo)setGuest(false);else supabase.auth.signOut();setView('Overview')}}><LogOut size={17}/></button></div></div></aside>
<div className="workarea"><header className="topbar"><div className="topbar-left"><button className="mobile-trigger" onClick={()=>setMobile(true)}><Menu size={20}/></button><span className="breadcrumb">Workspace</span><ChevronRight size={13}/><b>{view}</b></div><div className="topbar-right">{demo&&<span className="demo-label"><Info size={13}/> DEMO DATA</span>}<span className="today-pill"><Clock size={14}/> {new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span><button className="icon-button" onClick={()=>setView('Announcements')}><Bell size={18}/><i/></button><div className="avatar small">{(profile?.full_name||'G').slice(0,1).toUpperCase()}</div></div></header>
<main className="main-content">{!demo&&liveDataError&&<p role="alert" className="form-error">{liveDataError}</p>}<div className="page-intro"><div><div className="eyebrow">IET GRID / {view.toUpperCase()}</div><h1>{view==='Overview'?'Good day, '+(profile?.full_name?.split(' ')[0]||'explorer')+' 👋':view}</h1><p>{view==='Overview'?'One intelligent workspace for your entire campus.':view==='Explore rooms'?'Find the right space, at the right time.':view==='Calendar'?'Your campus, organized in time.':view==='My bookings'?'Track teaching spaces and upcoming reservations.':view==='Announcements'?'Stay informed on the latest academic updates.':'Manage the institution with clarity and control.'}</p></div><div className="intro-actions">{view==='Explore rooms'||view==='Calendar'?<button className="button-primary compact" onClick={()=>setShowBooking(true)}><Plus size={16}/> New booking</button>:<button className="button-outline compact" onClick={()=>setView('Explore rooms')}><Search size={16}/> Find a room</button>}</div></div>
{view==='Overview'&&<><div className="hero-panel"><div className="hero-text"><span className="hero-kicker"><Sparkles size={14}/> INTELLIGENT SPACE MANAGEMENT</span><h2>Your campus,<br/><em>working in sync.</em></h2><p>From spontaneous lectures to packed exam schedules, discover and coordinate available spaces with confidence.</p><button onClick={()=>setView('Explore rooms')}>Explore campus grid <ArrowUpRight size={17}/></button></div><div className="hero-art"><div className="hero-art-ring r1"/><div className="hero-art-ring r2"/><div className="hero-art-ring r3"/><div className="hero-art-core"><Layers size={38}/></div><div className="hero-art-chip chip1"><CheckCircle2 size={15}/> IET19 Available</div><div className="hero-art-chip chip2"><CalendarDays size={15}/> Smart scheduling</div></div></div>
<div className="stats-row"><Stat icon={Building2} label="Campus buildings" value="02" sub="IET & Deeksha Bhawan"/><Stat icon={DoorOpen} label="Mapped spaces" value={rooms.length.toString().padStart(2,'0')} sub="Across 5 campus floors"/><Stat icon={CalendarDays} label="Scheduled events" value={bookings.length.toString().padStart(2,'0')} sub="Currently tracked"/><Stat icon={Sparkles} label="Room recommendations" value={matching.length.toString().padStart(2,'0')} sub="Matching selected criteria"/></div><div className="overview-grid"><section className="panel"><div className="section-head"><div><h3>Upcoming schedule</h3><p>Room activity across the campus</p></div><button className="link-action" onClick={()=>setView('Calendar')}>View calendar <ArrowUpRight size={15}/></button></div><div className="activity-list">{bookings.slice(0,4).map(b=><div className="activity" key={b.id}><div className="activity-date"><b>{new Date(b.starts_at).getDate()}</b><small>{new Date(b.starts_at).toLocaleString('en-IN',{month:'short'})}</small></div><div><b>{b.title}</b><span>{b.room_id} · {fmt(b.starts_at,{hour:'numeric',minute:'2-digit'})}</span></div><IconTag>{b.kind||'lecture'}</IconTag></div>)}</div></section><section className="panel"><div className="section-head"><div><h3>Campus updates</h3><p>Latest academic announcements</p></div><button className="link-action" onClick={()=>setView('Announcements')}>See all <ArrowUpRight size={15}/></button></div><div className="notices-list">{notices.slice(0,3).map(n=><div className="notice" key={n.id}><div className={'notice-ico '+(n.priority==='high'?'urgent':'')}><Bell size={17}/></div><div><b>{n.title}</b><p>{n.body}</p><small>{new Date(n.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</small></div></div>)}</div></section></div></>}
{view==='Explore rooms'&&<div className="explore-layout"><section className="panel map-panel"><div className="toolbar"><div className="segment">{buildings.map(b=><button key={b.id} className={building===b.id?'selected':''} onClick={()=>{setBuilding(b.id);setFloor(b.floors[0]);setSelected('')}}>{b.short}</button>)}</div><div className="select-wrap"><Layers size={15}/><select value={floor} onChange={e=>{setFloor(e.target.value);setSelected('')}}>{buildings.find(b=>b.id===building)?.floors.map(f=><option key={f}>{f}</option>)}</select><ChevronDown size={14}/></div></div><div className="map-controls"><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Time<select value={hour} onChange={e=>setHour(e.target.value)}>{Array.from({length:11},(_,i)=>i+8).map(h=><option value={String(h)} key={h}>{String(h).padStart(2,'0')}:00</option>)}</select></label><label>Duration<select value={duration} onChange={e=>setDuration(Number(e.target.value))}><option value={1}>1 hour</option><option value={2}>2 hours</option><option value={3}>3 hours</option></select></label><label>Min. capacity<select value={capacity} onChange={e=>setCapacity(Number(e.target.value))}><option>30</option><option>75</option><option>150</option><option>200</option></select></label></div><FloorMap rooms={rooms} building={building} floor={floor} selected={selected} onSelect={r=>setSelected(r.id)} getStatus={r=>{const a=apiAvailability?.find(x=>x.id===r.id);return r.id===selected?'selected':!demo&&!apiAvailability?'restricted':a?.reason==='ineligible'?'restricted':!isAvailable(r)?'occupied':r.capacity<capacity?'restricted':'available'}}/>{apiWarning&&<p role="alert" className="form-error">{apiWarning}</p>}<div className="map-under"><span><Info size={15}/> Floor plans show room arrangement schematically; exact scale and some capacities require university verification.</span></div></section>
<aside className="details-stack"><section className="panel detail-panel"><div className="detail-top"><span className="eyebrow">ROOM INSPECTOR</span><DoorOpen size={19}/></div>{current?<><div className="room-title"><h2>{current.id}</h2><span className={'status-chip '+(isAvailable(current)?'ok':'busy')}><i/>{isAvailable(current)?'Available':!demo&&!apiAvailability?'Not verified':'Occupied'}</span></div><p className="muted">{current.building==='IET'?'Institute of Engineering & Technology':'Deeksha Bhawan'} · {current.floor} floor</p><div className="detail-specs"><div><Users size={17}/><span>Capacity</span><b>{current.capacity}{current.verified?'':'*'} seats</b></div><div><Layers size={17}/><span>Room type</span><b>{current.type}</b></div><div><Clock size={17}/><span>Selected slot</span><b>{hour.padStart(2,'0')}:00 · {duration}h</b></div></div><button className="button-primary" disabled={!isAvailable(current)||current.capacity<capacity||!canBook} onClick={()=>setShowBooking(true)}>Reserve this room <ArrowRight size={17}/></button>{!canBook&&<p className="tiny">Your verified faculty account is required to reserve rooms.</p>}<button className="button-outline" onClick={()=>setView('Calendar')}><CalendarDays size={16}/> View in calendar</button></>:<p className="muted">Select a classroom from the floor plan to inspect its availability and details.</p>}</section><section className="panel recommendation-panel"><div className="section-head"><div><h3><Sparkles size={17}/> Smart alternatives</h3><p>Capacity, location and schedule-aware</p></div></div>{matching.slice(0,4).map((r,i)=><button className="recommend-row" key={r.id} onClick={()=>{setBuilding(r.building);setFloor(r.floor);setSelected(r.id)}}><div className="recommend-rank">{String(i+1).padStart(2,'0')}</div><div><b>{r.id}</b><span>{r.building} · {r.floor} floor · {r.capacity} seats</span></div><div className="score">{r.score}%</div><ArrowUpRight size={16}/></button>)}{!matching.length&&<p className="muted">No suitable rooms found. Try another time, capacity or building.</p>}<p className="tiny">Deterministic constraint-based recommendations; scores express relative fit, not AI confidence.</p></section></aside></div>}
{view==='Calendar'&&<section className="panel calendar-panel"><div className="section-head"><div><h3>Campus timetable</h3><p>Weekly room activity · {date}</p></div><div className="calendar-controls"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><button className="button-outline compact" onClick={()=>setDate(initialDate)}>Today</button></div></div><div className="calendar-scroll"><div className="calendar-grid"><div className="cal-corner">TIME</div>{Array.from({length:5},(_,i)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+i);return <div className="cal-day" key={i}><b>{d.toLocaleDateString('en-IN',{weekday:'short'})}</b><span>{d.getDate()}</span></div>})}{Array.from({length:10},(_,i)=>i+8).flatMap(h=>[<div className="cal-hour" key={'h'+h}>{h}:00</div>,...Array.from({length:5},(_,day)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+day);const dateKey=d.toISOString().slice(0,10);const events=calendarBookings.filter(b=>new Date(b.starts_at).toLocaleDateString('en-CA')===dateKey&&new Date(b.starts_at).getHours()===h);return <div className="cal-cell" key={h+'-'+day}>{events.map(b=><button key={b.id} onClick={()=>{const r=rooms.find(x=>x.id===b.room_id);if(r){setBuilding(r.building);setFloor(r.floor);setSelected(r.id);setView('Explore rooms')}}} className="cal-event"><strong>{b.room_id}</strong><span>{b.title}</span></button>)}</div>})])}</div></div><p className="tiny calendar-foot">Select an event to locate its classroom in the spatial view. Scheduled times display in your device timezone.</p></section>}
{view==='My bookings'&&<section className="panel"><div className="section-head"><div><h3>Booking registry</h3><p>Confirmed reservations and academic events</p></div><button className="button-primary compact" onClick={()=>setView('Explore rooms')}><Plus size={16}/> New reservation</button></div><div className="table-wrap"><table><thead><tr><th>Reservation</th><th>Room</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>{bookings.map(b=><tr key={b.id}><td><b>{b.title}</b><span className="table-sub">{b.kind||'lecture'}</span></td><td>{b.room_id}</td><td>{new Date(b.starts_at).toLocaleDateString('en-IN')}</td><td>{fmt(b.starts_at,{hour:'numeric',minute:'2-digit'})} – {fmt(b.ends_at,{hour:'numeric',minute:'2-digit'})}</td><td><span className="status-chip ok"><i/>{b.status}</span></td></tr>)}</tbody></table></div></section>}
{view==='Announcements'&&<section className="panel"><div className="section-head"><div><h3>Academic announcements</h3><p>Official updates and critical schedule information</p></div></div><div className="announcements">{notices.map(n=><article className="announcement" key={n.id}><div className={'notice-ico '+(n.priority==='high'?'urgent':'')}><Bell size={18}/></div><div><div className="announcement-title"><h3>{n.title}</h3>{n.priority==='high'&&<span className="priority-badge">IMPORTANT</span>}</div><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString('en-IN')}</small></div></article>)}</div><div className="report-bar"><div><b>Something incorrect in your schedule?</b><p>Students can flag outdated information for review.</p></div><button className="button-outline compact" onClick={()=>setReport(true)}>Report an issue</button></div></section>}
{view==='Admin'&&<div className="admin-layout"><section className="panel"><div className="section-head"><div><h3>Operational controls</h3><p>Scoped campus administration</p></div><IconTag>{canAdmin?'Admin preview':'Restricted access'}</IconTag></div>{canAdmin?<><div className="admin-stats"><div><b>{rooms.length}</b><span>Rooms inventoried</span></div><div><b>{bookings.length}</b><span>Bookings on record</span></div><div><b>{notices.length}</b><span>Announcements</span></div></div><h4>Publish an announcement</h4><label className="field-label">Announcement title<input value={noticeTitle} onChange={e=>setNoticeTitle(e.target.value)} placeholder="e.g. Examination room change"/></label><label className="field-label">Message<textarea rows="3" value={noticeBody} onChange={e=>setNoticeBody(e.target.value)} placeholder="Provide the corrected schedule or important update"/></label><button className="button-primary compact" onClick={addNotice}><Send size={16}/> Publish announcement</button></>:<div className="empty-state"><Lock size={26}/><h3>Administrator access required</h3><p>Only verified coordinators and university administrators can publish official notices.</p></div>}</section><section className="panel"><div className="section-head"><div><h3>System health</h3><p>Deployment and integration status</p></div></div><div className="health-list"><div><span>Application</span><b className="health-good"><Check size={16}/> Online</b></div><div><span>Database connection</span><b className={demo?'health-warn':'health-good'}>{demo?'Demo / not connected':'Supabase configured'}</b></div><div><span>Availability rules</span><b className="health-good"><Check size={16}/> Active</b></div><div><span>Institutional dataset</span><b className="health-warn">Awaiting verified import</b></div></div></section></div>}
</main></div>{mobile&&<div className="mobile-backdrop" onClick={()=>setMobile(false)}/>}
{showBooking&&<div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShowBooking(false)}}><section className="modal"><div className="modal-head"><div><div className="eyebrow">CAMPUS RESERVATION</div><h2>Reserve a classroom</h2></div><button onClick={()=>setShowBooking(false)}><X size={20}/></button></div><p className="muted">Bookings are validated against existing room reservations before confirmation.</p><div className="booking-summary"><div><small>ROOM</small><b>{selected||'No room selected'}</b></div><div><small>DATE</small><b>{date}</b></div><div><small>TIME</small><b>{hour.padStart(2,'0')}:00 · {duration}h</b></div></div><label className="field-label">Session title<input value={bookingTitle} onChange={e=>setBookingTitle(e.target.value)}/></label><label className="field-label">Booking type<select value={bookingKind} onChange={e=>setBookingKind(e.target.value)}><option value="lecture">Extra lecture</option><option value="exam">Examination</option><option value="practical">Practical session</option><option value="event">Academic event</option></select></label><div className="modal-actions"><button className="button-outline compact" onClick={()=>setShowBooking(false)}>Cancel</button><button className="button-primary compact" disabled={loading||!current||!canBook} onClick={doBook}>{loading?'Saving…':'Confirm reservation'} <ArrowRight size={16}/></button></div><p className="tiny">Exam and event requests may be queued for administrator approval in connected mode.</p></section></div>}
{report&&<div className="modal-overlay"><section className="modal"><div className="modal-head"><h2>Report an issue</h2><button onClick={()=>setReport(false)}><X/></button></div><p className="muted">Flag incorrect or outdated schedule information. This will not modify official bookings.</p><button className="button-primary" onClick={submitReport}>Submit schedule report</button></section></div>}
{toast&&<div className="toast"><Info size={17}/>{toast}<button onClick={()=>setToast('')}><X size={15}/></button></div>}</div>
}
function Stat({icon:Icon,label,value,sub}){return <div className="stat-card"><div className="stat-icon"><Icon size={18}/></div><span>{label}</span><b>{value}</b><small>{sub}</small></div>}
