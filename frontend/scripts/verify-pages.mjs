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
  const {default: TopNavigation}=await server.ssrLoadModule('/src/components/TopNavigation.jsx');
  const {SlideTabs}=await server.ssrLoadModule('/src/components/TopNavigation.jsx');
  const navigationItems=[['Explore rooms',()=>null],['Calendar',()=>null],['My bookings',()=>null],
    ['Announcements',()=>null],['Admin',()=>null]];
  const navHtml=renderToString(React.createElement(TopNavigation,{
    items:navigationItems,active:'Explore rooms',onNavigate:()=>{},demo:true,noticeCount:2,
    userName:'Demo Faculty',userRole:'faculty',onSignOut:()=>{}
  }));
  assert.ok(navHtml.includes('ig-topnav')&&navHtml.includes('ig-primary-nav'),'New global top bar must render');
  assert.ok(navHtml.includes('ig-slide-track')&&navHtml.includes('ig-slide-cursor'),'Supplied slide-tabs animation must be represented');
  assert.ok(navHtml.includes('aria-current="page"'),'Selected navigation item must be accessible');
  assert.ok(navHtml.includes('Campus map')&&navHtml.includes('Calendar')&&navHtml.includes('My bookings'),
    'Existing workspace destinations must remain available');
  assert.ok(navHtml.includes('DEMO')&&navHtml.includes('Announcements'),
    'Demo and announcement context must remain available');
  assert.ok(navHtml.includes('Sign out'),'Sign-out action must remain available in navigation');
  assert.ok(!navHtml.includes('sidebar')&&!navHtml.includes('side-profile'),'Old sidebar must not render');
  assert.equal(typeof SlideTabs,'function');

  const {getActiveRoomSessions,sessionTimeIST}=await server.ssrLoadModule('/src/currentSessions.js');
  const reference=Date.parse('2026-11-05T10:00:00.000Z');
  const testEvents=[
    {room_id:'IET18',title:'AI/ML · Computer Vision',starts_at:'2026-11-05T09:30:00.000Z',ends_at:'2026-11-05T10:30:00.000Z',status:'confirmed'},
    {room_id:'IET20',title:'Protected subject',details_visible:false,starts_at:'2026-11-05T09:00:00.000Z',ends_at:'2026-11-05T11:00:00.000Z',status:'confirmed'},
    {room_id:'LH04',title:'Exam pending',starts_at:'2026-11-05T09:00:00.000Z',ends_at:'2026-11-05T11:00:00.000Z',status:'pending'},
    {room_id:'IET17',title:'Already finished',starts_at:'2026-11-05T08:00:00.000Z',ends_at:'2026-11-05T10:00:00.000Z',status:'confirmed'},
    {room_id:'IET19',title:'Later this day',starts_at:'2026-11-05T10:30:00.000Z',ends_at:'2026-11-05T11:00:00.000Z',status:'confirmed'},
    {room_id:'IET22',title:'Occupied',kind:'block',details_visible:false,starts_at:'2026-11-05T09:00:00.000Z',ends_at:'2026-11-05T11:00:00.000Z',status:'confirmed'},
  ];
  const running=getActiveRoomSessions(testEvents,reference);
  assert.equal(running.IET18.title,'AI/ML · Computer Vision');
  assert.equal(running.IET20.title,'Occupied — class details unavailable');
  assert.equal(running.IET20.detailsVisible,false,'Hidden schedule titles must remain hidden');
  for(const id of ['LH04','IET17','IET19','IET22'])
    assert.equal(running[id],undefined,'Not-current or pending booking must not be shown as running');
  assert.ok(sessionTimeIST('2026-11-05T10:00:00.000Z').includes('3:30'),
    'Running class times must display IST, not browser-local time');
  const {default: VelarisGradient,VELARIS_VERTEX_SHADER,VELARIS_FRAGMENT_SHADER,hexToUnitRGB}=await server.ssrLoadModule('/src/components/VelarisGradient.jsx');
  const shaderMarkup=renderToString(React.createElement(VelarisGradient,{className:'cx-gradient'}));
  assert.ok(shaderMarkup.includes('cx-velaris-canvas')&&shaderMarkup.includes('<canvas'),
    'Velaris should render a hero canvas for WebGL');
  assert.ok(VELARIS_VERTEX_SHADER.includes('gl_Position'),'Missing WebGL vertex shader');
  assert.ok(VELARIS_FRAGMENT_SHADER.includes('snoise(')&&VELARIS_FRAGMENT_SHADER.includes('u_colors[4]'),
    'Velaris must use the supplied simplex-noise blending shader');
  assert.equal(hexToUnitRGB('#315CE5').length,3,'Theme color conversion failed');
  const {default: BlueprintSitePlan}=await server.ssrLoadModule('/src/components/BlueprintSitePlan.jsx');
  const {default: ReservationDialog,AcademicGroupFields}=await server.ssrLoadModule('/src/components/ReservationDialog.jsx');
  const {previewCohorts,formatCohort,cohortBranchOptions,cohortYearOptions,cohortSectionOptions,cohortMatches}=await server.ssrLoadModule('/src/academicCohorts.js');
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
  const sampleLiveMap=renderToString(React.createElement(BlueprintSitePlan,{
    rooms:allRooms,building:'IET',floor:'First',selected:'IET18',
    onSelect:()=>{},getStatus:()=> 'available',
    activeSessions:running,nowScheduleState:'ready'
  }));
  assert.ok(sampleLiveMap.includes('LIVE NOW'),'Room plan must visibly identify running classes');
  assert.ok(sampleLiveMap.includes('AI/ML · Computer Vision'),
    'Authorized current class should be visible to the viewer');
  assert.ok(sampleLiveMap.includes('Occupied — class details unavailable'),
    'Restricted class titles must not leak');
  const mobileListMap=renderToString(React.createElement(BlueprintSitePlan,{
    rooms:allRooms,building:'IET',floor:'First',selected:'IET18',
    onSelect:()=>{},getStatus:()=> 'available',
    activeSessions:running,nowScheduleState:'ready',mode:'list'
  }));
  assert.ok(mobileListMap.includes('Running now'),'Room list must expose ongoing sessions');
  // Building name is a single visible heading; the floor arrows replace all tab buttons.
  for(const [whichBuilding,currentFloor,floors] of [
    ['IET','Ground',3],['IET','First',3],['IET','Second',3],
    ['DEEK','Ground',2],['DEEK','First',2]
  ]){
    const html=renderToString(React.createElement(CampusExperience,{
      buildings:[{id:'IET',short:'IET',floors:['Ground','First','Second']},
        {id:'DEEK',short:'Deeksha Bhawan',floors:['Ground','First']}],
      rooms:allRooms,building:whichBuilding,floor:currentFloor,selected:'',
      date:'2026-11-05',hour:'11',duration:1,capacity:75,apiAvailability:null,
      matching:[],demo:true,canBook:false,isAvailable:()=>false,
      setBuilding:()=>{},setFloor:()=>{},setSelected:()=>{},setDate:()=>{},
      setHour:()=>{},setDuration:()=>{},setCapacity:()=>{},setView:()=>{},
      setShowBooking:()=>{}
    }));
    assert.ok(html.includes('aria-label="Previous floor"'),'Missing previous floor arrow');
    assert.ok(html.includes('aria-label="Next floor"'),'Missing next floor arrow');
    assert.ok(!html.includes('cx-floor-tabs'),'Old floor tabs must be removed');
    assert.ok(!html.includes('cx-floor-stepper'),'Old toolbar stepper must be removed');
    assert.ok(html.includes('bp-navigation-stage'),'Floor navigation must be attached to the map');
    assert.ok(!html.includes('cx-floor-label'),'Redundant building heading row must be removed');
    assert.ok(!html.includes('cx-hero')&&!html.includes('Find space for the next class.'),
      'Removed hero banner must not render in Campus map');
    const fullMapPosition=html.indexOf('cx-map-hero');
    const toolbarPosition=html.indexOf('cx-nav"');
    const detailPosition=html.indexOf('cx-aside"');
    assert.ok(fullMapPosition>=0&&toolbarPosition>fullMapPosition&&detailPosition>toolbarPosition,
      'Floor plan must render full-width first, with selector and booking details below');
    assert.ok(html.includes('cx-nav'), 'Building selector must remain after removing hero');
    assert.ok(html.includes('bp-view-toggle'),'Map/List switch must sit inside the floor plan card');
    assert.ok(html.includes('bp-building-tabs'),'Building picker must be in floor-plan header');
    assert.ok(html.indexOf('bp-heading-line')<html.indexOf('bp-building-tabs')
      && html.indexOf('bp-building-tabs')<html.indexOf('bp-navigation-stage'),
      'Building selector must appear beside Classroom layout, above the map');
    assert.ok(!html.includes('cx-building-tabs'),'Old building switch below map must be absent');
    assert.ok(html.includes('aria-label="Select building"'),
      'Moved building switch must retain an accessible group label');
    assert.ok(html.indexOf('bp-head')<html.indexOf('bp-view-toggle') &&
      html.indexOf('bp-view-toggle')<html.indexOf('bp-navigation-stage'),
      'Map/List switch must be in the blueprint header, before the drawing');
    assert.ok(html.includes('aria-label="Floor display mode"'),
      'The relocated switch needs an accessible label');
    const mapStart=html.indexOf('bp-navigation-stage');
    const prevPosition=html.indexOf('aria-label="Previous floor"');
    const nextPosition=html.indexOf('aria-label="Next floor"');
    const currentPosition=html.indexOf('bp-floor-position"');
    const footerPosition=html.indexOf('bp-footer"');
    assert.ok(mapStart>=0&&prevPosition>mapStart&&nextPosition>prevPosition,
      'Floor arrows must flank the room board');
    assert.ok(currentPosition>nextPosition&&footerPosition>currentPosition,
      'Current floor label must appear below the drawing and above the legend');
    assert.ok(html.includes(currentFloor+' floor'),'Current floor label must be visible');
    assert.ok(html.includes((floors===2?'2':'3')+' floors')===false,'Floor counter must remain concise');
    if(whichBuilding==='DEEK'){
      const occurrences=(html.match(/Deeksha Bhawan/g)||[]).length;
      // The two exact strings in aria-label are accessible context, not duplicate visible text.
      assert.ok(occurrences<=5,'Unexpected repetition of the full building label');
      assert.ok(!html.includes('>Deeksha Bhawan</h2>'),'Crossed-out building heading must be absent');
    }
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
    ['Campus map',CampusExperience,'Classroom layout'],
    ['Calendar',pages.CalendarPage,'Campus timetable'],
    ['My bookings',pages.BookingsPage,'Classroom reservations'],
    ['Announcements',pages.AnnouncementsPage,'Campus announcements'],
    ['Admin',pages.AdminPage,'Campus administration']
  ];
  // Radix Dialog portals mount on the client, not in Node SSR. Test the
  // registered academic-group label separately from browser-only dialog UI.
  const example=previewCohorts.find(c=>c.branch==='AI ML'&&c.academic_year===2&&c.section==='A');
  assert.ok(example,'Preview must include AI/ML year 2 section A');
  assert.equal(formatCohort(example),'AI/ML · Year 2 · Section A');
  assert.equal(typeof ReservationDialog,'function','Reservation dialog module must be importable');
  const opts=cohortBranchOptions(previewCohorts);
  assert.ok(opts.includes('AI/ML')&&opts.includes('CSE'),'Branch dropdown must offer registered branches');
  assert.deepEqual(cohortYearOptions(previewCohorts,'AI/ML'),['1','2','3','4']);
  assert.deepEqual(cohortSectionOptions(previewCohorts,'AI/ML','2'),['A','B']);
  assert.equal(cohortMatches(previewCohorts,'AI/ML','2','A')[0].id,example.id);
  assert.equal(cohortMatches(previewCohorts,'AI/ML','2','Z').length,0,'Invalid section must not resolve to a cohort');
  const duplicate={...example,id:'another-batch',code:'AIML-2-A-ALT',batch_start:2026};
  assert.equal(cohortMatches([...previewCohorts,duplicate],'AI/ML','2','A').length,2,
    'Duplicate branch/year/section must require batch selection');
  const groupHtml=renderToString(React.createElement(AcademicGroupFields,{
    open:true,cohorts:previewCohorts,cohortId:'',setCohortId:()=>{},groupRequired:true
  }));
  for(const label of ['rc-branch','rc-year','rc-section'])assert.ok(groupHtml.includes(label),
    'Missing dedicated dropdown '+label);
  for(const [name,Component,needle] of views){
    const html=renderToString(React.createElement(Component,shared));
    assert.ok(html.length>300,name+' rendered too little UI');
    assert.ok(html.includes(needle),name+' missing expected heading: '+needle);
    console.log('PASS',name,'rendered',html.length,'characters');
  }
}finally{
  await server.close();
}
