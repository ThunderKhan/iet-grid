// Lightweight server-render smoke tests for every authenticated page.
// Runs without secrets, accounts, or external API calls.
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {createServer} from 'vite';

const server=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try {
  const pages=await server.ssrLoadModule('/src/components/WorkspacePages.jsx');
  const appSource=readFileSync('src/App.jsx','utf8');
  // A removed demo-cohort variable caused the whole authenticated workspace
  // to throw ReferenceError despite the Vite build passing.
  assert.match(appSource,/cohorts=\{cohorts\}/,
    'Reservation dialog must receive the real registered cohorts');
  assert.doesNotMatch(appSource,/\bavailableCohorts\b/,
    'Removed demo-cohort alias must never reappear in the authenticated page');
  const entrySource=readFileSync('src/main.jsx','utf8');
  assert.ok(entrySource.includes('<AppErrorBoundary><App/></AppErrorBoundary>'),
    'A recoverable error panel must wrap the main app instead of a blank screen');
  const packageInfo=JSON.parse(readFileSync('package.json','utf8'));
  assert.match(packageInfo.scripts.dev,/--port 5123 --strictPort/,'Dev server must bind exact requested port');
  assert.ok(!appSource.includes('preview=1')&&!appSource.includes('sampleRooms')&&!appSource.includes('demoBookings'),
    'Application may not enable the old preview or import sample records');
  assert.ok(appSource.includes('if(recovering||!session)return <AuthScreen'),
    'The real application must require Supabase sign-in');

  const {default: CampusExperience}=await server.ssrLoadModule('/src/components/CampusExperience.jsx');
  const {default: ProfilePage,validateProfileImage,profileFormFrom}=await server.ssrLoadModule('/src/components/ProfilePage.jsx');
  const fileOK={type:'image/png',size:120000};
  assert.equal(validateProfileImage(fileOK),'');
  assert.match(validateProfileImage({type:'image/svg+xml',size:300}),/JPEG, PNG or WebP/,
    'SVG avatars must not be accepted');
  assert.match(validateProfileImage({type:'image/jpeg',size:4*1024*1024}),/2 MB/,
    'Oversized files must be rejected');
  const selfReported=profileFormFrom({full_name:'Example Student'},{
    user_metadata:{campus_branch:'AI/ML',campus_year:2,campus_section:'B'}
  });
  assert.deepEqual([selfReported.branch,selfReported.academicYear,selfReported.section],
    ['AI/ML','2','B']);
  const studentProfileMarkup=renderToString(React.createElement(ProfilePage,{
    profile:{full_name:'Example Student',role:'student',verified:true,branch:'CSE',academic_year:1,section:'A'},
    session:{user:{email:'student@example.com',user_metadata:{}}},role:'student',
    onProfileChanged:()=>{}
  }));
  for(const label of ['My profile','Profile photo','Full name','Branch / programme','Academic year','Section','Save changes'])
    assert.ok(studentProfileMarkup.includes(label),'Profile page missing '+label);
  assert.ok(studentProfileMarkup.includes('University-managed details'),'Profile must distinguish institutional record');
  assert.ok(studentProfileMarkup.includes('Demo changes')===false);
  const facultyProfileMarkup=renderToString(React.createElement(ProfilePage,{
    profile:{full_name:'Example Faculty',role:'faculty',verified:true},
    session:{user:{email:'faculty@example.com',user_metadata:{}}},role:'faculty',
    onProfileChanged:()=>{}
  }));
  assert.ok(facultyProfileMarkup.includes('Department / teaching area'),'Faculty fields must be role-aware');
  assert.ok(!facultyProfileMarkup.includes('Academic year'),'Faculty form should not ask for student academic year');
  const {default: TopNavigation}=await server.ssrLoadModule('/src/components/TopNavigation.jsx');
  const {SlideTabs}=await server.ssrLoadModule('/src/components/TopNavigation.jsx');
  const navigationItems=[['Explore rooms',()=>null],['Calendar',()=>null],['My bookings',()=>null],
    ['Announcements',()=>null],['Admin',()=>null]];
  const navHtml=renderToString(React.createElement(TopNavigation,{
    items:navigationItems,active:'Explore rooms',onNavigate:()=>{},noticeCount:2,
    userName:'Test Faculty',userRole:'faculty',onSignOut:()=>{}
  }));
  assert.ok(navHtml.includes('ig-topnav')&&navHtml.includes('ig-primary-nav'),'New global top bar must render');
  assert.ok(navHtml.includes('ig-slide-track')&&navHtml.includes('ig-slide-cursor'),'Supplied slide-tabs animation must be represented');
  assert.ok(navHtml.includes('aria-current="page"'),'Selected navigation item must be accessible');
  assert.ok(navHtml.includes('Campus map')&&navHtml.includes('Calendar')&&navHtml.includes('My bookings'),
    'Existing workspace destinations must remain available');
  const navSource=readFileSync('src/components/TopNavigation.jsx','utf8');
  assert.ok(navSource.includes("navigate('My profile')"),
    'Profile dropdown must navigate to My profile');
  assert.ok(!navHtml.includes('DEMO')&&navHtml.includes('Announcements'),
    'Navigation must show real notifications without demo labels');
  assert.ok(navHtml.includes('aria-haspopup="menu"')&&navHtml.includes('ig-profile-trigger'),
    'Desktop profile menu must remain accessible and expose account controls');
  assert.ok(navHtml.includes('aria-controls="ig-mobile-nav"'),
    'Mobile navigation must retain its toggle control');
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
  // Architectural Minimalism must not revert to full-room status coloring.
  const foundations=readFileSync('src/styles.css','utf8');
  assert.ok(foundations.includes('--ig-primary:#315CE5')&&foundations.includes('--ig-text:#17243B'),
    'Global design tokens must match the root DESIGN.md color system');
  assert.ok(!foundations.includes('.sidebar{')&&!foundations.includes('.hero-panel{'),
    'Obsolete sidebar and overview styling should stay removed from the active stylesheet');
  const planCSS=readFileSync('src/components/BlueprintSitePlan.css','utf8');
  assert.match(planCSS,/\.bp-room-surface\{fill:#FFFFFF;/,
    'Room surfaces should be neutral white');
  assert.doesNotMatch(planCSS,/\.bp-room\.bp-(available|occupied|restricted)\s+\.bp-room-surface\{/,
    'Room availability must be shown through indicators, not full-tile fills');
  assert.match(planCSS,/\.bp-circulation\{fill:#E8EDF4;/,
    'Corridors should use the updated architectural slate gray');
  assert.match(planCSS,/\.bp-room\.is-selected \.bp-room-border\{stroke:var\(--ig-primary\);stroke-width:2\.75\}/,
    'Selected room must retain a precise cobalt outline');
  assert.match(planCSS,/\.bp-room\.bp-available \.bp-room-indicator\{fill:var\(--ig-available\)\}/,
    'Available status remains legible');
  assert.match(planCSS,/\.bp-room\.bp-occupied \.bp-room-indicator\{fill:var\(--ig-occupied\)\}/,
    'Occupied status remains legible');
  const {default: BlueprintSitePlan,findRoomMatches}=await server.ssrLoadModule('/src/components/BlueprintSitePlan.jsx');
  const campusRoomFixtures=(await server.ssrLoadModule('/scripts/test-fixtures.js')).sampleRooms;
  assert.equal(findRoomMatches(campusRoomFixtures,'iet18')[0]?.id,'IET18',
    'Room search must match a full ID regardless of case');
  assert.equal(findRoomMatches(campusRoomFixtures,'  lh04  ')[0]?.id,'LH04',
    'Room search should match Deeksha rooms and ignore surrounding whitespace');
  assert.deepEqual(findRoomMatches(campusRoomFixtures,'no-such-room'),[],
    'Room search must not fabricate matching classrooms');
  assert.deepEqual(findRoomMatches(campusRoomFixtures,''),[],
    'Room search should start empty rather than show arbitrary suggestions');
  const {default: ReservationDialog,AcademicGroupFields}=await server.ssrLoadModule('/src/components/ReservationDialog.jsx');
  const {formatCohort,cohortBranchOptions,cohortYearOptions,cohortSectionOptions,cohortMatches}=await server.ssrLoadModule('/src/academicCohorts.js');
  const {previewCohorts,sampleRooms:allRooms}=await server.ssrLoadModule('/scripts/test-fixtures.js');
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
  const styledRoomMap=renderToString(React.createElement(BlueprintSitePlan,{
    rooms:allRooms,building:'IET',floor:'First',selected:'IET18',
    onSelect:()=>{},onFindRoom:()=>{},getStatus:()=> 'available',
    slotSummary:'5 Nov 2026 · 11:00–12:00 IST',requiredSeats:75
  }));
  assert.ok(styledRoomMap.includes('Find a room...')&&styledRoomMap.includes('aria-autocomplete="list"'),
    'Map header should expose the accessible classroom finder');
  assert.ok(styledRoomMap.includes('5 Nov 2026 · 11:00–12:00 IST')
    &&styledRoomMap.includes('bp-slot-capacity')&&styledRoomMap.includes('seats minimum'),
    'Map should provide clear, non-editable date and capacity context');
  assert.ok(styledRoomMap.includes('bp-fine-grid'),'Floor map should retain restrained architectural guide lines');
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
      matching:[],canBook:false,isAvailable:()=>false,
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
    accountRole:'faculty',setAccountRole:noop,accountBusy:false,grantTestRole:noop,
    auditRows:[],auditTotal:0,auditOffset:0,setAuditOffset:noop,auditRoom:'',setAuditRoom:noop,
    auditAction:'',setAuditAction:noop,auditLoading:false,auditError:''};
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
    if(name==='Calendar')assert.ok(html.includes('is-today'),
      'Calendar should distinguish the current day with restrained visual styling');
    if(name==='My bookings'||name==='Announcements')assert.ok(html.includes('ig-tab-counter'),
      'Record filters should display accurate, server-backed item counts');
    console.log('PASS',name,'rendered',html.length,'characters');
  }
}finally{
  await server.close();
}
