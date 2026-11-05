import React, {useState} from 'react';
import {Upload, Sparkles, Eye, CheckCircle2, AlertTriangle} from 'lucide-react';
import './AITimetableImport.css';

export default function AITimetableImport({apiFetch, onDone}) {
  const [file,setFile]=useState(null),[parsed,setParsed]=useState(null),[start,setStart]=useState(''),[end,setEnd]=useState('');
  const [preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');

  async function parseFile(){
    if(!file)return setError('Choose a PDF or DOCX timetable first.');
    setBusy(true);setError('');setMessage('');setPreview(null);
    try{
      const form=new FormData();form.append('file',file);
      const result=await apiFetch('/api/v1/admin/ai/timetable/parse',{method:'POST',headers:{},body:form});
      setParsed(result.timetable);
      const effective=result.timetable.effective_from||'';
      setStart(effective);setEnd(effective);
      setMessage(result.warning||('Parsed '+result.timetable.rows.length+' timetable rows.'));
    }catch(e){setError(e.message||'Could not parse timetable.');}finally{setBusy(false);}
  }

  async function previewImport(){
    if(!parsed)return setError('Parse the timetable first.');
    if(!start||!end)return setError('Select the occurrence start and end dates.');
    setBusy(true);setError('');setMessage('');
    try{
      const result=await apiFetch('/api/v1/admin/ai/timetable/preview',{method:'POST',
        body:JSON.stringify({timetable:parsed,occurrence_start:start,occurrence_end:end})});
      setPreview(result);
      setMessage(result.conflict_count?result.ready_count+' occurrences ready; '+result.conflict_count+' need attention.':result.ready_count+' occurrences are ready to reserve.');
    }catch(e){setError(e.message||'Could not build the reservation preview.');}finally{setBusy(false);}
  }

  async function confirmImport(){
    if(!preview?.occurrences?.length)return;
    const ready=preview.occurrences.filter(x=>x.status==='ready');
    if(!ready.length)return setError('There are no conflict-free occurrences to confirm.');
    if(!window.confirm('Confirm '+ready.length+' timetable room reservations?'))return;
    setBusy(true);setError('');setMessage('');
    try{
      const result=await apiFetch('/api/v1/admin/ai/timetable/confirm',{method:'POST',
        body:JSON.stringify({rows:ready.map(x=>({row_index:x.row_index,room_id:x.room_id,starts_at:x.start,ends_at:x.end,
          cohort_id:x.cohort_id,required_capacity:x.expected_size||1,required_equipment:[]}))})});
      setMessage('Confirmed '+result.confirmed_count+' reservations. '+result.failed_count+' failed.');
      if(result.confirmed_count)onDone?.();
    }catch(e){setError(e.message||'Reservation confirmation failed.');}finally{setBusy(false);}
  }

  return <section className="ig-card ig-ai-timetable">
    <div className="ig-ai-head"><div>
      <div className="ig-ai-eyebrow"><Sparkles size={15}/> AI TIMETABLE IMPORT</div>
      <h2>Turn a timetable into room reservations</h2>
      <p>Upload the university timetable, preview deterministic room assignments, then confirm them through the existing booking authority.</p>
    </div></div>

    <div className="ig-ai-step"><span>1</span><div><strong>Upload timetable</strong>
      <p>Text-based PDF or DOCX. OpenAI is optional; the local parser works without API credit.</p>
      <div className="ig-ai-upload"><input id="ai-timetable-file" type="file" accept=".pdf,.docx"
        onChange={e=>{setFile(e.target.files?.[0]||null);setParsed(null);setPreview(null);}}/>
        <label htmlFor="ai-timetable-file"><Upload size={16}/>{file?file.name:'Choose timetable file'}</label>
        <button type="button" className="ig-btn ig-btn-primary ig-btn-small" disabled={!file||busy} onClick={parseFile}>{busy?'Parsing…':'Parse timetable'}</button>
      </div>
    </div></div>

    {parsed&&<div className="ig-ai-step"><span>2</span><div><strong>Choose occurrence dates</strong>
      <p>{parsed.title} · {parsed.rows.length} parsed rows{parsed.effective_from?' · Effective from '+parsed.effective_from:''}</p>
      <div className="ig-ai-dates"><label>From<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
        <label>To<input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label>
        <button type="button" className="ig-btn ig-btn-outline ig-btn-small" disabled={busy} onClick={previewImport}><Eye size={16}/>{busy?'Working…':'Preview reservations'}</button>
      </div>
    </div></div>}

    {preview&&<div className="ig-ai-step"><span>3</span><div><strong>Review allocation</strong>
      <p>{preview.ready_count} ready · {preview.conflict_count} conflicts · {preview.total_count} total occurrences</p>
      <div className="ig-ai-table-wrap"><table className="ig-ai-table"><thead><tr><th>Date</th><th>Time</th><th>Course</th><th>Cohort</th><th>Room</th><th>Status</th></tr></thead>
        <tbody>{preview.occurrences.slice(0,80).map((x,i)=><tr key={i}><td>{x.date}</td><td>{x.start?.slice(11,16)}–{x.end?.slice(11,16)}</td>
          <td><b>{x.course_code}</b><small>{x.faculty||''}</small></td><td>{x.cohort}</td><td>{x.room_id||'—'}<small>{x.room_source==='auto'?'Auto-selected':'From timetable'}</small></td>
          <td><span className={x.status==='ready'?'ig-ai-ok':'ig-ai-bad'}>{x.status==='ready'?'Ready':x.reason||'Conflict'}</span></td></tr>)}</tbody>
      </table></div>
      {preview.total_count>80&&<p className="ig-note">Showing the first 80 occurrences. All occurrences are still included in the confirmation plan.</p>}
      <button type="button" className="ig-btn ig-btn-primary" disabled={busy||preview.ready_count===0} onClick={confirmImport}>
        <CheckCircle2 size={16}/>{busy?'Confirming…':'Confirm '+preview.ready_count+' reservations'}</button>
    </div></div>}

    {(message||error)&&<div className={error?'ig-ai-message error':'ig-ai-message'}>{error?<AlertTriangle size={17}/>:<CheckCircle2 size={17}/>}<span>{error||message}</span></div>}
  </section>;
}
