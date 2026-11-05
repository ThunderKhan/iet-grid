import React, {useState, useEffect} from 'react';
import {GrainGradient} from '@paper-design/shaders-react';
import {ArrowRight, ArrowUpRight, Building2, CalendarDays, CheckCircle2, Eye, EyeOff, Layers3, LockKeyhole, MapPinned, ShieldAlert} from 'lucide-react';
import {configured, supabase} from '../supabase';
import './AuthScreen.css';

const googleEnabled = import.meta.env.VITE_AUTH_GOOGLE_ENABLED === 'true';
const appleEnabled = import.meta.env.VITE_AUTH_APPLE_ENABLED === 'true';
const redirectBase = () => (import.meta.env.VITE_SITE_URL?.trim() || window.location.origin).replace(/\/+$/, '') + '/';

function GoogleIcon() {
  return <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"/>
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84Z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/>
  </svg>;
}
function AppleIcon() {
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true">
    <path d="M17.05 12.54c-.03-3.02 2.47-4.47 2.58-4.54-1.41-2.06-3.6-2.34-4.38-2.37-1.86-.19-3.64 1.1-4.58 1.1-.95 0-2.42-1.07-3.98-1.04-2.05.03-3.94 1.19-4.99 3.02-2.13 3.69-.54 9.16 1.53 12.15 1.01 1.46 2.22 3.1 3.81 3.04 1.53-.06 2.11-.99 3.96-.99s2.37.99 3.99.96c1.65-.03 2.69-1.49 3.69-2.96 1.16-1.69 1.64-3.33 1.66-3.41-.04-.02-3.2-1.23-3.24-4.87ZM14.03 3.66c.84-1.02 1.41-2.43 1.25-3.84-1.21.05-2.68.81-3.55 1.83-.78.9-1.46 2.34-1.28 3.72 1.35.1 2.73-.69 3.58-1.71Z"/>
  </svg>;
}
function Field({id,label,type='text',value,onChange,placeholder,autoComplete,minLength,maxLength,right}) {
  return <label className="ig-auth-field" htmlFor={id}><span>{label}</span>
    <span className="ig-auth-input-wrap">
      <input id={id} name={id} type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete} required minLength={minLength} maxLength={maxLength}/>
      {right}
    </span>
  </label>;
}
export default function AuthScreen({onGuest, recovery=false, onRecoveryComplete, onRecoveryCancel}) {
  const [mode,setMode] = useState(recovery ? 'reset' : 'signin');
  const [first,setFirst] = useState('');
  const [last,setLast] = useState('');
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [showPassword,setShowPassword] = useState(false);
  const [busy,setBusy] = useState('');
  const [feedback,setFeedback] = useState(null);
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => { if(recovery) setMode('reset'); }, [recovery]);

  const signup = mode === 'signup', signin = mode === 'signin', forgot = mode === 'forgot', reset = mode === 'reset';
  const title = signup ? 'Create an account' : signin ? 'Welcome back' : forgot ? 'Reset your password' : 'Set a new password';
  const subtitle = signup ? 'Join your campus workspace.' : signin ? 'Sign in to your IET Grid workspace.' :
    forgot ? 'We will email you a secure password reset link.' : 'Enter a new password for your IET Grid account.';

  function switchMode(next) {
    setMode(next); setPassword(''); setFeedback(null); setShowPassword(false);
    if(recovery && next !== 'reset') onRecoveryCancel?.();
  }

  async function submit(e) {
    e.preventDefault();
    if(!configured || busy) return;
    setFeedback(null);
    if(signup && (!first.trim() || !last.trim())) {
      setFeedback({kind:'error',message:'Please enter your first and last name.'}); return;
    }
    setBusy('submit');
    try {
      if(signin) {
        const {error} = await supabase.auth.signInWithPassword({email:email.trim(),password});
        if(error) throw error;
      } else if(signup) {
        const {data,error} = await supabase.auth.signUp({
          email:email.trim(),password,
          options:{emailRedirectTo:redirectBase(),data:{first_name:first.trim(),last_name:last.trim(),full_name:first.trim()+' '+last.trim()}}
        });
        if(error) throw error;
        if(!data.session) setFeedback({kind:'success',message:'Check your inbox for a confirmation link, then sign in. Faculty and administrator access requires separate verification.'});
      } else if(forgot) {
        const {error} = await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:redirectBase()+'?auth=reset'});
        if(error) throw error;
        setFeedback({kind:'success',message:'If this email has an account, a password reset link will arrive shortly.'});
      } else if(reset) {
        const {data:{session}} = await supabase.auth.getSession();
        if(!session) throw new Error('Open the secure password reset link from your inbox before updating your password.');
        const {error} = await supabase.auth.updateUser({password});
        if(error) throw error;
        setPassword(''); onRecoveryComplete?.();
      }
    } catch(error) {
      setFeedback({kind:'error',message:error?.message || 'Something went wrong. Please try again.'});
    } finally {setBusy('');}
  }

  async function signInWith(provider) {
    if(!configured || busy || (provider === 'google' && !googleEnabled) || (provider === 'apple' && !appleEnabled)) return;
    setBusy(provider); setFeedback(null);
    try {
      const {error} = await supabase.auth.signInWithOAuth({provider,options:{redirectTo:redirectBase()}});
      if(error) throw error;
    } catch(error) {
      setFeedback({kind:'error',message:error?.message || 'Could not start social sign in.'});
    } finally {setBusy('');}
  }

  return <main className="ig-auth-page">
    <div className="ig-auth-layout">
      <section className="ig-auth-form-panel" aria-labelledby="ig-auth-title">
        <div className="ig-auth-form-content">
          <div className="ig-auth-brand"><div className="ig-auth-brand-mark"><Layers3 size={22}/></div>
            <div><strong>IET Grid</strong><span>DDUGU · Campus operations</span></div>
          </div>
          <div className="ig-auth-heading">
            <span className="ig-auth-eyebrow">INSTITUTE OF ENGINEERING & TECHNOLOGY</span>
            <h1 id="ig-auth-title">{title}</h1><p>{subtitle}</p>
          </div>
          {(googleEnabled || appleEnabled) && (signin || signup) && <>
            <div className="ig-auth-socials">
              {googleEnabled && <button type="button" className="ig-auth-social" onClick={() => signInWith('google')} disabled={!!busy || !configured}>
                <GoogleIcon/> <span>Continue with Google</span></button>}
              {appleEnabled && <button type="button" className="ig-auth-social" onClick={() => signInWith('apple')} disabled={!!busy || !configured}>
                <AppleIcon/> <span>Continue with Apple</span></button>}
            </div>
            <div className="ig-auth-divider"><span>or with email</span></div>
          </>}
          <form className="ig-auth-form" onSubmit={submit}>
            {signup && <div className="ig-auth-name-grid">
              <Field id="ig-first" label="First name" value={first} onChange={setFirst} placeholder="Your first name" autoComplete="given-name" maxLength={80}/>
              <Field id="ig-last" label="Last name" value={last} onChange={setLast} placeholder="Your last name" autoComplete="family-name" maxLength={80}/>
            </div>}
            {!reset && <Field id="ig-email" label="Email address" type="email" value={email} onChange={setEmail}
              placeholder="you@example.com" autoComplete="email"/>}
            {!forgot && <Field id="ig-password" label={reset?'New password':'Password'} type={showPassword?'text':'password'} value={password}
              onChange={setPassword} placeholder={signin?'Enter your password':'At least 8 characters'}
              autoComplete={signin?'current-password':'new-password'} minLength={signin?undefined:8}
              right={<button type="button" className="ig-auth-show-password" onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button>}/>}
            {signin && <div className="ig-auth-forgot"><button type="button" onClick={() => switchMode('forgot')}>Forgot password?</button></div>}
            {!configured && <div className="ig-auth-feedback warning" role="status">
              <ShieldAlert size={17}/> Live authentication is not configured here. Explore the demo instead.
            </div>}
            {feedback && <div role={feedback.kind === 'error'?'alert':'status'} className={'ig-auth-feedback '+feedback.kind}>
              {feedback.kind === 'success'?<CheckCircle2 size={17}/>:<ShieldAlert size={17}/>}
              <span>{feedback.message}</span></div>}
            <button type="submit" className="ig-auth-submit" disabled={!!busy || !configured}>
              <span>{busy === 'submit'?'Please wait…':signup?'Create account':signin?'Sign in':forgot?'Send reset link':'Update password'}</span><ArrowRight size={18}/>
            </button>
          </form>
          <p className="ig-auth-switch">
            {signin?<>New to IET Grid? <button type="button" onClick={() => switchMode('signup')}>Create an account</button></>:
              signup?<>Already registered? <button type="button" onClick={() => switchMode('signin')}>Sign in</button></>:
              <button type="button" onClick={() => switchMode('signin')}>Back to sign in</button>}
          </p>
          <div className="ig-auth-policy"><LockKeyhole size={15}/> Institutional roles must be verified. Registration does not grant faculty or admin privileges.</div>
        </div>
      </section>
      <aside className="ig-auth-art-panel" aria-label="IET Grid campus introduction">
        <div className="ig-auth-art-fallback"/>
        <GrainGradient className="ig-auth-shader" speed={reducedMotion?0:0.16} scale={1} rotation={0} offsetX={0} offsetY={0}
          softness={0.62} intensity={0.48} noise={0.22} shape="corners"
          colors={['#315CE5','#10213B','#6C8FF7','#CFDDFC']} colorBack="#07162C"/>
        <div className="ig-auth-art-veil"/>
        <div className="ig-auth-art-content">
          <div className="ig-auth-art-top"><span className="ig-auth-art-badge"><Building2 size={16}/> CAMPUS OPERATIONS</span>
            <span className="ig-auth-art-location">IET · DEEKSHA BHAWAN</span></div>
          <div className="ig-auth-art-center">
            <div className="ig-auth-mini-map" aria-hidden="true">
              <div className="ig-auth-mini-caption"><MapPinned size={14}/> IET · FIRST FLOOR</div>
              <div className="ig-auth-mini-rooms">
                <span>IET22</span><span>IET16</span>
                <i>CORRIDOR</i>
                <span className="is-free">IET19 <small>FREE</small></span><span>IET18</span>
              </div>
              <div className="ig-auth-mini-bottom"><CalendarDays size={14}/> ONE CONNECTED SCHEDULE</div>
            </div>
            <h2>Every room.<br/>Every schedule.<br/><em>One intelligent grid.</em></h2>
            <p>Discover free spaces, coordinate classes, and stay in sync across campus.</p>
          </div>
          <div className="ig-auth-art-footer">
            <button type="button" className="ig-auth-preview" onClick={onGuest}><span><Layers3 size={19}/> Explore campus demo</span><ArrowUpRight size={18}/></button>
            <p>Demo mode uses sample data. Reservations are not saved to university records.</p>
          </div>
        </div>
      </aside>
    </div>
  </main>;
}
