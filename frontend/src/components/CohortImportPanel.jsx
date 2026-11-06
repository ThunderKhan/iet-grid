import React,{useState} from 'react';

/* The official roster is not embedded in source control. This administrator-only
   workflow previews and validates institutional cohort CSVs before any writes. */
export default function CohortImportPanel({onImport}) {
  const [csv,setCsv]=useState('');
  const [fileName,setFileName]=useState('');
  const [preview,setPreview]=useState(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  async function chooseFile(event) {
    const file=event.target.files?.[0];
    setPreview(null);setMessage('');setCsv('');setFileName(file?.name||'');
    if(!file)return;
    if(file.size>256000){setMessage('CSV must be 256 KB or smaller.');return;}
    try {setCsv(await file.text());}
    catch {setMessage('Unable to read the selected CSV.');}
  }
  async function upload(dryRun) {
    if(!csv||busy)return;
    setBusy(true);setMessage('');
    try {
      const result=await onImport(csv,dryRun);
      if(dryRun){setPreview(result);setMessage('Validation passed. Review the preview before committing.');}
      else {
        setPreview(null);setCsv('');setFileName('');
        setMessage('Imported '+result.imported_rows+' academic cohort records. No student identities were created.');
      }
    } catch(error) {setMessage('Import failed: '+(error.message||String(error)));}
    finally {setBusy(false);}
  }
  return <section className="ig-card" aria-label="Official academic cohort import">
    <div className="ig-card-head"><div className="ig-card-head-text">
      <h2>Academic cohort dataset</h2>
      <p>University administrator only · Validate official branch, year, batch and section metadata before saving.</p>
    </div></div>
    <div className="ig-admin-form">
      <p className="ig-note">This is a cohort importer, <strong>not a student roster importer</strong>. The organizer's individual student dataset must be obtained and identity-verified separately. Never fabricate enrollment records.</p>
      <a className="ig-link" href="/templates/cohorts-template.csv" download>Download required CSV column template</a>
      <label>Authorized university CSV
        <input type="file" accept=".csv,text/csv" onChange={chooseFile} aria-label="Choose academic cohorts CSV"/>
      </label>
      {fileName&&<p className="ig-note">Selected: {fileName}</p>}
      <div className="ig-approval-actions">
        <button type="button" className="ig-btn ig-btn-outline" disabled={!csv||busy} onClick={()=>upload(true)}>
          {busy?'Working…':'Validate / preview'}
        </button>
        <button type="button" className="ig-btn ig-btn-primary"
          disabled={!csv||!preview?.dry_run||busy} onClick={()=>upload(false)}>
          Commit verified CSV
        </button>
      </div>
      {message&&<p role="status" aria-live="polite" className="ig-note">{message}</p>}
      {preview?.dry_run&&<div className="ig-audit-scroll">
        <p className="ig-note">{preview.valid_rows} valid cohorts; first {preview.preview?.length||0} shown.</p>
        <table className="ig-audit-table"><thead><tr>
          <th>Code</th><th>Branch</th><th>Year</th><th>Section</th><th>Batch</th><th>Size</th>
        </tr></thead><tbody>{(preview.preview||[]).map(row=><tr key={row.code}>
          <td>{row.code}</td><td>{row.branch}</td><td>{row.academic_year}</td>
          <td>{row.section}</td><td>{row.batch_start}</td><td>{row.expected_size??'Unknown'}</td>
        </tr>)}</tbody></table>
      </div>}
    </div>
  </section>;
}
