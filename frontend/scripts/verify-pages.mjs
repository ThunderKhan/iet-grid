// Lightweight server-render smoke tests for every authenticated page.
// Runs without secrets, accounts, or external API calls.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {createServer} from 'vite';

const server=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try {
  const pages=await server.ssrLoadModule('/src/components/WorkspacePages.jsx');
  const {default: CampusExperience}=await server.ssrLoadModule('/src/components/CampusExperience.jsx');
  const {default: BlueprintSitePlan}=await server.ssrLoadModule('/src/components/BlueprintSitePlan.jsx');
  const {default: ReservationDialog}=await server.ssrLoadModule('/src/components/ReservationDialog.jsx');
  const {previewCohorts,formatCohort}=await server.ssrLoadModule('/src/academicCohorts.js');
  const {sampleRooms: allRooms}=await server.ssrLoadModule('/src/data.js');
  for(const [building,floor,roomId] of [
    ['IET','Ground','LIBRARY'],['IET','First','IET19'],
    ['IET','Second','IET32'],['DEEK','Ground','LH04'],['DEEK','First','LH14']
  ]){
    const html=renderToString(React.createElement(BlueprintSitePlan,{
      rooms:allRooms,building,floor,selected:roomId,onSelect:()=>{},getStatus:()=> 'unknown'
    }));
    assert.ok(html.includes(roomId), 'Room missing from modern SVG: '+roomId);
    assert.ok(!html.includes('WASHROOM')&&!html.includes('DRINKING WATER')&&!html.includes('STAIRS'), 'Non-bookable facilities leaked into SVG');
    console.log('PASS modern plan',building,floor,roomId);
  }
  assert.ok(previewCohorts.some(c=>formatCohort(c).includes('AI/ML')&&c.academic_year===2&&c.section==='A'),'Missing example academic cohort');
  const sampleRooms=[
    {id:'IET19',building:'IET',floor:'First',capacity:75,type:'classroom',verified:false,active:true},
    {id:'IET22',building:'IET',floor:'First',capacity:75,type:'lab',verified:false,active:true}
  ];
  const sampleBookings=[{id:'a1',room_id:'IET19',title:'Data Structures',starts_at:'2026-11-06T05:30:00.000Z',ends_at:'2026-11-06T06:30:00.000Z',status:'confirmed',kind:'lecture'}];
  const sampleNotices=[{id:'n1',title:'Room allocation update',body:'Updated lecture schedule.',priority:'high',created_at:'2026-11-05T05:30:00.000Z'}];
  const buildings=[{id:'IET',short:'IET',floors:['Ground','First','Second']},{id:'DEEK',short:'Deeksha Bhawan',floors:['Ground','First']}];
  const noop=()=>{};
  const shared={rooms:sampleRooms,bookings:sampleBookings,notices:sampleNotices,buildings,
    building:'IET',floor:'First',selected:'IET19',date:'2026-11-06',hour:'11',duration:1,capacity:75,
    current:sampleRooms[0],matching:sampleRooms,apiAvailability:sampleRooms.map(x=>({...x,available:true,reason:'available'})),
    apiWarning:'',isAvailable:()=>true,canBook:true,demo:true,
    setSelected:noop,setBuilding:noop,setFloor:noop,setView:noop,setDate:noop,setHour:noop,
    setDuration:noop,setCapacity:noop,setShowBooking:noop,calendarBookings:sampleBookings,
    initialDate:'2026-11-06',onOpenRoom:noop,markNoticeRead:noop,noticeReadBusy:'',
    setReport:noop,canAdmin:true,userRole:'admin',noticeTitle:'Update',setNoticeTitle:noop,
    noticeBody:'Campus update',setNoticeBody:noop,noticePriority:'normal',setNoticePriority:noop,
    noticeBusy:false,addNotice:noop,pendingQueue:[],pendingLoading:false,pendingError:'',
    reviewBusy:'',reviewPendingBooking:noop,setRefreshTick:noop,accountUuid:'',setAccountUuid:noop,
    accountRole:'faculty',setAccountRole:noop,accountBusy:false,grantTestRole:noop};
  const views=[
    ['Campus map',CampusExperience,'Find space for the next class.'],
    ['Calendar',pages.CalendarPage,'Campus timetable'],
    ['My bookings',pages.BookingsPage,'Classroom reservations'],
    ['Announcements',pages.AnnouncementsPage,'Campus announcements'],
    ['Admin',pages.AdminPage,'Campus administration']
  ];
  const reservationHtml=renderToString(React.createElement(ReservationDialog,{
    open:true,onOpenChange:()=>{},room:{id:'IET18',capacity:75},date:'2026-11-06',hour:'11',duration:1,
    bookingTitle:'Machine Learning',setBookingTitle:()=>{},bookingKind:'lecture',setBookingKind:()=>{},
    cohorts:previewCohorts,cohortId:previewCohorts.find(c=>c.branch==='AI ML'&&c.academic_year===2&&c.section==='A').id,
    setCohortId:()=>{},loading:false,canBook:true,available:true,onConfirm:()=>{},demo:true
  }));
  assert.ok(reservationHtml.includes('AI/ML'),'Booking dialog must display selected academic cohort');
  for(const [name,Component,needle] of views){
    const html=renderToString(React.createElement(Component,shared));
    assert.ok(html.length>300,name+' rendered too little UI');
    assert.ok(html.includes(needle),name+' missing expected heading: '+needle);
    console.log('PASS',name,'rendered',html.length,'characters');
  }
}finally{
  await server.close();
}
