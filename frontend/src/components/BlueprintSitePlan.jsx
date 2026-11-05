import React, {useEffect, useId, useMemo, useRef, useState} from 'react';
import {Building2, ChevronLeft, ChevronRight, Clock3, DoorOpen, List, Map as MapIcon, Search, X} from 'lucide-react';
import './BlueprintSitePlan.css';

/* Source: DDUGU Build With AI brief, page 1, IET & Deeksha floor blueprint.
 * Room adjacency, corridors, and shared facilities follow the supplied drawing.
 * Coordinates are hand-traced and are not a surveyed, to-scale CAD model.
 */
const layouts={
  'IET:Ground':[
    {id:'LIBRARY',x:60,y:108,w:348,h:129,name:'LIBRARY',sub:'150–180 students'},
    {facility:'TEACHERS’ OFFICE',x:60,y:240,w:348,h:141},
    {facility:'PLACEMENT CELL',x:538,y:108,w:342,h:129},
    {facility:'DIRECTOR’S OFFICE',x:538,y:240,w:342,h:141}
  ],
  'IET:First':[
    {id:'IET22',x:60,y:108,w:169,h:111},
    {id:'IET16',x:229,y:108,w:179,h:111},
    {id:'IET14',x:538,y:108,w:181,h:111},
    {id:'IET15',x:719,y:108,w:161,h:111},
    {id:'IET20',x:60,y:279,w:191,h:102},
    {id:'IET19',x:251,y:279,w:203,h:102},
    {id:'IET18',x:454,y:279,w:202,h:102},
    {id:'IET17',x:656,y:279,w:224,h:102}
  ],
  'IET:Second':[
    {id:'IET32',x:60,y:108,w:348,h:111,name:'SEMINAR HALL',sub:'IET32 · Approx. 200'},
    {id:'IET24',x:538,y:108,w:181,h:111},
    {id:'IET25',x:719,y:108,w:161,h:111},
    {id:'IET30',x:60,y:279,w:191,h:102},
    {id:'IET29',x:251,y:279,w:203,h:102},
    {id:'IET28',x:454,y:279,w:202,h:102},
    {id:'IET23',x:656,y:279,w:224,h:102}
  ],
  'DEEK:Ground':[
    {id:'LH01',x:244,y:100,w:622,h:92},
    {id:'LH02',x:254,y:210,w:444,h:42},
    {facility:'WASHROOM',x:121,y:268,w:150,h:98,round:true},
    {id:'LH03',x:277,y:270,w:151,h:96},
    {id:'LH04',x:428,y:270,w:161,h:96},
    {facility:'DRINKING WATER',x:594,y:274,w:132,h:89,diamond:true},
    {id:'LH05',x:730,y:260,w:136,h:106},
    {id:'LH06',x:74,y:393,w:259,h:96},
    {id:'LH07',x:650,y:393,w:216,h:96}
  ],
  'DEEK:First':[
    {id:'LH08',x:244,y:100,w:622,h:92},
    {id:'LH09',x:254,y:210,w:444,h:42},
    {facility:'WASHROOM',x:121,y:268,w:150,h:98,round:true},
    {id:'LH10',x:277,y:270,w:151,h:96},
    {id:'LH11',x:428,y:270,w:161,h:96},
    {facility:'DRINKING WATER',x:594,y:274,w:132,h:89,diamond:true},
    {id:'LH12',x:730,y:260,w:136,h:106},
    {id:'LH13',x:74,y:393,w:259,h:96},
    {id:'LH14',x:650,y:393,w:216,h:96}
  ]
};
const statuses={available:'Available',occupied:'Occupied',restricted:'Ineligible',unknown:'Not verified',pending:'Pending approval'};
const status=s=>Object.prototype.hasOwnProperty.call(statuses,s)?s:'unknown';

// Find only existing, loaded campus rooms; never manufacture suggested rooms.
export function findRoomMatches(rooms,rawQuery,limit=6){
  const query=String(rawQuery||'').trim().toLocaleUpperCase('en-US');
  if(!query)return [];
  return rooms.filter(room=>String(room.id||'').toLocaleUpperCase('en-US').includes(query))
    .sort((a,b)=>{
      const aExact=a.id.toLocaleUpperCase('en-US')===query;
      const bExact=b.id.toLocaleUpperCase('en-US')===query;
      return Number(bExact)-Number(aExact)||a.id.localeCompare(b.id,undefined,{numeric:true});
    }).slice(0,limit);
}
function RoomQuickFind({rooms,onFindRoom}){
  const [query,setQuery]=useState('');
  const [open,setOpen]=useState(false);
  const [highlight,setHighlight]=useState(0);
  const inputRef=useRef(null);
  const outerRef=useRef(null);
  const listId=useId();
  const results=useMemo(()=>findRoomMatches(rooms,query),[rooms,query]);
  useEffect(()=>{
    if(!open)return;
    const onPointerDown=event=>{if(!outerRef.current?.contains(event.target))setOpen(false)};
    const onEscape=event=>{if(event.key==='Escape')setOpen(false)};
    document.addEventListener('pointerdown',onPointerDown);
    document.addEventListener('keydown',onEscape);
    return()=>{
      document.removeEventListener('pointerdown',onPointerDown);
      document.removeEventListener('keydown',onEscape);
    };
  },[open]);
  const pick=room=>{
    onFindRoom(room);
    setQuery('');
    setHighlight(0);
    setOpen(false);
  };
  const onKeyDown=event=>{
    if(event.key==='Escape'){setOpen(false);return;}
    if(event.key==='ArrowDown'&&results.length){
      event.preventDefault();setOpen(true);setHighlight(i=>(i+1)%results.length);
    }else if(event.key==='ArrowUp'&&results.length){
      event.preventDefault();setOpen(true);setHighlight(i=>(i-1+results.length)%results.length);
    }else if(event.key==='Enter'&&results.length){
      event.preventDefault();pick(results[Math.min(highlight,results.length-1)]);
    }
  };
  return <div className="bp-quick-find" ref={outerRef}
    onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false)}}>
    <div className={'bp-search-field'+(open?' is-open':'')}>
      <Search size={16} aria-hidden="true"/>
      <input ref={inputRef} type="search" autoComplete="off" spellCheck={false}
        aria-label="Find a classroom by room number" aria-controls={listId}
        aria-expanded={open&&query.trim().length>0} aria-autocomplete="list" role="combobox"
        aria-activedescendant={open&&results.length?listId+'-room-'+highlight:undefined}
        value={query} placeholder="Find a room..."
        onFocus={()=>setOpen(true)}
        onKeyDown={onKeyDown}
        onChange={event=>{setQuery(event.target.value);setHighlight(0);setOpen(true)}}/>
      {query&&<button type="button" className="bp-search-clear" aria-label="Clear room search"
        onClick={()=>{setQuery('');setHighlight(0);inputRef.current?.focus()}}><X size={14}/></button>}
    </div>
    {open&&query.trim()&&<div className="bp-search-results" id={listId} role="listbox"
      aria-label="Matching campus rooms">
      {results.length?results.map((room,index)=><button type="button" key={room.id}
        id={listId+'-room-'+index} role="option" aria-selected={index===highlight}
        className={'bp-search-result'+(index===highlight?' is-highlighted':'')}
        onMouseEnter={()=>setHighlight(index)} onClick={()=>pick(room)}>
        <span className="bp-search-result-id">{room.id}</span>
        <span className="bp-search-result-meta">
          {room.building==='DEEK'?'Deeksha':'IET'} · {room.floor} floor
        </span>
        <ChevronRight size={15} className="bp-search-result-arrow" aria-hidden="true"/>
      </button>):
      <p className="bp-search-empty">No matching room is loaded.</p>}
      {results.length>0&&<small className="bp-search-hint">↑ ↓ to navigate · Enter to open</small>}
    </div>}
  </div>;
}


function Shell({building,floor}) {
  const isIET=building==='IET';
  return <g aria-hidden="true" className="bp-shell">
    {isIET?<>
      <rect x="53" y="101" width="834" height="286" rx="10" className="bp-floor-foundation"/>
      {floor!=='Ground'&&<>
        <rect x="60" y="223" width="820" height="51" rx="2" className="bp-circulation"/>
        <rect x="411" y="108" width="123" height="111" rx="3" className="bp-circulation-vertical"/>
        <text x="470" y="255" className="bp-corridor-label" textAnchor="middle">CORRIDOR</text>
      </>}
    </>:<>
      <path d="M235 94 H873 V497 H645 V390 H584 V502 H430 V390 H340 V496 H64 V247 H113 V194 H235 Z"
        className="bp-floor-foundation"/>
      <rect x="340" y="371" width="303" height="23" rx="4" className="bp-circulation"/>
    </>}
  </g>;
}
function Room({item,room,availability,selected,onSelect,activeSession}){
  const s=status(availability),active=selected===item.id,short=item.h<60;
  const activeTitle=activeSession?.title||'';
  const hasLive=Boolean(activeSession);
  const maxTitleLength=Math.max(10,Math.floor((item.w-22)/6.1));
  const shortLiveTitle=activeTitle.length>maxTitleLength
    ?activeTitle.slice(0,maxTitleLength-1).trimEnd()+'…':activeTitle;
  return <g data-room-id={item.id} className={'bp-room bp-'+s+(active?' is-selected':'')} role={room?'button':'img'}
    tabIndex={room?0:undefined} aria-pressed={room?active:undefined}
    aria-label={item.id+', '+(room?statuses[s]:'Not in dataset')+(room?', '+room.capacity+' seats':'')
      +(hasLive?', Now running: '+activeTitle:'')}
    onClick={()=>room&&onSelect(room)}
    onKeyDown={e=>{if(room&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onSelect(room)}}}>
    <rect x={item.x} y={item.y} width={item.w} height={item.h} rx="9" className="bp-room-surface"/>
    <rect x={item.x} y={item.y} width={item.w} height={item.h} rx="9" className="bp-room-border"/>
    <text x={item.x+item.w/2} y={item.y+item.h/2+(item.sub?-9:short?5:2)} textAnchor="middle"
      className="bp-room-title" style={{fontSize:short?15:item.sub?17:19}}>{item.name||item.id}</text>
    {hasLive&&item.h>=80&&<g className="bp-now-tag" aria-hidden="true">
      <rect x={item.x+9} y={item.y+8} width="55" height="18" rx="9" className="bp-now-chip"/>
      <text x={item.x+36.5} y={item.y+21} textAnchor="middle" className="bp-now-chip-label">LIVE NOW</text>
    </g>}
    {hasLive&&!short?<text x={item.x+item.w/2} y={item.y+item.h/2+25} textAnchor="middle"
      className="bp-room-ongoing-title">{shortLiveTitle}</text>:<>
      {item.sub&&<text x={item.x+item.w/2} y={item.y+item.h/2+17} textAnchor="middle" className="bp-room-subtitle">{item.sub}</text>}
      {!item.sub&&!short&&<text x={item.x+item.w/2} y={item.y+item.h/2+25} textAnchor="middle" className="bp-room-subtitle">{room?(room.type==='lab'?'LABORATORY':room.type==='seminar'?'SEMINAR SPACE':room.type==='library'?'LIBRARY':'CLASSROOM'):'ROOM'}</text>}
    </>}
    <circle cx={item.x+item.w-16} cy={item.y+16} r="4.75" className="bp-room-indicator"/>
    {active&&<path d={`M${item.x+11} ${item.y+15} l5 5 l9 -11`} className="bp-room-selected-check"/>}
    <title>{item.id+' — '+(room?statuses[s]:'Not in dataset')
      +(hasLive?' · Currently running: '+activeTitle:'')}</title>
  </g>;
}
export default function BlueprintSitePlan({rooms=[],building,floor,selected,onSelect,getStatus,mode='plan',onModeChange=()=>{},floorOptions=[],onNavigateFloor=()=>{},buildings=[],onBuildingChange=()=>{},onFindRoom=()=>{},slotSummary='',requiredSeats=0,activeSessions={},nowScheduleState='loading'}){
  const layout=(layouts[building+':'+floor]||[]).filter(item=>Boolean(item.id));
  const filtered=rooms.filter(r=>r.building===building&&r.floor===floor);
  const byId=useMemo(()=>new Map(filtered.map(r=>[r.id,r])),[filtered]);
  const missing=filtered.filter(r=>!layout.some(l=>l.id===r.id));
  const [sortBy,setSortBy]=useState('id');
  const viewportRef=useRef(null);
  useEffect(()=>{
    const viewport=viewportRef.current;
    if(mode!=='plan'||!selected||!viewport||viewport.scrollWidth<=viewport.clientWidth+2)return;
    const roomNode=Array.from(viewport.querySelectorAll('[data-room-id]'))
      .find(node=>node.getAttribute('data-room-id')===selected);
    if(!roomNode)return;
    const frame=viewport.getBoundingClientRect();
    const bounds=roomNode.getBoundingClientRect();
    const offset=bounds.left+bounds.width/2-frame.left-frame.width/2;
    if(Math.abs(offset)<18)return;
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    viewport.scrollTo({
      left:Math.max(0,viewport.scrollLeft+offset),
      behavior:reduced?'instant':'smooth'
    });
  },[selected,building,floor,mode]);
  const sorted=useMemo(()=>[...filtered].sort((a,b)=>sortBy==='capacity'?b.capacity-a.capacity:a.id.localeCompare(b.id)),[filtered,sortBy]);
  const stateOf=r=>status(r?getStatus(r):'unknown');
  const isDeek=building==='DEEK';
  const availableFloors=floorOptions.length?floorOptions:[floor];
  const floorIndex=availableFloors.indexOf(floor);
  return <section className="bp-board" aria-label={(isDeek?'Deeksha Bhawan':'IET')+' '+floor+' floor'}>
    <header className="bp-head">
      <div className="bp-head-copy">
        <div className="bp-heading-line">
          <h1>Classroom layout</h1>
          {buildings.length>0&&<div className="bp-building-tabs" role="group" aria-label="Select building">
            {buildings.map(b=><button type="button" key={b.id} aria-pressed={building===b.id}
              aria-label={b.id==='DEEK'?'Select Deeksha Bhawan building':'Select Institute of Engineering & Technology building'}
              className={building===b.id?'active':''} onClick={()=>onBuildingChange(b.id)}>
              <Building2 size={16}/>{b.id==='DEEK'?'Deeksha':b.short}
            </button>)}
          </div>}
        </div>
        {slotSummary&&<p className="bp-slot-context">
          <Clock3 size={13} aria-hidden="true"/>
          <span>{slotSummary}</span>
          {requiredSeats>0&&<span className="bp-slot-capacity">· {requiredSeats} seats minimum</span>}
        </p>}
      </div>
      <div className="bp-head-actions">
        <RoomQuickFind rooms={rooms} onFindRoom={onFindRoom}/>
        <div className="bp-view-toggle" role="group" aria-label="Floor display mode">
        <button type="button" aria-pressed={mode==='plan'} className={mode==='plan'?'active':''}
          onClick={()=>onModeChange('plan')}><MapIcon size={15}/> Map</button>
        <button type="button" aria-pressed={mode==='list'} className={mode==='list'?'active':''}
          onClick={()=>onModeChange('list')}><List size={15}/> List</button>
      </div>
      </div>
    </header>
    <div className="bp-navigation-stage" role="group" aria-label="Floor plan and navigation">
      <button type="button" className="bp-floor-arrow bp-floor-previous"
        aria-label="Previous floor"
        title={floorIndex>0?'Previous floor: '+availableFloors[floorIndex-1]:'First floor reached'}
        disabled={floorIndex<=0} onClick={()=>onNavigateFloor(-1)}>
        <ChevronLeft size={22}/>
      </button>
    {mode==='list'?<div className="bp-list">
      <div className="bp-list-top"><span>{filtered.length} mapped spaces</span><label>Sort <select value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="id">Room number</option><option value="capacity">Capacity</option></select></label></div>
      <div className="bp-list-rooms">{sorted.map(r=><button type="button" key={r.id} className={'bp-list-row'+(selected===r.id?' is-selected':'')} onClick={()=>onSelect(r)}>
        <span className="bp-list-icon"><DoorOpen size={17}/></span><span className="bp-list-id"><strong>{r.id}</strong><small>{r.type} · {r.capacity}{r.verified?'':'*'} seats</small></span>
        <span className={'bp-list-status bp-list-'+stateOf(r)}>
          {activeSessions[r.id]?<><span className="bp-list-live">Running now</span>
            <small className="bp-list-live-title">{activeSessions[r.id].title}</small></>:statuses[stateOf(r)]}
        </span>
      </button>)}{!sorted.length&&<p className="bp-list-empty">No rooms loaded for this floor.</p>}</div>
    </div>:<div className="bp-viewport" ref={viewportRef}>
      <svg viewBox={isDeek?'0 70 940 455':'0 80 940 335'} className="bp-svg" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Interactive classroom floor plan. Use Tab and Enter to select a room.">
        <Shell building={building} floor={floor}/>
        {layout.map(item=><Room key={item.id} item={item} room={byId.get(item.id)} availability={stateOf(byId.get(item.id))}
          selected={selected} onSelect={onSelect} activeSession={activeSessions[item.id]}/>)}
      </svg><div className="bp-mobile-cue">← Scroll sideways for the full floor plan →</div>
    </div>}
      <button type="button" className="bp-floor-arrow bp-floor-next"
        aria-label="Next floor"
        title={floorIndex>=0&&floorIndex<availableFloors.length-1?'Next floor: '+availableFloors[floorIndex+1]:'Last floor reached'}
        disabled={floorIndex<0||floorIndex>=availableFloors.length-1} onClick={()=>onNavigateFloor(1)}>
        <ChevronRight size={22}/>
      </button>
    </div>
    <div className="bp-floor-position" role="status" aria-live="polite" aria-atomic="true">
      <span className="bp-floor-position-dot" aria-hidden="true"/>
      <strong>{floor} floor</strong>
      <span className="bp-floor-position-count">{floorIndex+1} of {availableFloors.length}</span>
    </div>
    <footer className="bp-footer"><div className="bp-legend">
      {Object.entries(statuses).filter(([s])=>s!=='pending').map(([s,label])=><span key={s}><i className={'bp-dot bp-dot-'+s}/>{label}</span>)}
      <span><i className="bp-dot bp-dot-live"/>Running now</span>
    </div><p className="bp-footnote">Availability: selected slot · Live classes: current time · Floor layout schematic, not to scale</p>
      {missing.length>0&&<p>{missing.length} room(s) are not on this drawing. Find them in List view.</p>}</footer>
  </section>;
}
