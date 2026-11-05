import React, {useEffect, useRef, useState} from 'react';
import {Camera,Check,GraduationCap,ImagePlus,Info,Lock,Mail,Save,ShieldCheck,Trash2,UserRound,Users} from 'lucide-react';
import './ProfilePage.css';

/**
 * Campus profile settings. The form pattern is adapted from the open-source
 * shadcn profile/settings form, implemented in IET Grid's existing React/CSS
 * stack rather than importing an unrelated Tailwind design system.
 *
 * Official role, verified status and registered university cohort are NEVER
 * editable here. Personal academic preferences are stored as clearly marked
 * self-reported Auth metadata, which must never authorize university access.
 */
const BUCKET='iet-profile-avatars';
const MAX_PHOTO_SIZE=2*1024*1024;
const IMAGE_EXT={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
const safeText=(s,max=160)=>String(s??'').trim().slice(0,max);
const titleRole=role=>({student:'Student',faculty:'Faculty member',coordinator:'Coordinator',admin:'Administrator'})[role]||'Campus member';
const initial=value=>safeText(value).charAt(0).toUpperCase()||'G';

export function validateProfileImage(file){
  if(!file)return 'Choose a photo before uploading.';
  if(!Object.hasOwn(IMAGE_EXT,file.type))return 'Use a JPEG, PNG or WebP image.';
  if(file.size<=0||file.size>MAX_PHOTO_SIZE)return 'Profile photos must be smaller than 2 MB.';
  return '';
}
export function profileFormFrom(profile,user,demo=false){
  const meta=user?.user_metadata||{};
  return {
    fullName:safeText(profile?.full_name||meta.full_name||(demo?'Demo Faculty':''),90),
    phone:safeText(meta.campus_phone,24),
    bio:safeText(meta.campus_bio,240),
    branch:safeText(meta.campus_branch,60),
    academicYear:String(meta.campus_year||''),
    section:safeText(meta.campus_section,15),
    department:safeText(meta.campus_department,65),
  };
}
const emptyProfile=()=>({fullName:'',phone:'',bio:'',branch:'',academicYear:'',section:'',department:''});
const imageFor=(src,name,large=false)=>src
  ?<img src={src} alt={'Profile photo of '+name} className={'igp-photo'+(large?' large':'')}/>
  :<span className={'igp-avatar-initial'+(large?' large':'')} aria-label="No profile picture">{initial(name)}</span>;

export default function ProfilePage({supabase,session,profile,role='student',demo=false,
  avatarUrl='',onProfileChanged=()=>{}}){
  const user=session?.user;
  const [form,setForm]=useState(()=>profileFormFrom(profile,user,demo));
  const [file,setFile]=useState(null);
  const [removeAvatar,setRemoveAvatar]=useState(false);
  const [previewUrl,setPreviewUrl]=useState('');
  const [savedDemoAvatar,setSavedDemoAvatar]=useState('');
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState(null);
  const [passwordBusy,setPasswordBusy]=useState(false);
  const fileInput=useRef(null);
  const isStudent=role==='student';
  const fullName=form.fullName.trim()||'Campus member';
  const imageSource=removeAvatar?'':previewUrl||savedDemoAvatar||avatarUrl;
  const institutionalLine=profile?.branch
    ?[profile.branch,profile.academic_year?'Year '+profile.academic_year:'',profile.section?'Section '+profile.section:'']
       .filter(Boolean).join(' · '):'No institutional class assigned';
  const isVerified=!!profile?.verified&&!demo;

  useEffect(()=>{
    setForm(profileFormFrom(profile,user,demo));
  },[user?.id,profile?.full_name,demo]);

  useEffect(()=>{
    if(!file){setPreviewUrl('');return;}
    const url=URL.createObjectURL(file);
    setPreviewUrl(url);
    return()=>URL.revokeObjectURL(url);
  },[file]);

  const change=(key,value)=>{
    setFeedback(null);
    setForm(current=>({...current,[key]:value}));
  };
  const choosePhoto=event=>{
    const selected=event.target.files?.[0];
    event.target.value='';
    if(!selected)return;
    const error=validateProfileImage(selected);
    if(error){setFeedback({error:true,text:error});return;}
    setFile(selected);
    setRemoveAvatar(false);
    setFeedback(null);
  };
  const clearPhoto=()=>{
    setFile(null);
    setSavedDemoAvatar('');
    setRemoveAvatar(true);
    setFeedback(null);
  };

  const save=async event=>{
    event.preventDefault();
    if(busy)return;
    if(form.fullName.trim().length<2||form.fullName.trim().length>90){
      setFeedback({error:true,text:'Enter a name between 2 and 90 characters.'});return;
    }
    if(form.phone.trim()&&!/^[0-9+()\s-]{7,24}$/.test(form.phone.trim())){
      setFeedback({error:true,text:'Enter a valid contact number or leave it blank.'});return;
    }
    if(form.academicYear&&(!Number.isInteger(Number(form.academicYear))
      ||Number(form.academicYear)<1||Number(form.academicYear)>6)){
      setFeedback({error:true,text:'Select a valid academic year.'});return;
    }
    if(file){const error=validateProfileImage(file);if(error){setFeedback({error:true,text:error});return;}}
    setBusy(true);
    setFeedback(null);
    try{
      if(demo){
        onProfileChanged({...profile,full_name:form.fullName.trim()});
        // Preview changes exist only in this mounted component.
        if(removeAvatar){setSavedDemoAvatar('');setFile(null);}
        // Keep the demo File object mounted while its object URL is displayed.
        // Revoking the URL before use would leave a broken preview image.
        setRemoveAvatar(false);
        setFeedback({error:false,text:'Preview updated. Demo changes are not saved to the university database.'});
        return;
      }
      if(!supabase||!user?.id)throw new Error('Sign in again before editing your profile.');

      const previousAvatar=profile?.avatar_path||null;
      let avatarPath=removeAvatar?null:previousAvatar;
      let uploadedPath=null;
      if(file){
        const ext=IMAGE_EXT[file.type];
        const path=user.id+'/'+crypto.randomUUID()+'.'+ext;
        const result=await supabase.storage.from(BUCKET).upload(path,file,{
          contentType:file.type,cacheControl:'3600',upsert:false,
        });
        if(result.error)throw new Error('Could not upload your photo: '+result.error.message);
        uploadedPath=path;
        avatarPath=path;
      }

      // The database grants UPDATE only on full_name and avatar_path.
      // Role, verification, and official academic fields remain immutable.
      const changed=await supabase.from('profiles')
        .update({full_name:form.fullName.trim(),avatar_path:avatarPath})
        .eq('id',user.id).select('*').single();
      if(changed.error){
        if(uploadedPath)await supabase.storage.from(BUCKET).remove([uploadedPath]);
        throw new Error('Could not update your profile: '+changed.error.message);
      }
      onProfileChanged(changed.data);

      // These personal preferences are user-controlled; never use them for RLS.
      const metadata={
        full_name:form.fullName.trim(),
        campus_phone:safeText(form.phone,24),
        campus_bio:safeText(form.bio,240),
        campus_branch:safeText(form.branch,60),
        campus_year:form.academicYear?Number(form.academicYear):null,
        campus_section:safeText(form.section,15),
        campus_department:safeText(form.department,65),
      };
      const authUpdate=await supabase.auth.updateUser({data:metadata});
      if(authUpdate.error){
        setFeedback({error:true,text:'Your name and photo were saved, but your personal academic details could not be updated. Try saving again.'});
      }else{
        setFeedback({error:false,text:'Your profile has been saved.'});
      }
      setFile(null);setRemoveAvatar(false);
      if(previousAvatar&&previousAvatar!==avatarPath){
        // Old private objects may be removed safely from the owner's folder.
        await supabase.storage.from(BUCKET).remove([previousAvatar]).catch(()=>{});
      }
    }catch(error){
      setFeedback({error:true,text:error?.message||'Changes could not be saved.'});
    }finally{setBusy(false);}
  };

  const requestPasswordReset=async()=>{
    if(demo){setFeedback({error:false,text:'Password management is disabled in preview mode.'});return;}
    if(!supabase||!user?.email)return;
    setPasswordBusy(true);setFeedback(null);
    try{
      const url=new URL(window.location.href);
      url.search='?auth=reset';url.hash='';
      const {error}=await supabase.auth.resetPasswordForEmail(user.email,{redirectTo:url.toString()});
      if(error)throw error;
      setFeedback({error:false,text:'Password reset instructions have been sent to your email, if supported for this account.'});
    }catch(err){setFeedback({error:true,text:err.message||'Could not send the reset email.'});}
    finally{setPasswordBusy(false);}
  };

  return <div className="igp-page">
    <div className="igp-intro">
      <span className="igp-eyebrow">ACCOUNT SETTINGS</span>
      <h1>My profile</h1>
      <p>Manage how your name and photo appear in IET Grid, and review your academic information.</p>
    </div>
    {demo&&<div className="igp-demo"><Info size={16}/> Preview mode — changes here do not modify real accounts or university records.</div>}
    {feedback&&<div className={'igp-feedback'+(feedback.error?' is-error':' is-success')}
      role={feedback.error?'alert':'status'}>
      {feedback.error?<Info size={16}/>:<Check size={16}/>}
      <span>{feedback.text}</span>
    </div>}

    <div className="igp-layout">
      <div className="igp-main-column">
        <form onSubmit={save} className="igp-form">
          <section className="igp-card">
            <div className="igp-card-header"><div><h2>Profile photo</h2><p>Choose a clear photo that helps your classmates and faculty recognize you.</p></div></div>
            <div className="igp-avatar-edit">
              <div className="igp-avatar-frame">{imageFor(imageSource,fullName,true)}
                <span className="igp-avatar-camera" aria-hidden="true"><Camera size={15}/></span>
              </div>
              <div className="igp-avatar-actions">
                <strong>{fullName}</strong>
                <span>JPG, PNG or WebP · 2 MB maximum</span>
                <div className="igp-avatar-buttons">
                  <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp"
                    className="igp-hidden-input" onChange={choosePhoto}
                    aria-label="Choose a new profile photo"/>
                  <button type="button" className="igp-outline-button" onClick={()=>fileInput.current?.click()}>
                    <ImagePlus size={16}/> {imageSource?'Change photo':'Upload photo'}
                  </button>
                  {(imageSource||file)&&<button type="button" className="igp-text-button"
                    onClick={clearPhoto}><Trash2 size={15}/> Remove</button>}
                </div>
                {(file||removeAvatar)&&<small className="igp-pending">
                  {removeAvatar?'Photo will be removed when you save.':'New photo selected — save to upload.'}</small>}
              </div>
            </div>
          </section>

          <section className="igp-card">
            <div className="igp-card-header"><div><h2>Personal information</h2>
              <p>Your name is visible in your own workspace and relevant scheduling records.</p></div></div>
            <div className="igp-form-grid">
              <label className="igp-field"><span>Full name <b>*</b></span>
                <input required maxLength={90} minLength={2} autoComplete="name"
                  value={form.fullName} onChange={e=>change('fullName',e.target.value)}
                  placeholder="Your full name"/></label>
              <label className="igp-field"><span>Email address</span>
                <div className="igp-input-lock"><input type="email" value={user?.email|| (demo?'demo@iet-grid.local':'')}
                  readOnly aria-describedby="igp-email-readonly"/><Lock size={16}/></div>
                <small id="igp-email-readonly">Managed through your sign-in account.</small></label>
              <label className="igp-field"><span>Contact number <small>(optional)</small></span>
                <input autoComplete="tel" inputMode="tel" maxLength={24}
                  value={form.phone} onChange={e=>change('phone',e.target.value)}
                  placeholder="+91 98765 43210"/></label>
              <label className="igp-field igp-span-2"><span>Short introduction <small>(optional)</small></span>
                <textarea rows={3} maxLength={240} value={form.bio}
                  onChange={e=>change('bio',e.target.value)}
                  placeholder="A sentence about your academic interests or what you teach."/>
                <small>{form.bio.length}/240 characters</small></label>
            </div>
          </section>

          <section className="igp-card">
            <div className="igp-card-header"><div><h2>{isStudent?'Academic details':'Department information'}</h2>
              <p>{isStudent?'Provide your preferred class details for convenience when browsing campus information.':
                'Share your department details for your personal profile.'}</p></div></div>
            {isStudent?<div className="igp-form-grid igp-academic-grid">
              <label className="igp-field"><span>Branch / programme</span>
                <input maxLength={60} value={form.branch} onChange={e=>change('branch',e.target.value)}
                  placeholder="e.g. CSE, AI/ML, AI/DS"/></label>
              <label className="igp-field"><span>Academic year</span>
                <select value={form.academicYear} onChange={e=>change('academicYear',e.target.value)}>
                  <option value="">Select year</option>
                  {[1,2,3,4,5,6].map(v=><option key={v} value={v}>Year {v}</option>)}
                </select></label>
              <label className="igp-field"><span>Section</span>
                <input maxLength={15} value={form.section}
                  onChange={e=>change('section',e.target.value)} placeholder="e.g. A"/></label>
            </div>:<div className="igp-form-grid">
              <label className="igp-field"><span>Department / teaching area</span>
                <input maxLength={65} value={form.department}
                  onChange={e=>change('department',e.target.value)}
                  placeholder="e.g. Computer Science & Engineering"/></label>
            </div>}
            <div className="igp-institution-note"><Info size={17}/>
              <span>These are self-reported details. They do not change your official class membership,
                verified role, timetable permissions, or eligibility to reserve rooms.</span></div>
          </section>

          <div className="igp-save-row">
            <span><ShieldCheck size={15}/> Only your profile information is editable here.</span>
            <button type="submit" className="igp-save-button" disabled={busy}>
              <Save size={16}/>{busy?'Saving changes…':'Save changes'}
            </button>
          </div>
        </form>
      </div>
      <aside className="igp-side-column">
        <section className="igp-card igp-account-summary">
          <div className="igp-summary-head">
            {imageFor(imageSource,fullName)}
            <div><strong>{fullName}</strong><small>{titleRole(role)}</small></div>
          </div>
          <div className="igp-account-row"><span><UserRound size={15}/> Account role</span>
            <b>{titleRole(role)}</b></div>
          <div className="igp-account-row"><span><ShieldCheck size={15}/> Verification</span>
            <b className={isVerified?'igp-status-verified':'igp-status-unverified'}>
              {demo?'Demo only':isVerified?'Verified':'Not verified'}</b></div>
          <div className="igp-account-row"><span><Mail size={15}/> Email</span>
            <b className="igp-break">{user?.email||(demo?'Preview account':'—')}</b></div>
          <p className="igp-official-note">Roles and verification are managed by authorized campus staff.</p>
        </section>
        <section className="igp-card igp-official-card">
          <div className="igp-card-header"><div><h2><GraduationCap size={18}/> Institutional record</h2>
            <p>University-managed details</p></div></div>
          <div className="igp-official-body">
            <div className="igp-account-row"><span><Users size={15}/> Registered class</span></div>
            <strong>{institutionalLine}</strong>
            <small>Changes to your official batch or section require verification by a campus administrator.</small>
          </div>
        </section>
        <section className="igp-card igp-account-security">
          <div className="igp-card-header"><div><h2>Account security</h2>
            <p>Keep access to your campus account secure.</p></div></div>
          <button type="button" className="igp-outline-button" onClick={requestPasswordReset}
            disabled={passwordBusy}><Lock size={15}/>{passwordBusy?'Sending…':'Reset password by email'}</button>
        </section>
      </aside>
    </div>
  </div>;
}
