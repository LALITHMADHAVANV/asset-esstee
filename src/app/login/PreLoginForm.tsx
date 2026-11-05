"use client";

import { useState } from 'react';
import { Wrench, User, Lock, Eye, EyeOff, ArrowRight, Loader2, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function PreLoginForm() {
  const { loginWithEmail } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const user = await loginWithEmail(identifier, password);
      const next = new URLSearchParams(window.location.search).get('next');
      const prefix = `/${encodeURIComponent(user.companySlug!)}/`;
      const safeNext = next?.startsWith(prefix) && !next.includes('\\') && !/[\r\n]/.test(next);
      window.location.assign(safeNext && next ? next : `${prefix}dashboard`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in. Please try again.');
      setPending(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story" aria-label="Plant maintenance">
        <div className="login-brand"><span className="brand-mark"><Wrench size={22} /></span>maintain.</div>
        <div className="login-story-content">
          <span className="login-eyebrow"><span /> YOUR PLANT. CONNECTED.</span>
          <h1>One sign-in.<br /><span>Your workspace.</span></h1>
          <p>Keep your equipment, your team, and your maintenance moving. Sign in and we?ll take you to your company.</p>
          <div className="plant-illustration" aria-hidden="true"><div className="plant-line" />{[0,1,2].map(i=><div className="plant-machine" key={i}><div className="machine-top"><Wrench size={24}/><span/></div><div className="machine-body"><i/><i/><i/></div><div className="machine-feet"/></div>)}</div>
          <div className="login-features"><div><span>01</span><strong>Sign in</strong><p>Use your own work account.</p></div><div><span>02</span><strong>Your company</strong><p>We find your assigned workspace.</p></div><div><span>03</span><strong>Get to work</strong><p>Your equipment and tasks, ready.</p></div></div>
        </div>
        <div className="login-story-footer">BUILT FOR THE FACTORY FLOOR</div>
      </section>
      <section className="login-form-side"><div className="login-form-content">
        <div className="login-form-icon"><Lock size={22}/></div>
        <span className="login-section-label">LET?S GET TO WORK</span><h2>Welcome back</h2>
        <p className="login-description">Enter your account details to open your company workspace.</p>
        <form className="login-form" onSubmit={signIn}>
          <div><label htmlFor="login-identifier">Work email or username</label><div className="login-input-wrap"><User size={18}/><input id="login-identifier" value={identifier} onChange={e=>setIdentifier(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Your work email or assigned username" disabled={pending} required/></div></div>
          <div><label htmlFor="login-password">Password</label><div className="login-input-wrap"><Lock size={18}/><input id="login-password" type={visible?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter your password" disabled={pending} required/><button type="button" aria-label={visible?'Hide password':'Show password'} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <button type="submit" className="login-submit" disabled={pending}>{pending?<><Loader2 size={18} className="animate-spin"/>Opening your workspace?</>:<>Sign in <ArrowRight size={18}/></>}</button>
        </form>
        <p className="login-help">Need an account? Contact your company administrator.</p>
        <div className="login-security"><Shield size={18}/><p><strong>Access belongs to your account.</strong><br/>Your company and permissions are identified after sign-in.</p></div>
      </div><footer className="login-footer"><span>Maintenance Module</span><span>One portal. Your company.</span></footer></section>
    </main>
  );
}
