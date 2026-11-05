
import React,{useState,useEffect,useMemo} from 'react';
import {LayoutDashboard,CalendarDays,Map as MapIcon,BookOpen,GraduationCap,Shield,Settings,Search,Bell,ChevronDown,ChevronLeft,ChevronRight,Plus,ArrowUpRight,Clock,Users,CheckCircle2,AlertTriangle,LogOut,Lock,Building2,Layers,PanelLeftClose,Command,Filter,MapPin,Sparkles,ArrowRight,DoorOpen,Check,Menu,X,Info,Send,BookMarked,RefreshCcw} from 'lucide-react';
import {supabase,configured} from './supabase';
import AuthScreen from './components/AuthScreen';
import {OverviewPage,ExplorePage,CalendarPage,BookingsPage,AnnouncementsPage,AdminPage} from './components/WorkspacePages';
import {buildings,sampleRooms,demoBookings,demoNotices,localDate,occupancy,recommend,dateTimes} from './data';
const initialDate=localDate();
const menu=[['Overview',LayoutDashboard],['Explore rooms',MapIcon],['Calendar',CalendarDays],['My bookings',BookOpen],['Announcements',Bell],['Admin',Shield]];
const fmt=(v,opts)=>new Date(v).toLocaleString('en-IN',opts||{hour:'numeric',minute:'2-digit'});
function IconTag({children}){return <span className="tag">{children}</span>}
export default function App(){
const [session,setSession]=useState(null);const [recovering,setRecovering]=useState(()=>new URLSearchParams(window.location.search).get('auth')==='reset');const [guest,setGuest]=useState(false);const [profile,setProfile]=useState(null);const [rooms,setRooms]=useState(configured?[]:sampleRooms);const [bookings,setBookings]=useState(configured?[]:demoBookings);const [notices,setNotices]=useState(configured?[]:demoNotices);const [view,setView]=useState('Overview');const [building,setBuilding]=useState('IET');const [floor,setFloor]=useState('First');const [date,setDate]=useState(initialDate);const [hour,setHour]=useState('11');const [duration,setDuration]=useState(1);const [capacity,setCapacity]=useState(75);const [selected,setSelected]=useState('IET19');const [toast,setToast]=useState('');const [loading,setLoading]=useState(false);const [mobile,setMobile]=useState(false);const [showBooking,setShowBooking]=useState(false);const [bookingTitle,setBookingTitle]=useState('Extra lecture');const [bookingKind,setBookingKind]=useState('lecture');const [report,setReport]=useState(false);const [noticeTitle,setNoticeTitle]=useState('');const [noticeBody,setNoticeBody]=useState('');
const [noticePriority,setNoticePriority]=useState('normal');
const [noticeBusy,setNoticeBusy]=useState(false);
const [pendingQueue,setPendingQueue]=useState([]);
const [pendingLoading,setPendingLoading]=useState(false);
const [pendingError,setPendingError]=useState('');
const [reviewBusy,setReviewBusy]=useState('');
const [accountUuid,setAccountUuid]=useState('');
const [accountRole,setAccountRole]=useState('faculty');
const [accountBusy,setAccountBusy]=useState(false);
const [noticeReadBusy,setNoticeReadBusy]=useState('');

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

useEffect(()=>{
 if(demo||!session?.access_token||view!=='Admin'||!canAdmin){setPendingQueue([]);setPendingError('');return;}
 let disposed=false;
 setPendingLoading(true);setPendingError('');
 apiFetch('/api/v1/bookings/pending').then(data=>{if(!disposed)setPendingQueue(data.bookings||[]);})
  .catch(err=>{if(!disposed){setPendingQueue([]);setPendingError('Unable to load pending requests: '+err.message);}})
  .finally(()=>{if(!disposed)setPendingLoading(false);});
 return()=>{disposed=true;};
},[demo,view,canAdmin,session?.access_token,refreshTick]);
useEffect(()=>{
 if(demo||!session?.access_token)return;
 let disposed=false;
 apiFetch('/api/v1/announcements').then(data=>{if(!disposed)setNotices(data.announcements||[]);})
 .catch(()=>{});
 return()=>{disposed=true;};
},[demo,session?.access_token,refreshTick]);
async function reviewPendingBooking(booking,approve){
 if(demo)return alert('Approval actions require a signed-in administrator.');
 if(reviewBusy)return;
 setReviewBusy(booking.id);
 try{
   await apiFetch('/api/v1/admin/bookings/'+encodeURIComponent(booking.id)+'/review',{
     method:'POST',body:JSON.stringify({approve})});
   setPendingQueue(current=>current.filter(item=>item.id!==booking.id));
   const [bookingsResponse,noticeResponse]=await Promise.all([
     supabase.from('bookings').select('*').order('starts_at'),
     apiFetch('/api/v1/announcements')
   ]);
   if(bookingsResponse.error)throw bookingsResponse.error;
   setBookings(bookingsResponse.data||[]);
   setNotices(noticeResponse.announcements||[]);
   setRefreshTick(n=>n+1);
   alert(approve?'Request approved. Exam/event notices are published automatically.':'Request rejected; no room was reserved.');
 }catch(err){
   setRefreshTick(n=>n+1);
   alert('Review could not be fully refreshed: '+(err.message||String(err)));
 }finally{setReviewBusy('');}
}
async function grantTestRole(){
 if(demo)return alert('Role provisioning requires a live administrator.');
 if(accountBusy)return;
 const id=accountUuid.trim();
 if(!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(id))
   return alert('Enter a valid existing Supabase Auth user UUID.');
 if(!['faculty','student'].includes(accountRole))return alert('Only faculty or student test roles are supported.');
 if(session?.user?.id?.toLowerCase()===id.toLowerCase())return alert('Use a separate registered account, not your administrator identity.');
 setAccountBusy(true);
 try{
  await apiFetch('/api/v1/admin/users/'+encodeURIComponent(id)+'/role',{
    method:'POST',body:JSON.stringify({role:accountRole,verified:true})});
  setAccountUuid('');
  alert('Existing confirmed user provisioned as '+accountRole+'. The user can now sign in to test role restrictions.');
 }catch(err){alert('Unable to provision account: '+(err.message||String(err)));}
 finally{setAccountBusy(false);}
}
async function markNoticeRead(noticeId){
 if(demo||noticeReadBusy)return;
 setNoticeReadBusy(noticeId);
 try{
  await apiFetch('/api/v1/announcements/'+encodeURIComponent(noticeId)+'/read',{method:'POST'});
  setNotices(items=>items.map(n=>n.id===noticeId?{...n,read_at:new Date().toISOString()}:n));
 }catch(err){alert('Could not mark notice as read: '+(err.message||String(err)));}
 finally{setNoticeReadBusy('');}
}

async function doBook(){
 if(!current)return;
 if(!isAvailable(current))return alert('This room is not verified as available at that time.');
 if(current.capacity<capacity)return alert('Requested capacity exceeds room size.');
 setLoading(true);let success=false;
 const title=bookingTitle.trim()||'Extra lecture';
 try{
  if(demo){
   setBookings(prev=>[...prev,{id:'local-'+Date.now(),room_id:current.id,title,
    starts_at:start,ends_at:end,status:['exam','event'].includes(bookingKind)?'pending':'confirmed',kind:bookingKind}]);
   alert(['exam','event'].includes(bookingKind)?'Demo request pending approval (local only). Not saved to university records.':'Demo reservation added locally. Not saved to university records.');
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
 if(noticeBusy)return;
 if(!canAdmin)return alert('Verified administrator access is required.');
 if(noticeTitle.trim().length<3)return alert('Announcement title must be at least 3 characters.');
 setNoticeBusy(true);
 try{
  if(demo){
   setNotices(prev=>[{id:'local-'+Date.now(),title:noticeTitle.trim(),body:noticeBody,
    priority:noticePriority,created_at:new Date().toISOString()},...prev]);
   alert('Preview only: announcement was not persisted.');
  }else{
   await apiFetch('/api/v1/admin/announcements',{method:'POST',body:JSON.stringify({
    title:noticeTitle.trim(),body:noticeBody,priority:noticePriority
   })});
   alert('Official announcement published to the campus feed.');
   try{
     const response=await apiFetch('/api/v1/announcements');
     setNotices(response.announcements||[]);
   }catch(err){alert('Notice published, but feed refresh failed: '+err.message);}
   setRefreshTick(n=>n+1);
  }
  setNoticeTitle('');setNoticeBody('');setNoticePriority('normal');
 }catch(err){alert('Announcement could not be published: '+(err.message||String(err)));}
 finally{setNoticeBusy(false);}
}
useEffect(()=>{
  if(!showBooking&&!report)return;
  const keydown=(e)=>{if(e.key==='Escape'){setShowBooking(false);setReport(false);}};
  document.addEventListener('keydown',keydown);
  return ()=>document.removeEventListener('keydown',keydown);
},[showBooking,report]);
function finishRecovery(){const u=new URL(window.location.href);u.searchParams.delete('auth');u.hash='';window.history.replaceState({},'',u.pathname+u.search);setRecovering(false)}
function openRoomAt(roomId,startIso){
  const room=rooms.find(r=>r.id===roomId);
  if(!room){setView('Calendar');return;}
  setBuilding(room.building);setFloor(room.floor);setSelected(room.id);
  if(startIso){
    const instant=new Date(startIso);
    setDate(instant.toLocaleDateString('sv-SE',{timeZone:'Asia/Kolkata'}));
    setHour(String(Number(instant.toLocaleTimeString('en-GB',{hour:'2-digit',hour12:false,timeZone:'Asia/Kolkata'}))));
  }
  setView('Explore rooms');
}
if(recovering||(!session&&!guest))return <AuthScreen recovery={recovering} onRecoveryComplete={finishRecovery} onRecoveryCancel={finishRecovery}/>;
return <div className="app-shell"><aside className={'sidebar '+(mobile?'mobile-open':'')}><div className="side-brand"><div className="logo-mark"><Layers size={21}/></div><div><strong>IET Grid</strong><span>Campus operations</span></div><button className="mobile-close" onClick={()=>setMobile(false)}><X size={19}/></button></div><div className="side-label">WORKSPACE</div><nav>{menu.filter(([n])=>n!=='Admin'||canAdmin).map(([n,I])=> <button key={n} className={'nav-item '+(view===n?'active':'')} onClick={()=>{setView(n);setMobile(false)}}><I size={18}/><span>{n}</span>{n==='Announcements'&&<i className="nav-count">{notices.length}</i>}</button>)}</nav><div className="side-bottom"><div className="campus-card"><div className="campus-icon"><Building2 size={19}/></div><b>DDUGU Campus</b><span>Gorakhpur, Uttar Pradesh</span><div className="campus-status"><i/> Floor plans schematic</div></div><div className="side-profile"><div className="avatar">{(profile?.full_name||session?.user?.email||'Guest').slice(0,1).toUpperCase()}</div><div><b>{profile?.full_name|| (demo?'Demo Faculty':session?.user?.email?.split('@')[0])}</b><span>{demo?'Preview workspace':userRole+' account'}</span></div><button title="Sign out" onClick={()=>{if(demo)setGuest(false);else supabase.auth.signOut();setView('Overview')}}><LogOut size={17}/></button></div></div></aside>
<div className="workarea"><header className="topbar"><div className="topbar-left"><button className="mobile-trigger" onClick={()=>setMobile(true)}><Menu size={20}/></button><span className="breadcrumb">Workspace</span><ChevronRight size={13}/><b>{view}</b></div><div className="topbar-right">{demo&&<span className="demo-label"><Info size={13}/> DEMO DATA</span>}<span className="today-pill"><Clock size={14}/> {new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span><button className="icon-button" onClick={()=>setView('Announcements')}><Bell size={18}/><i/></button><div className="avatar small">{(profile?.full_name||'G').slice(0,1).toUpperCase()}</div></div></header>
<main className="main-content">
  {!demo&&liveDataError&&<p role="alert" className="form-error">{liveDataError}</p>}
  <div className="page-intro"><div><div className="eyebrow">IET GRID / {view.toUpperCase()}</div>
    <h1>{view==='Overview'?'Campus overview':view}</h1>
    <p>{view==='Overview'?'Classrooms, bookings, and academic updates in one workspace.':
      view==='Explore rooms'?'Select a building, check a time slot, and inspect available classrooms.':
      view==='Calendar'?'A connected view of room allocations and teaching schedules.':
      view==='My bookings'?'Review reservations, pending approvals, and your visible booking history.':
      view==='Announcements'?'Official university notices and timetable changes.':
      'Campus operations and institutional controls.'}</p></div>
    {view!=='Admin'&&<div className="intro-actions"><button className="button-primary compact" type="button" onClick={()=>setView('Explore rooms')}>
      <Search size={16}/> Find a room</button></div>}
  </div>
  {view==='Overview'&&<OverviewPage rooms={rooms} bookings={bookings} notices={notices}
    matching={matching} buildings={buildings} selected={selected} setSelected={setSelected}
    setBuilding={setBuilding} setFloor={setFloor} setView={setView} demo={demo}
    apiAvailability={apiAvailability} isAvailable={isAvailable} canBook={canBook} date={date} hour={hour} duration={duration} capacity={capacity}/>}
  {view==='Explore rooms'&&<ExplorePage buildings={buildings} rooms={rooms} building={building}
    setBuilding={setBuilding} floor={floor} setFloor={setFloor} selected={selected} setSelected={setSelected}
    date={date} setDate={setDate} hour={hour} setHour={setHour} duration={duration}
    setDuration={setDuration} capacity={capacity} setCapacity={setCapacity}
    apiAvailability={apiAvailability} apiWarning={apiWarning} isAvailable={isAvailable}
    matching={matching} current={current} canBook={canBook}
    setShowBooking={setShowBooking} setView={setView} demo={demo}/>}
  {view==='Calendar'&&<CalendarPage date={date} setDate={setDate} initialDate={initialDate}
    calendarBookings={calendarBookings} rooms={rooms} onOpenRoom={openRoomAt}/>}
  {view==='My bookings'&&<BookingsPage bookings={bookings} rooms={rooms}
    setView={setView} onOpenRoom={openRoomAt}/>}
  {view==='Announcements'&&<AnnouncementsPage notices={notices} demo={demo}
    markNoticeRead={markNoticeRead} noticeReadBusy={noticeReadBusy} setReport={setReport}/>}
  {view==='Admin'&&<AdminPage canAdmin={canAdmin} demo={demo} userRole={userRole}
    rooms={rooms} bookings={bookings} notices={notices} noticeTitle={noticeTitle}
    setNoticeTitle={setNoticeTitle} noticeBody={noticeBody} setNoticeBody={setNoticeBody}
    noticePriority={noticePriority} setNoticePriority={setNoticePriority}
    noticeBusy={noticeBusy} addNotice={addNotice} pendingQueue={pendingQueue}
    pendingLoading={pendingLoading} pendingError={pendingError}
    reviewBusy={reviewBusy} reviewPendingBooking={reviewPendingBooking}
    setRefreshTick={setRefreshTick} accountUuid={accountUuid} setAccountUuid={setAccountUuid}
    accountRole={accountRole} setAccountRole={setAccountRole} accountBusy={accountBusy}
    grantTestRole={grantTestRole} apiWarning={apiWarning} apiAvailability={apiAvailability}/>}
</main></div>{mobile&&<div className="mobile-backdrop" onClick={()=>setMobile(false)}/>}
{showBooking&&<div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShowBooking(false)}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="ig-booking-title"><div className="modal-head"><div><div className="eyebrow">CAMPUS RESERVATION</div><h2 id="ig-booking-title">Reserve a classroom</h2></div><button onClick={()=>setShowBooking(false)}><X size={20}/></button></div><p className="muted">Bookings are validated against existing room reservations before confirmation.</p><div className="booking-summary"><div><small>ROOM</small><b>{selected||'No room selected'}</b></div><div><small>DATE</small><b>{date}</b></div><div><small>TIME</small><b>{hour.padStart(2,'0')}:00 · {duration}h</b></div></div><label className="field-label">Session title<input value={bookingTitle} onChange={e=>setBookingTitle(e.target.value)}/></label><label className="field-label">Booking type<select value={bookingKind} onChange={e=>setBookingKind(e.target.value)}><option value="lecture">Extra lecture</option><option value="exam">Examination</option><option value="practical">Practical session</option><option value="event">Academic event</option></select></label><div className="modal-actions"><button className="button-outline compact" onClick={()=>setShowBooking(false)}>Cancel</button><button className="button-primary compact" disabled={loading||!current||!canBook||!isAvailable(current)||current.capacity<capacity} onClick={doBook}>{loading?'Saving…':'Confirm reservation'} <ArrowRight size={16}/></button></div><p className="tiny">Exam and event requests may be queued for administrator approval in connected mode.</p></section></div>}
{report&&<div className="modal-overlay"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="ig-report-title"><div className="modal-head"><h2 id="ig-report-title">Report an issue</h2><button onClick={()=>setReport(false)}><X/></button></div><p className="muted">Flag incorrect or outdated schedule information. This will not modify official bookings.</p><button className="button-primary" onClick={submitReport}>Submit schedule report</button></section></div>}
{toast&&<div className="toast"><Info size={17}/>{toast}<button onClick={()=>setToast('')}><X size={15}/></button></div>}</div>
}
function Stat({icon:Icon,label,value,sub}){return <div className="stat-card"><div className="stat-icon"><Icon size={18}/></div><span>{label}</span><b>{value}</b><small>{sub}</small></div>}
