
export const buildings=[
{id:'IET',name:'Institute of Engineering & Technology',short:'IET',floors:['Ground','First','Second']},
{id:'DEEK',name:'Deeksha Bhawan',short:'Deeksha Bhawan',floors:['Ground','First']}
];
const room=(id,building,floor,capacity=75,type='classroom',verified=false)=>({id,building,floor,capacity,type,verified,active:true});
export const sampleRooms=[
room('IET22','IET','First',75,'lab'),room('IET16','IET','First',75,'lab'),room('IET14','IET','First',75,'lab'),room('IET15','IET','First',75,'lab'),
room('IET20','IET','First'),room('IET19','IET','First'),room('IET18','IET','First'),room('IET17','IET','First'),
room('IET32','IET','Second',200,'seminar',true),room('IET24','IET','Second'),room('IET25','IET','Second'),
room('IET30','IET','Second'),room('IET29','IET','Second'),room('IET28','IET','Second'),room('IET23','IET','Second'),
room('LIBRARY','IET','Ground',165,'library',true),
...Array.from({length:14},(_,i)=>room('LH'+String(i+1).padStart(2,'0'),'DEEK',i<7?'Ground':'First',75,'classroom'))
];
export const demoBookings=[
{id:'demo-1',room_id:'IET18',title:'CSE · Data Structures',starts_at:nextSlot(0,10),ends_at:nextSlot(0,11),status:'confirmed',kind:'lecture'},
{id:'demo-2',room_id:'IET20',title:'AI/ML · Machine Learning',starts_at:nextSlot(0,11),ends_at:nextSlot(0,12),status:'confirmed',kind:'lecture'},
{id:'demo-3',room_id:'LH04',title:'ECE · Circuit Theory',starts_at:nextSlot(0,12),ends_at:nextSlot(0,13),status:'confirmed',kind:'lecture'},
{id:'demo-4',room_id:'IET32',title:'Guest Lecture · Seminar',starts_at:nextSlot(1,11),ends_at:nextSlot(1,13),status:'confirmed',kind:'event'}
];
export const demoNotices=[
{id:'n1',title:'Minor examination seating update',body:'Please confirm your exam room against the official timetable before attending.',priority:'high',created_at:new Date().toISOString()},
{id:'n2',title:'Room availability now online',body:'Search across IET and Deeksha Bhawan and request a room from the scheduling dashboard.',priority:'normal',created_at:new Date().toISOString()}
];
export function localDate(offset=0){let d=new Date();d.setDate(d.getDate()+offset);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function nextSlot(offset,h){return new Date(localDate(offset)+'T'+String(h).padStart(2,'0')+':00:00').toISOString()}
export function overlap(a,b,c,d){return new Date(a)<new Date(d)&&new Date(c)<new Date(b)}
export function occupancy(roomId,start,end,bookings){return bookings.some(x=>x.room_id===roomId&&['confirmed','pending'].includes(x.status)&&overlap(start,end,x.starts_at,x.ends_at))}
export function recommend(rooms,bookings,start,end,minCapacity,building='ALL',type='any'){
return rooms.filter(r=>r.active!==false&&r.capacity>=minCapacity&&(type==='any'||r.type===type)&&!occupancy(r.id,start,end,bookings)).map(r=>({...r,score:Math.max(1,100-Math.round((r.capacity-minCapacity)/5)-(building!=='ALL'&&r.building!==building?18:0)-(r.type==='lab'&&type==='any'?12:0))})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}
export function dateTimes(date,hour,duration=1){return {start:new Date(date+'T'+hour+':00').toISOString(),end:new Date(new Date(date+'T'+hour+':00').getTime()+duration*3600000).toISOString()}}
