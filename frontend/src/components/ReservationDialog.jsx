import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {ArrowRight, BookOpenText, CalendarDays, Check, Clock3, Info, Users, X} from 'lucide-react';
import {formatCohort} from '../academicCohorts';
import './ReservationDialog.css';

const SESSION_TYPES=[['lecture','Lecture'],['practical','Practical'],['exam','Exam'],['event','Event']];
const day=d=>d?new Date(d+'T12:00:00Z').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}):'No date';
export default function ReservationDialog({
  open,onOpenChange,room,date,hour,duration,bookingTitle,setBookingTitle,
  bookingKind,setBookingKind,cohorts,cohortId,setCohortId,
  cohortError,loading,canBook,available,onConfirm,demo
}) {
  const group=cohorts.find(c=>c.id===cohortId);
  const groupRequired=bookingKind!=='event';
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
          <label className="rc-label" htmlFor="rc-cohort">Academic group {groupRequired?'(required)':'(optional)'}</label>
          <div className="rc-select-wrap"><BookOpenText size={17}/>
            <select id="rc-cohort" value={cohortId} onChange={e=>setCohortId(e.target.value)}
              required={groupRequired} aria-invalid={groupRequired&&!group}>
              <option value="">Choose a branch, year and section</option>
              {cohorts.map(c=><option key={c.id} value={c.id}>{formatCohort(c)}</option>)}
            </select>
          </div>
          <p className="rc-helper">{demo?'Preview groups only; no official data is changed.':
            group?'This booking will be linked to the registered cohort.':
            cohortError||(!cohorts.length?'No registered academic cohorts were returned. Contact a coordinator.':'Select the class this booking is for.')}</p>
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
