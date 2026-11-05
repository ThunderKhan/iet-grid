// Test-only fixture. Never import this into frontend/src runtime code.
const room=(id,building,floor,capacity=75,type='classroom',verified=false)=>({id,building,floor,capacity,type,verified,active:true});
export const sampleRooms=[
room('IET22','IET','First',75,'lab'),room('IET16','IET','First',75,'lab'),room('IET14','IET','First',75,'lab'),room('IET15','IET','First',75,'lab'),
room('IET20','IET','First'),room('IET19','IET','First'),room('IET18','IET','First'),room('IET17','IET','First'),
room('IET32','IET','Second',200,'seminar',true),room('IET24','IET','Second'),room('IET25','IET','Second'),
room('IET30','IET','Second'),room('IET29','IET','Second'),room('IET28','IET','Second'),room('IET23','IET','Second'),
room('LIBRARY','IET','Ground',165,'library',true),
...Array.from({length:14},(_,i)=>room('LH'+String(i+1).padStart(2,'0'),'DEEK',i<7?'Ground':'First',75,'classroom'))
];

export const previewCohorts=[
  ...['CSE','AI ML','AI DS','ECE','ME','IT'].flatMap(branch=>
    [1,2,3,4].flatMap(year=>(branch==='CSE'||branch==='AI ML'?['A','B']:['']).map(section=>({
      id:'test-'+branch.replace(/\W/g,'').toLowerCase()+'-y'+year+'-'+(section||'x').toLowerCase(),
      code:branch.replace(/\s/g,'')+'-'+year+(section?'-'+section:''),
      branch,academic_year:year,section,active:true
    })))
  )
];


