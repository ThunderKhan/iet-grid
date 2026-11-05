import React, {useMemo, useState} from 'react';
import {TransformComponent, TransformWrapper} from 'react-zoom-pan-pinch';
import {Check, DoorOpen, Info, List, Map, Minus, Plus, RotateCcw, Search, Users} from 'lucide-react';
import './FloorPlan.css';

// These are schematic groupings, NOT traced architectural boundaries.
// Preserve the source room IDs. A validated SVG overlay can replace the
// geometry without changing the selection/booking contract.
const SCHEMES = {
  'IET:Ground': [['LIBRARY']],
  'IET:First': [['IET22','IET16','IET14','IET15'],['IET20','IET19','IET18','IET17']],
  'IET:Second': [['IET32','IET24','IET25'],['IET30','IET29','IET28','IET23']],
  'DEEK:Ground': [['LH01'],['LH02'],['LH03','LH04','LH05'],['LH06','LH07']],
  'DEEK:First': [['LH08'],['LH09'],['LH10','LH11','LH12'],['LH13','LH14']]
};
const STATUS_LABELS = {available:'Available',occupied:'Occupied',restricted:'Does not meet requirements',unknown:'Not verified',pending:'Approval pending'};
const FILL = {available:'#E7F6EE',occupied:'#FDECEF',restricted:'#F1ECFF',unknown:'#EDF2F7',pending:'#FFF3D8'};
const STROKE = {available:'#2B9065',occupied:'#BA3746',restricted:'#8057C1',unknown:'#8898AC',pending:'#A76A19'};
function normalizedStatus(value) {
  if (value==='selected') return 'unknown';
  return Object.hasOwn(STATUS_LABELS,value) ? value : 'unknown';
}
function PlanCanvas({group,rows,selected,onSelect,getStatus,building,floor}) {
  const height=Math.max(365,130+rows.length*122);
  return <svg className="ig-plan-svg" viewBox={'0 0 880 '+height} role="group"
    aria-label={building+' '+floor+' floor schematic room plan'} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="ig-plan-grid" width="22" height="22" patternUnits="userSpaceOnUse">
        <path d="M22 0H0V22" fill="none" stroke="#C8D8E9" strokeWidth=".55" opacity=".75"/>
      </pattern>
    </defs>
    <rect x="11" y="11" width="858" height={height-22} rx="16" fill="#EDF4FB" stroke="#AFC3D9" strokeWidth="2"/>
    <rect x="19" y="19" width="842" height={height-38} rx="12" fill="url(#ig-plan-grid)"/>
    <text x="40" y="55" className="ig-plan-svg-heading">{building==='IET'?'INSTITUTE OF ENGINEERING & TECHNOLOGY':'DEEKSHA BHAWAN'} · {floor.toUpperCase()}</text>
    {rows.map((ids,row)=>{
      const matched=ids.map(id=>group.find(r=>r.id===id)).filter(Boolean);
      const count=matched.length;
      const gap=12, width=count?Math.min(240,(786-gap*(count-1))/count):0;
      const total=width*count+gap*(count-1);
      const offset=440-total/2;
      const y=76+row*122;
      return <React.Fragment key={row}>
        {matched.map((room,col)=>{
          const status=normalizedStatus(getStatus(room));
          const x=offset+col*(width+gap);
          const active=selected===room.id;
          return <g key={room.id} role="button" tabIndex={0} aria-pressed={active}
            aria-label={room.id+', '+STATUS_LABELS[status]+', '+room.capacity+' seats'+(room.verified?'':', capacity estimated')}
            onClick={()=>onSelect(room)}
            onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(room)}}}
            className={'ig-plan-room '+(active?'is-active':'')}
            style={{cursor:'pointer',outline:'none'}}>
            <rect x={x} y={y} width={width} height="82" rx="7" fill={active?'#315CE5':FILL[status]}
              stroke={active?'#254ECC':STROKE[status]} strokeWidth={active?3:1.8}/>
            {active&&<rect x={x+5} y={y+5} width={width-10} height="72" rx="5"
              fill="none" stroke="#FFFFFF" strokeDasharray="4 4" strokeWidth="1.2" opacity=".9"/>}
            <text x={x+13} y={y+29} className="ig-plan-room-name" fill={active?'#FFFFFF':'#20364F'}>{room.id}</text>
            <text x={x+13} y={y+48} className="ig-plan-room-type" fill={active?'#E3EBFF':'#52667D'}>{room.type==='lab'?'Laboratory':room.type==='seminar'?'Seminar':room.type==='library'?'Library':'Classroom'}</text>
            <text x={x+13} y={y+67} className="ig-plan-room-detail" fill={active?'#E3EBFF':'#52667D'}>{room.capacity+(room.verified?'':'*')+' seats'}</text>
            <circle cx={x+width-15} cy={y+17} r="5" fill={active?'#FFFFFF':STROKE[status]}/>
          </g>;
        })}
        {row<rows.length-1&&<>
          <rect x="54" y={y+85} width="772" height="30" rx="6" fill="#DFEAF5" stroke="#C2D3E6" strokeDasharray="5 5"/>
          <text x="440" y={y+104} className="ig-plan-corridor" textAnchor="middle">CORRIDOR / CIRCULATION</text>
        </>}
      </React.Fragment>;
    })}
    <text x="440" y={height-41} textAnchor="middle" className="ig-plan-corridor">SCHEMATIC · GEOMETRY UNVERIFIED</text>
  </svg>;
}
export default function FloorPlan({rooms,building,floor,selected,onSelect,getStatus}) {
  const [view,setView]=useState('map');
  const [search,setSearch]=useState('');
  const group=useMemo(()=>rooms.filter(r=>r.building===building&&r.floor===floor),[rooms,building,floor]);
  const scheme=SCHEMES[building+':'+floor]||[];
  const rows=scheme.map(row=>row.filter(id=>group.some(r=>r.id===id)));
  const missing=group.filter(r=>!scheme.flat().includes(r.id));
  if(missing.length) rows.push(missing.map(r=>r.id));
  const visible=group.filter(r=>r.id.toLowerCase().includes(search.trim().toLowerCase()));
  const counts={available:0,occupied:0,restricted:0,unknown:0,pending:0};
  group.forEach(r=>{counts[normalizedStatus(getStatus(r))]++});
  return <div className="ig-plan-board">
    <div className="ig-plan-toolbar">
      <div className="ig-plan-title"><div className="ig-plan-icon"><Map size={18}/></div>
        <div><strong>Interactive floor board</strong><span>{building==='IET'?'IET':'Deeksha Bhawan'} · {floor} floor · {group.length} spaces</span></div>
      </div>
      <div className="ig-plan-toggle" role="group" aria-label="Floor plan display">
        <button type="button" className={view==='map'?'is-current':''} aria-pressed={view==='map'} onClick={()=>setView('map')}><Map size={15}/> Map</button>
        <button type="button" className={view==='list'?'is-current':''} aria-pressed={view==='list'} onClick={()=>setView('list')}><List size={15}/> List</button>
      </div>
    </div>
    {view==='map'?<div className="ig-plan-frame">
      <TransformWrapper key={building+':'+floor} initialScale={1} minScale={0.8} maxScale={3.5}
        centerOnInit={true} wheel={{step:0.12}} panning={{velocityDisabled:true}} doubleClick={{disabled:true}}>
        {({zoomIn,zoomOut,resetTransform})=><>
          <div className="ig-plan-zoom" role="group" aria-label="Map zoom">
            <button type="button" title="Zoom in" aria-label="Zoom in" onClick={()=>zoomIn()}><Plus size={16}/></button>
            <button type="button" title="Zoom out" aria-label="Zoom out" onClick={()=>zoomOut()}><Minus size={16}/></button>
            <button type="button" title="Reset zoom" aria-label="Reset zoom" onClick={()=>resetTransform()}><RotateCcw size={16}/></button>
          </div>
          <TransformComponent wrapperClass="ig-plan-wrapper" contentClass="ig-plan-transform">
            <PlanCanvas group={group} rows={rows} building={building} floor={floor} selected={selected} onSelect={onSelect} getStatus={getStatus}/>
          </TransformComponent>
        </>}
      </TransformWrapper>
      <span className="ig-plan-hint">Drag to pan · Scroll or pinch to zoom</span>
    </div>:<div className="ig-plan-list-view">
      <label className="ig-plan-search"><Search size={17}/><span className="sr-only">Search room ID</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search room number…"/></label>
      <div className="ig-plan-room-list">
        {visible.map(room=>{const s=normalizedStatus(getStatus(room));return <button key={room.id} type="button" className={'ig-plan-list-row '+(selected===room.id?'is-current':'')} onClick={()=>onSelect(room)}>
          <div className="ig-plan-list-symbol"><DoorOpen size={18}/></div>
          <div><b>{room.id}</b><span>{room.type} · {room.capacity}{room.verified?'':'*'} seats</span></div>
          <span className={'ig-status ig-status-'+s}>{STATUS_LABELS[s]}</span>
          {selected===room.id&&<Check size={17} className="ig-plan-list-check"/>}
        </button>})}
        {!visible.length&&<div className="ig-plan-no-results">No rooms match this search or floor.</div>}
      </div>
    </div>}
    <div className="ig-plan-footer">
      <div className="ig-plan-legend">
        <span><i className="ig-pdot available"/> {counts.available} available</span>
        <span><i className="ig-pdot occupied"/> {counts.occupied} occupied</span>
        <span><i className="ig-pdot restricted"/> {counts.restricted} restricted</span>
        <span><i className="ig-pdot unknown"/> {counts.unknown} unknown</span>
      </div>
      <p><Info size={14}/> Schematic layout, not to scale. Positions and stairs are illustrative; * capacity unverified.</p>
    </div>
  </div>;
}