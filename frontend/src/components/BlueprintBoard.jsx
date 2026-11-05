import React, {useMemo, useState} from 'react';
import {Building2, Check, DoorOpen, List, Map as MapIcon} from 'lucide-react';
import './BlueprintBoard.css';

/**
 * Interactive hotspots aligned to the ACTUAL source blueprint crops.
 * Coordinates are in image pixels; the image is scaled proportionally and
 * hotspots use percentages, so they never drift at responsive breakpoints.
 *
 * The artwork is a lossless monochrome extract of the drawing supplied with
 * the Build With AI: DevOps 2026 problem statement (page 1).
 * Hotspot bounds are approximate manually traced selectable areas, not
 * architectural CAD geometry or evidence of exact dimensions.
 */
const PLAN={
  'IET:Ground':{src:'/floorplans/iet-ground.png',w:812,h:202,locations:[
    ['LIBRARY',20,14,333,75]
  ]},
  'IET:First':{src:'/floorplans/iet-first.png',w:812,h:229,locations:[
    ['IET22',22,17,145,72],['IET16',191,17,158,72],
    ['IET14',458,17,152,72],['IET15',631,17,146,72],
    ['IET20',25,145,168,63],['IET19',220,145,170,63],
    ['IET18',407,145,171,63],['IET17',595,145,185,63]
  ]},
  'IET:Second':{src:'/floorplans/iet-second.png',w:812,h:228,locations:[
    ['IET32',22,19,330,73],['IET24',482,19,124,73],['IET25',623,19,154,73],
    ['IET30',24,145,164,60],['IET29',216,145,176,60],
    ['IET28',410,145,172,60],['IET23',602,145,174,60]
  ]},
  'DEEK:Ground':{src:'/floorplans/deeksha-ground.png',w:597,h:312,locations:[
    ['LH01',178,15,285,40],['LH02',76,76,356,30],
    ['LH03',172,126,95,47],['LH04',284,127,99,46],['LH05',483,117,87,75],
    ['LH06',22,228,166,66],['LH07',397,231,172,63]
  ]},
  'DEEK:First':{src:'/floorplans/deeksha-first.png',w:597,h:311,locations:[
    ['LH08',175,16,290,38],['LH09',75,75,350,30],
    ['LH10',172,126,94,48],['LH11',283,127,100,47],['LH12',483,118,88,74],
    ['LH13',22,226,175,62],['LH14',398,226,172,62]
  ]}
};
const LABELS={available:'Available',occupied:'Occupied',restricted:'Not eligible',unknown:'Not verified',pending:'Pending'};
function statusName(value){return LABELS[value]?value:'unknown';}

export default function BlueprintBoard({rooms,building,floor,selected,onSelect,getStatus}) {
  const [showList,setShowList]=useState(false);
  const key=building+':'+floor;
  const plan=PLAN[key];
  const currentRooms=useMemo(()=>rooms.filter(r=>r.building===building&&r.floor===floor),[rooms,building,floor]);
  const byId=new Map(currentRooms.map(r=>[r.id,r]));
  const mapped=new Set(plan?.locations.map(p=>p[0])||[]);
  const other=currentRooms.filter(r=>!mapped.has(r.id));
  if(!plan)return <div role="status" className="bp-no-plan">No blueprint is available for this floor.</div>;
  const statuses=currentRooms.reduce((acc,r)=>{const s=statusName(getStatus(r));acc[s]=(acc[s]||0)+1;return acc},{});
  return <div className="bp-board">
    <div className="bp-board-head">
      <div>
        <span className="bp-kicker">OFFICIAL SOURCE DRAWING</span>
        <h2>{building==='IET'?'Institute of Engineering & Technology':'Deeksha Bhawan'} <span> / {floor} floor</span></h2>
      </div>
      <div className="bp-switch" role="group" aria-label="Floor plan view">
        <button type="button" aria-pressed={!showList} className={!showList?'on':''} onClick={()=>setShowList(false)}><MapIcon size={16}/> Plan</button>
        <button type="button" aria-pressed={showList} className={showList?'on':''} onClick={()=>setShowList(true)}><List size={16}/> Rooms</button>
      </div>
    </div>
    {!showList?<div className="bp-drawing-wrap">
      <div className="bp-drawing">
        <img src={plan.src} alt={'Architectural floor plan from the supplied campus blueprint for '+(building==='IET'?'IET':'Deeksha Bhawan')+', '+floor+' floor'} draggable={false}/>
        {plan.locations.map(([roomId,x,y,w,h])=>{
          const room=byId.get(roomId);
          if(!room)return null;
          const s=statusName(getStatus(room));
          const active=selected===roomId;
          return <button key={roomId} type="button" className={'bp-hotspot bp-'+s+(active?' bp-active':'')}
            style={{left:(x/plan.w*100)+'%',top:(y/plan.h*100)+'%',width:(w/plan.w*100)+'%',height:(h/plan.h*100)+'%'}}
            title={roomId+' · '+LABELS[s]}
            aria-label={'Select '+roomId+', '+LABELS[s]+', '+room.capacity+' seats'}
            aria-pressed={active}
            onClick={()=>onSelect(room)}>
            <span className="bp-hotspot-dot" aria-hidden="true"/>
          </button>;
        })}
      </div>
    </div>:<div className="bp-room-list" aria-label="Rooms on selected floor">
      {[...currentRooms].sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true})).map(room=>{
        const s=statusName(getStatus(room));return <button type="button" key={room.id} aria-pressed={selected===room.id}
          className={'bp-room-row '+(selected===room.id?'active':'')} onClick={()=>onSelect(room)}>
          <span className="bp-room-row-icon"><DoorOpen size={17}/></span>
          <span className="bp-room-row-info"><strong>{room.id}</strong><small>{room.type} · {room.capacity}{room.verified?'':'*'} seats</small></span>
          <span className={'bp-state bp-state-'+s}>{LABELS[s]}</span>
          {selected===room.id&&<Check size={17} className="bp-room-row-check"/>}
        </button>;
      })}
      {currentRooms.length===0&&<p>No rooms have been provisioned on this floor.</p>}
    </div>}
    <div className="bp-board-foot">
      <div className="bp-legend">
        <span><i className="bp-dot is-available"/>{statuses.available||0} available</span>
        <span><i className="bp-dot is-occupied"/>{statuses.occupied||0} occupied</span>
        <span><i className="bp-dot is-unknown"/>{statuses.unknown||0} unverified</span>
        {(statuses.restricted||0)>0&&<span><i className="bp-dot is-restricted"/>{statuses.restricted} not eligible</span>}
      </div>
      <p>Room positions follow the supplied blueprint. Select a room to inspect availability. Capacities marked * are estimates.</p>
      {other.length>0&&<p className="bp-unmapped">Unmapped in the drawing: {other.map(r=>r.id).join(', ')}. Switch to Rooms to select them.</p>}
    </div>
  </div>;
}
