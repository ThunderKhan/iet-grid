/** Academic cohort presentation and local-only sample groups.
 * Live group identities are loaded from /api/v1/cohorts and their UUIDs are
 * passed to /api/v1/bookings. Never infer cohort_id from a branch label.
 */
export const BRANCH_NAMES={
  CSE:'CSE',AIML:'AI/ML','AI ML':'AI/ML','AI-ML':'AI/ML',AIDS:'AI/DS',
  'AI DS':'AI/DS','AI-DS':'AI/DS',ECE:'ECE',ME:'ME',IT:'IT'
};
export function branchLabel(raw){
  const value=String(raw??'').trim();
  const key=value.toUpperCase();
  return BRANCH_NAMES[key]||value;
}
export function formatCohort(group){
  if(!group)return '';
  const b=branchLabel(group.branch||group.code||'Academic group');
  const year=group.academic_year ? ' · Year '+String(group.academic_year):'';
  const section=group.section ? ' · Section '+String(group.section):'';
  return b+year+section;
}
export const previewCohorts=[
  ...['CSE','AI ML','AI DS','ECE','ME','IT'].flatMap(branch=>
    [1,2,3,4].flatMap(year=>(branch==='CSE'||branch==='AI ML'?['A','B']:['']).map(section=>({
      id:'demo-'+branch.replace(/\W/g,'').toLowerCase()+'-y'+year+'-'+(section||'x').toLowerCase(),
      code:branch.replace(/\s/g,'')+'-'+year+(section?'-'+section:''),
      branch,academic_year:year,section,active:true,preview:true,
    })))
  )
];
