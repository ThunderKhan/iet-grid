import React, {useEffect, useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {ArrowRight, CalendarDays, Check, Clock3, Info, Users, X} from 'lucide-react';
import {branchLabel,formatCohort,SECTION_NONE,cohortBranchOptions,cohortYearOptions,cohortSectionOptions,cohortMatches} from '../academicCohorts';
import './ReservationDialog.css';

const SESSION_TYPES=[['lecture','Lecture'],['practical','Practical'],['exam','Exam'],['event','Event']];
const day=d=>d?new Date(d+'T12:00:00Z').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}):'No date';

export function AcademicGroupFields({open,cohorts,cohortId,setCohortId,groupRequired}) {
  const [branch,setBranch]=useState('');
  const [year,setYear]=useState('');
  const [section,setSection]=useState('');
  useEffect(()=>{
    if(!open)return;
    const group=cohorts.find(c=>c.id===cohortId);
    setBranch(group?branchLabel(group.branch):'');
    setYear(group?String(group.academic_year):'');
    setSection(group?(group.section?String(group.section):SECTION_NONE):'');
  },[open,cohorts]);
  const branches=cohortBranchOptions(cohorts);
  const years=cohortYearOptions(cohorts,branch);
  const sections=cohortSectionOptions(cohorts,branch,year);
  const candidates=cohortMatches(cohorts,branch,year,section);
  const needsBatch=!!section&&candidates.length>1;
  const chooseBranch=value=>{
    setBranch(value);setYear('');setSection('');setCohortId('');
  };
  const chooseYear=value=>{
    setYear(value);setSection('');setCohortId('');
  };
  const chooseSection=value=>{
    setSection(value);
    const matches=cohortMatches(cohorts,branch,year,value);
    setCohortId(matches.length===1?matches[0].id:'');
  };
  return <div className="rc-academic-fields" role="group" aria-label="Academic group">
    <div className="rc-academic-grid">
      <label className="rc-academic-field" htmlFor="rc-branch">
        <span>Branch</span>
        <select id="rc-branch" value={branch} onChange={e=>chooseBranch(e.target.value)} required={groupRequired}>
          <option value="">Select branch</option>
          {branches.map(value=><option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="rc-academic-field" htmlFor="rc-year">
        <span>Year</span>
        <select id="rc-year" value={year} disabled={!branch} onChange={e=>chooseYear(e.target.value)} required={groupRequired}>
          <option value="">{branch?'Select year':'Choose branch first'}</option>
          {years.map(value=><option key={value} value={value}>Year {value}</option>)}
        </select>
      </label>
      <label className="rc-academic-field" htmlFor="rc-section">
        <span>Section</span>
        <select id="rc-section" value={section} disabled={!year} onChange={e=>chooseSection(e.target.value)} required={groupRequired}>
          <option value="">{year?'Select section':'Choose year first'}</option>
          {sections.map(value=><option key={value} value={value}>{value===SECTION_NONE?'No section':'Section '+value}</option>)}
        </select>
      </label>
      {needsBatch&&<label className="rc-academic-field rc-academic-batch" htmlFor="rc-batch">
        <span>Batch</span>
        <select id="rc-batch" value={candidates.some(c=>c.id===cohortId)?cohortId:''}
          onChange={e=>setCohortId(e.target.value)} required={groupRequired}>
          <option value="">Select batch</option>
          {candidates.map(c=><option key={c.id} value={c.id}>{c.batch_start||'Batch not specified'} · {c.code}</option>)}
        </select>
      </label>}
    </div>
  </div>;
}

export default function ReservationDialog({
  open,onOpenChange,room,date,hour,duration,bookingTitle,setBookingTitle,
  bookingKind,setBookingKind,cohorts,cohortId,setCohortId,
  cohortError,loading,canBook,available,onConfirm
}) {
  const group=cohorts.find(c=>c.id===cohortId);
  const groupRequired=bookingKind!=='event'&&(cohorts.length>0||Boolean(cohortError));
  const valid=!!room&&canBook&&available&&bookingTitle.trim().length>=3&&bookingTitle.trim().length<=150
    &&(!groupRequired||!!group)&&!loading;
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="rc-overlay"/>
      <Dialog.Content className="rc-dialog" aria-describedby="rc-description">
        <div className="rc-top"><div><span className="rc-overline">NEW RESERVATION · STEP 2 OF 2</span>
          <Dialog.Title>Reserve {room?.id||'classroom'}</Dialog.Title></div>
          <Dialog.Close aria-label="Close reservation"><X size={19}/></Dialog.Close></div>
        <Dialog.Description id="rc-description">Choose the academic group, session type and title. The server verifies availability when you submit.</Dialog.Description>
        <div className="rc-when">
          <span><CalendarDays size={16}/>{day(date)}</span>
          <span><Clock3 size={16}/>{String(hour).padStart(2,'0')}:00 · {duration}h IST</span>
          <span><Users size={16}/>{room?.capacity||0}{room?.verified?'':'*'} seats</span>
        </div>
        <div className="rc-section">
          <span className="rc-label">What kind of session?</span>
          <div className="rc-type-tabs" role="group" aria-label="Booking type">
            {SESSION_TYPES.map(([kind,label])=><button key={kind} type="button" aria-pressed={bookingKind===kind}
              className={bookingKind===kind?'active':''} onClick={()=>setBookingKind(kind)}>
              {bookingKind===kind&&<Check size={13}/>} {label}</button>)}
          </div>
        </div>
        <div className="rc-section">
          <span className="rc-label">Academic group {groupRequired?'(required)':'(optional)'}</span>
          {cohorts.length>0&&<AcademicGroupFields open={open} cohorts={cohorts} cohortId={cohortId}
            setCohortId={setCohortId} groupRequired={groupRequired}/>}
          <p className="rc-helper">{group?'This booking will be linked to the registered cohort.':
            cohortError||(!cohorts.length?'No official cohorts have been imported. This booking can be created without cohort linkage; personalized student updates will remain unavailable.':'Select the class this booking is for.')}</p>
        </div>
        <div className="rc-section">
          <label className="rc-label" htmlFor="rc-session-title">Session title</label>
          <input id="rc-session-title" className="rc-title-input" value={bookingTitle} onChange={e=>setBookingTitle(e.target.value)}
            placeholder="e.g. Machine Learning extra lecture" maxLength={150} minLength={3} required/>
          <p className="rc-helper">Shown on the timetable and reservation record. {group&&<strong>{formatCohort(group)} will be attached.</strong>}</p>
        </div>
        <div className="rc-confirm-row">
          <span><Info size={15}/> {bookingKind==='exam'||bookingKind==='event'?'Approval may be required.':'Availability will be checked again.'}</span>
          <button type="button" disabled={!valid} onClick={onConfirm}>
            {loading?'Saving…':bookingKind==='exam'||bookingKind==='event'?'Request reservation':'Confirm reservation'} <ArrowRight size={16}/>
          </button>
        </div>
        {!available&&<p className="rc-error">This room is not verified as available for the selected time.</p>}
        {groupRequired&&!group&&<p className="rc-error" role="status">Select a registered academic group to continue.</p>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
