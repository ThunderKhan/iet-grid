
import React,{useState,useEffect,useMemo} from 'react';
import {CalendarDays,Map as MapIcon,BookOpen,Shield,Bell,AlertTriangle,Check,X,Info,RefreshCcw} from 'lucide-react';
import {supabase,configured} from './supabase';
import AuthScreen from './components/AuthScreen';
import TopNavigation from './components/TopNavigation';
import ProfilePage from './components/ProfilePage';
import {CalendarPage,BookingsPage,AnnouncementsPage,AdminPage} from './components/WorkspacePages';
import CampusExperience from './components/CampusExperience';
import ReservationDialog from './components/ReservationDialog';
import {branchLabel} from './academicCohorts';
import {getActiveRoomSessions} from './currentSessions';
import {buildings,localDate,dateTimes} from './data';
const initialDate=localDate();
const menu=[['Explore rooms',MapIcon],['Calendar',CalendarDays],['My bookings',BookOpen],['Announcements',Bell],['Admin',Shield]];
export default function App(){
const [session,setSession]=useState(null);const [authReady,setAuthReady]=useState(!configured);const [recovering,setRecovering]=useState(()=>new URLSearchParams(window.location.search).get('auth')==='reset');const [profile,setProfile]=useState(null);const [rooms,setRooms]=useState([]);const [bookings,setBookings]=useState([]);const [notices,setNotices]=useState([]);const [view,setView]=useState('Explore rooms');const [building,setBuilding]=useState('IET');const [floor,setFloor]=useState('First');const [date,setDate]=useState(initialDate);const [hour,setHour]=useState('11');const [duration,setDuration]=useState(1);const [capacity,setCapacity]=useState(75);const [requiredEquipment,setRequiredEquipment]=useState('');const [selected,setSelected]=useState('IET19');const [toast,setToast]=useState('');const [loading,setLoading]=useState(false);const [showBooking,setShowBooking]=useState(false);const [bookingTitle,setBookingTitle]=useState('Extra lecture');const [bookingKind,setBookingKind]=useState('lecture');const [report,setReport]=useState(false);const [noticeTitle,setNoticeTitle]=useState('');const [noticeBody,setNoticeBody]=useState('');
const [cohorts,setCohorts]=useState([]);
const [cohortId,setCohortId]=useState('');
const [cohortError,setCohortError]=useState('');
const [noticePriority,setNoticePriority]=useState('normal');
const [avatarUrl,setAvatarUrl]=useState('');
const [noticeBusy,setNoticeBusy]=useState(false);
const [pendingQueue,setPendingQueue]=useState([]);
const [pendingLoading,setPendingLoading]=useState(false);
const [pendingError,setPendingError]=useState('');
const [reviewBusy,setReviewBusy]=useState('');
const [accountUuid,setAccountUuid]=useState('');
const [accountRole,setAccountRole]=useState('faculty');
const [accountBusy,setAccountBusy]=useState(false);
const [noticeReadBusy,setNoticeReadBusy]=useState('');
const [bookingBusy,setBookingBusy]=useState('');

const chosenCohort=cohorts.find(c=>c.id===cohortId)||null;
const [liveDataError,setLiveDataError]=useState('');
const [inventoryLoading,setInventoryLoading]=useState(true);
const [inventoryRetry,setInventoryRetry]=useState(0);
const API_BASE=import.meta.env.VITE_API_BASE_URL||'';
const [apiAvailability,setApiAvailability]=useState(null);
const [apiRecommendations,setApiRecommendations]=useState([]);
const [apiWarning,setApiWarning]=useState('');
const [refreshTick,setRefreshTick]=useState(0);
const [auditRows,setAuditRows]=useState([]);
const [auditTotal,setAuditTotal]=useState(0);
const [auditOffset,setAuditOffset]=useState(0);
const [auditRoom,setAuditRoom]=useState('');
const [auditAction,setAuditAction]=useState('');
const [auditLoading,setAuditLoading]=useState(false);
const [auditError,setAuditError]=useState('');
async function apiFetch(route,opts={}){
 if(!API_BASE||!session?.access_token)throw new Error('IET Grid API or sign-in is unavailable');
 const response=await fetch(API_BASE.replace(/\/$/,'')+route,{
   ...opts,headers:{'Authorization':'Bearer '+session.access_token,
   'Content-Type':'application/json',...(opts.headers||{})}});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data?.error?.message||data?.detail||'Backend request failed');
 return data;
}
async function importCohorts(csv,dryRun=true){
  const result=await apiFetch('/api/v1/admin/cohorts/import?dry_run='+String(dryRun),{
    method:'POST',headers:{'Content-Type':'text/csv'},body:csv
  });
  if(!dryRun){
    const data=await apiFetch('/api/v1/cohorts');
    setCohorts((data.cohorts||[]).filter(c=>c.active!==false&&c.id));
    setRefreshTick(n=>n+1);
  }
  return result;
}
useEffect(()=>{
  if(!session?.access_token){setCohorts([]);setCohortError('');return;}
  let cancelled=false;
  setCohortError('');
  apiFetch('/api/v1/cohorts').then(data=>{
    if(cancelled)return;
    const listed=(data.cohorts||[]).filter(c=>c.active!==false&&c.id);
    setCohorts(listed);
    setCohortId(id=>listed.some(c=>c.id===id)?id:'');
  }).catch(error=>{
    if(!cancelled){setCohorts([]);setCohortError('Academic groups unavailable: '+error.message)}
  });
  return ()=>{cancelled=true};
},[session?.access_token]);
useEffect(()=>{
 if(!configured)return;
 let active=true;
 supabase.auth.getSession()
   .then(({data})=>{if(active)setSession(data.session||null)})
   .catch(()=>{if(active)setSession(null)})
   .finally(()=>{if(active)setAuthReady(true)});
 const {data:{subscription}}=supabase.auth.onAuthStateChange((_,nextSession)=>{
   if(active){setSession(nextSession);setAuthReady(true)}
 });
 return()=>{active=false;subscription.unsubscribe()};
},[]);
useEffect(()=>{
 if(!session)return;
 let ignore=false;
 // A new login must not temporarily display the previous account's profile.
 setProfile(null);
 // Always load records authorized for the active signed-in account.
 setRooms([]);setBookings([]);setNotices([]);setLiveDataError('');setInventoryLoading(true);
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
    setLiveDataError('Some campus records could not be loaded. Check your connection before relying on the schedule.');
  }catch(_error){
   if(!ignore){setRooms([]);setBookings([]);setNotices([]);
    setLiveDataError('Campus records could not be loaded from Supabase. Check your connection and try again.');}
  }finally{
    if(!ignore)setInventoryLoading(false);
  }
 })();
 return()=>{ignore=true};
},[session?.user?.id,session?.access_token,inventoryRetry]);
// Avatar files are private. Only the owner can create a short-lived signed URL.
useEffect(()=>{
  if(!session?.user?.id||!profile?.avatar_path){setAvatarUrl('');return;}
  let cancelled=false;
  const path=profile.avatar_path;
  const refresh=async()=>{
    const {data,error}=await supabase.storage.from('iet-profile-avatars').createSignedUrl(path,3600);
    if(!cancelled)setAvatarUrl(error?'':data?.signedUrl||'');
  };
  setAvatarUrl('');
  refresh();
  const timer=window.setInterval(refresh,45*60*1000);
  return()=>{cancelled=true;window.clearInterval(timer);};
},[session?.user?.id,profile?.avatar_path]);
function alert(msg){setToast(msg);setTimeout(()=>setToast(''),4000)}
const {start,end}=useMemo(()=>dateTimes(date,hour,duration),[date,hour,duration]);
useEffect(()=>{
 if(!session?.access_token)return;
 let disposed=false;
 setApiAvailability(null);setApiRecommendations([]);setApiWarning('');
 const query='start='+encodeURIComponent(start)+'&end='+encodeURIComponent(end)+
 '&capacity='+encodeURIComponent(capacity)+'&kind='+encodeURIComponent(bookingKind)+
 '&equipment='+encodeURIComponent(requiredEquipment);
 Promise.all([apiFetch('/api/v1/availability?'+query),
   apiFetch('/api/v1/recommendations?'+query+'&building='+encodeURIComponent(building))])
   .then(([availability,recs])=>{if(disposed)return;
     setApiAvailability(availability.rooms||[]);
     setApiRecommendations(recs.recommendations||[]);
   })
   .catch(e=>{if(disposed)return;setApiAvailability(null);setApiRecommendations([]);
     setApiWarning('The availability check failed: '+e.message)});
 return()=>{disposed=true};
},[session?.access_token,start,end,capacity,building,bookingKind,requiredEquipment,refreshTick]);
const [liveCalendar,setLiveCalendar]=useState([]);
const [calendarLoading,setCalendarLoading]=useState(false);
const [calendarError,setCalendarError]=useState('');
const [currentTimeMs,setCurrentTimeMs]=useState(()=>Date.now());
const [runningAllocations,setRunningAllocations]=useState([]);
const [runningScheduleStatus,setRunningScheduleStatus]=useState('loading');
useEffect(()=>{
 if(!session?.access_token)return;
 let disposed=false;setLiveCalendar([]);setCalendarLoading(true);setCalendarError('');
 const first=new Date(date+'T00:00:00');
 const last=new Date(first.getTime()+7*86400000);
 apiFetch('/api/v1/calendar?start='+encodeURIComponent(first.toISOString())+
 '&end='+encodeURIComponent(last.toISOString()))
 .then(data=>{if(!disposed)setLiveCalendar((data.events||[]).map(e=>({
   id:e.id,room_id:e.room_id,title:e.title,kind:e.source_type,
   starts_at:e.start,ends_at:e.end,status:'confirmed'
 })))})
 .catch(error=>{
   if(!disposed){setLiveCalendar([]);
     setCalendarError('The campus timetable could not be loaded: '+(error?.message||'network error'));}
 }).finally(()=>{if(!disposed)setCalendarLoading(false)});
 return()=>{disposed=true};
},[session?.access_token,date,refreshTick]);
// Running sessions are independent of the reservation time being browsed.
// The calendar API already applies RLS and redacts inaccessible titles.
useEffect(()=>{
  if(!session?.access_token||view!=='Explore rooms'){
    setRunningAllocations([]);setRunningScheduleStatus('unavailable');return;
  }
  let cancelled=false;
  let busy=false;
  setRunningAllocations([]);
  setRunningScheduleStatus('loading');
  const reload=async()=>{
    if(cancelled||busy||document.hidden)return;
    busy=true;
    const now=Date.now();
    const startTime=new Date(now-8*3600000).toISOString();
    const endTime=new Date(now+8*3600000).toISOString();
    try{
      const response=await apiFetch('/api/v1/calendar?start='+encodeURIComponent(startTime)
        +'&end='+encodeURIComponent(endTime));
      if(!Array.isArray(response?.events))throw new Error('Unrecognized live schedule response');
      if(!cancelled){
        setRunningAllocations((response.events||[]).map(event=>({
          id:event.id,room_id:event.room_id,title:event.title,
          starts_at:event.start,ends_at:event.end,
          details_visible:event.details_visible,kind:event.source_type,
          status:'confirmed',
        })));
        setRunningScheduleStatus('ready');
        setCurrentTimeMs(Date.now());
      }
    }catch{
      if(!cancelled){setRunningAllocations([]);setRunningScheduleStatus('unavailable');}
    }finally{busy=false;}
  };
  const tick=()=>setCurrentTimeMs(Date.now());
  const onVisible=()=>{if(!document.hidden){tick();reload();}};
  reload();
  const polling=window.setInterval(()=>{tick();reload();},60000);
  document.addEventListener('visibilitychange',onVisible);
  return()=>{cancelled=true;window.clearInterval(polling);
    document.removeEventListener('visibilitychange',onVisible);};
},[session?.access_token,view,refreshTick]);
const activeSessions=useMemo(()=>getActiveRoomSessions(runningAllocations,currentTimeMs),
  [runningAllocations,currentTimeMs]);
const nowScheduleState=runningScheduleStatus;
const calendarBookings=liveCalendar;
const current=rooms.find(r=>r.id===selected);
const isAvailable=r=>apiAvailability?.some(x=>x.id===r.id&&x.available===true)===true;
const matching=apiRecommendations;
const userRole=profile?.role||'student';
const canBook=['faculty','coordinator','admin'].includes(userRole)&&profile?.verified===true;
const canAdmin=['coordinator','admin'].includes(userRole)&&profile?.verified===true;

useEffect(()=>{
  if(!session?.access_token||view!=='Admin'||!canAdmin){
    setAuditRows([]);setAuditTotal(0);setAuditError('');return;
  }
  let ignore=false;
  setAuditLoading(true);setAuditError('');
  const params=new URLSearchParams({limit:'20',offset:String(auditOffset)});
  if(auditRoom.trim())params.set('room_id',auditRoom.trim().toUpperCase());
  if(auditAction)params.set('action',auditAction);
  apiFetch('/api/v1/admin/audit?'+params.toString()).then(data=>{
    if(!ignore){setAuditRows(data.events||[]);setAuditTotal(data.total||0);}
  }).catch(err=>{
    if(!ignore){setAuditRows([]);setAuditTotal(0);setAuditError('Audit history could not be loaded: '+err.message);}
  }).finally(()=>{if(!ignore)setAuditLoading(false)});
  return()=>{ignore=true;};
},[session?.access_token,view,canAdmin,auditOffset,auditRoom,auditAction,refreshTick]);


useEffect(()=>{
 if(!session?.access_token||view!=='Admin'||!canAdmin){setPendingQueue([]);setPendingError('');return;}
 let disposed=false;
 setPendingLoading(true);setPendingError('');
 apiFetch('/api/v1/bookings/pending').then(data=>{if(!disposed)setPendingQueue(data.bookings||[]);})
  .catch(err=>{if(!disposed){setPendingQueue([]);setPendingError('Unable to load pending requests: '+err.message);}})
  .finally(()=>{if(!disposed)setPendingLoading(false);});
 return()=>{disposed=true;};
},[view,canAdmin,session?.access_token,refreshTick]);
useEffect(()=>{
 if(!session?.access_token)return;
 let disposed=false;
 apiFetch('/api/v1/announcements').then(data=>{if(!disposed)setNotices(data.announcements||[]);})
 .catch(()=>{});
 return()=>{disposed=true;};
},[session?.access_token,refreshTick]);
async function reviewPendingBooking(booking,approve){
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
 if(noticeReadBusy)return;
 setNoticeReadBusy(noticeId);
 try{
  await apiFetch('/api/v1/announcements/'+encodeURIComponent(noticeId)+'/read',{method:'POST'});
  setNotices(items=>items.map(n=>n.id===noticeId?{...n,read_at:new Date().toISOString()}:n));
 }catch(err){alert('Could not mark notice as read: '+(err.message||String(err)));}
 finally{setNoticeReadBusy('');}
}

async function mutateExistingBooking(booking,action,body){
 if(bookingBusy)return;
 setBookingBusy(booking.id);
 try{
   await apiFetch('/api/v1/bookings/'+encodeURIComponent(booking.id)+'/'+action,{
     method:'POST',body:JSON.stringify(body)
   });
   const [bookingsResponse,noticeResponse]=await Promise.all([
     supabase.from('bookings').select('*').order('starts_at'),
     apiFetch('/api/v1/announcements')
   ]);
   if(bookingsResponse.error)throw bookingsResponse.error;
   setBookings(bookingsResponse.data||[]);
   setNotices(noticeResponse.announcements||[]);
   setRefreshTick(n=>n+1);
   alert(action==='cancel'?'Reservation cancelled.':'Reservation rescheduled and conflict-checked.');
 }finally {setBookingBusy('');}
}
async function doBook(){
 if(!current)return;
 if(!isAvailable(current))return alert('This room is not verified as available at that time.');
 if(current.capacity<capacity)return alert('Requested capacity exceeds room size.');
 const selectedGroup=chosenCohort;
 if(bookingKind!=='event'&&!selectedGroup)return alert('Choose a registered academic group before submitting.');
 const rawTitle=bookingTitle.trim();
 if(rawTitle.length<3)return alert('Enter a session title of at least three characters.');
 const groupPrefix=selectedGroup?branchLabel(selectedGroup.branch)+' · ':'';
 const title=(groupPrefix+rawTitle).slice(0,180);
 setLoading(true);let success=false;
 try{
   const result=await apiFetch('/api/v1/bookings',{method:'POST',body:JSON.stringify({
     room_id:current.id,title,starts_at:start,ends_at:end,kind:bookingKind,required_capacity:capacity,
     idempotency_key:crypto.randomUUID(),cohort_id:selectedGroup?.id||null,
     required_equipment:requiredEquipment?[requiredEquipment]:[]})});
   const b=await supabase.from('bookings').select('*').order('starts_at');
   if(b.data)setBookings(b.data);
   setRefreshTick(v=>v+1);
   alert(result.status==='pending'?'Reservation request submitted for approval.':
     'Reservation confirmed and saved in Supabase.');
  success=true;
 }catch(e){alert(e.message||'Booking failed. No reservation was confirmed.')}
 finally{setLoading(false);if(success)setShowBooking(false)}
}
async function submitReport(){
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
   await apiFetch('/api/v1/admin/announcements',{method:'POST',body:JSON.stringify({
    title:noticeTitle.trim(),body:noticeBody,priority:noticePriority
   })});
   alert('Official announcement published to the campus feed.');
   try{
     const response=await apiFetch('/api/v1/announcements');
     setNotices(response.announcements||[]);
   }catch(err){alert('Notice published, but feed refresh failed: '+err.message);}
   setRefreshTick(n=>n+1);
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
if(!authReady)return <div className="ig-auth-loading" role="status">Checking your sign-in…</div>;
if(recovering||!session)return <AuthScreen recovery={recovering} onRecoveryComplete={finishRecovery} onRecoveryCancel={finishRecovery}/>;
return <div className="app-shell">
<TopNavigation items={menu.filter(([name])=>name!=='Admin'||canAdmin)}
  active={view} onNavigate={setView}
  noticeCount={notices.length}
  userName={profile?.full_name||session?.user?.email?.split('@')[0]||'User'}
  userRole={userRole} avatarUrl={avatarUrl}
  onSignOut={()=>{supabase.auth.signOut();setView('Explore rooms')}}/>
<div className="workarea">
<main className="main-content">
  {liveDataError&&<div className="ig-data-alert" role="alert">
    <AlertTriangle size={19} aria-hidden="true"/>
    <div><strong>Campus records need attention</strong><p>{liveDataError}</p></div>
    <button type="button" onClick={()=>{setInventoryRetry(n=>n+1);setRefreshTick(n=>n+1)}}>
      <RefreshCcw size={15}/> Retry loading
    </button>
  </div>}
{view==='My profile'&&<ProfilePage
    supabase={supabase} session={session} profile={profile} role={userRole}
    avatarUrl={avatarUrl} onProfileChanged={setProfile}/>}
{view==='Explore rooms'&&<CampusExperience buildings={buildings} rooms={rooms} building={building}
    setBuilding={setBuilding} floor={floor} setFloor={setFloor} selected={selected} setSelected={setSelected}
    date={date} setDate={setDate} hour={hour} setHour={setHour} duration={duration}
    setDuration={setDuration} capacity={capacity} setCapacity={setCapacity}
    bookingKind={bookingKind} setBookingKind={setBookingKind}
    requiredEquipment={requiredEquipment} setRequiredEquipment={setRequiredEquipment}
    apiAvailability={apiAvailability} apiWarning={apiWarning} isAvailable={isAvailable}
    matching={matching} current={current} canBook={canBook} inventoryLoading={inventoryLoading}
    onRetryAvailability={()=>setRefreshTick(n=>n+1)}
    onRetryRooms={()=>setInventoryRetry(n=>n+1)}
    setShowBooking={setShowBooking} setView={setView}
    activeSessions={activeSessions} nowScheduleState={nowScheduleState} currentTimeMs={currentTimeMs}/>}
  {view==='Calendar'&&<CalendarPage date={date} setDate={setDate} initialDate={initialDate}
    calendarBookings={calendarBookings} rooms={rooms} onOpenRoom={openRoomAt}
    loading={calendarLoading} error={calendarError} onRetry={()=>setRefreshTick(n=>n+1)}/>}
  {view==='My bookings'&&<BookingsPage bookings={bookings} rooms={rooms}
    setView={setView} onOpenRoom={openRoomAt} userId={session?.user?.id}
    bookingBusy={bookingBusy}
    onCancelBooking={(b,reason)=>mutateExistingBooking(b,'cancel',{reason})}
    onRescheduleBooking={(b,body)=>mutateExistingBooking(b,'reschedule',body)}/>}
  {view==='Announcements'&&<AnnouncementsPage notices={notices}
    markNoticeRead={markNoticeRead} noticeReadBusy={noticeReadBusy} setReport={setReport}/>}
  {view==='Admin'&&<AdminPage canAdmin={canAdmin} userRole={userRole}
    rooms={rooms} bookings={bookings} notices={notices} noticeTitle={noticeTitle}
    setNoticeTitle={setNoticeTitle} noticeBody={noticeBody} setNoticeBody={setNoticeBody}
    noticePriority={noticePriority} setNoticePriority={setNoticePriority}
    noticeBusy={noticeBusy} addNotice={addNotice} pendingQueue={pendingQueue}
    pendingLoading={pendingLoading} pendingError={pendingError}
    reviewBusy={reviewBusy} reviewPendingBooking={reviewPendingBooking}
    setRefreshTick={setRefreshTick} accountUuid={accountUuid} setAccountUuid={setAccountUuid}
    accountRole={accountRole} setAccountRole={setAccountRole} accountBusy={accountBusy}
    grantTestRole={grantTestRole} onImportCohorts={importCohorts}
    apiWarning={apiWarning} apiAvailability={apiAvailability}
    auditRows={auditRows} auditTotal={auditTotal} auditOffset={auditOffset} setAuditOffset={setAuditOffset}
    auditRoom={auditRoom} setAuditRoom={setAuditRoom} auditAction={auditAction} setAuditAction={setAuditAction}
    auditLoading={auditLoading} auditError={auditError}/>}
</main></div>
<ReservationDialog open={showBooking} onOpenChange={setShowBooking}
  room={current} date={date} hour={hour} duration={duration}
  bookingTitle={bookingTitle} setBookingTitle={setBookingTitle}
  bookingKind={bookingKind} setBookingKind={setBookingKind}
  cohorts={cohorts} cohortId={cohortId} setCohortId={setCohortId}
  cohortError={cohortError} loading={loading} canBook={canBook}
  available={!!current&&isAvailable(current)&&current.capacity>=capacity}
  onConfirm={doBook}/>
{report&&<div className="modal-overlay"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="ig-report-title" aria-describedby="ig-report-description"><div className="modal-head"><h2 id="ig-report-title">Report an issue</h2><button type="button" aria-label="Close issue report" onClick={()=>setReport(false)}><X size={18}/></button></div><p id="ig-report-description" className="muted">Flag incorrect or outdated schedule information. This will not modify official bookings.</p><button type="button" className="button-primary" onClick={submitReport}>Submit schedule report</button></section></div>}
{toast&&<div className="toast" role="status" aria-live="polite"><Info size={17} aria-hidden="true"/><span>{toast}</span><button type="button" aria-label="Dismiss notification" onClick={()=>setToast('')}><X size={18}/></button></div>}</div>
}
