'use client';

import React, { useState } from 'react';
import {
  Wrench,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  User,
  Loader2,
  Shield,
  Building2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

interface CompanyLoginFormProps {
  companySlug: string;
  companyName: string;
  description?: string;
}

export function CompanyLoginForm({ companySlug, companyName, description }: CompanyLoginFormProps) {
  const { loginWithEmail } = useAuth();
  const { showToast } = useToast();

  const [emailOrId, setEmailOrId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const defaultAdminUser = `admin@${companySlug || 'esstee'}.com`;

  const handleFormLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = (emailOrId || '').trim();
    const cleanPass = password || '';

    if (!cleanInput) {
      showToast('Please enter your Employee ID or Email', 'warning');
      return;
    }
    if (!cleanPass) {
      showToast('Please enter your password', 'warning');
      return;
    }
    setIsLoading(true);

    try {
      await loginWithEmail(cleanInput, cleanPass, companySlug);
      showToast(`Welcome back to ${companyName} Plant Maintenance!`, 'success');
      window.location.assign(`/${companySlug}/dashboard`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAdminLogin = async () => {
    setEmailOrId(defaultAdminUser);
    setPassword('admin123');
    setIsLoading(true);
    try {
      await loginWithEmail(defaultAdminUser, 'admin123', companySlug);
      showToast(`Signed in as ${companyName} Administrator`, 'success');
      window.location.assign(`/${companySlug}/dashboard`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-story" aria-label="Maintenance workspace introduction">
        <a href="/" className="login-brand"><span className="brand-mark"><Wrench size={22} /></span>Mainten<span className="text-teal-300">ance.</span></a>
        <div className="login-story-content">
          <span className="login-eyebrow"><span /> YOUR PLANT. CONNECTED.</span>
          <h1>Less downtime.<br />More <span>momentum.</span></h1>
          <p>A clearer view of your equipment, your team, and everything that keeps production moving.</p>
          <div className="plant-illustration" aria-hidden="true">
            <div className="plant-line" />
            {[0, 1, 2].map((item) => <div className="plant-machine" key={item}><div className="machine-top"><Wrench size={24} /><span /></div><div className="machine-body"><i /><i /><i /></div><div className="machine-feet" /></div>)}
          </div>
          <div className="login-features">
            <div><span>01</span><strong>Track every asset</strong><p>Equipment history in one place.</p></div>
            <div><span>02</span><strong>Stay ahead of repairs</strong><p>Plan maintenance with confidence.</p></div>
            <div><span>03</span><strong>Keep teams in sync</strong><p>Clear ownership. Faster action.</p></div>
          </div>
        </div>
        <div className="login-story-footer"><span>BUILT FOR THE FACTORY FLOOR</span><span>Asset & maintenance management</span></div>
      </section>
      <section className="login-form-side">
        <div className="login-workspace">
          <Building2 size={15} />
          <span>{companyName} workspace</span>
          <a href="/login" className="text-teal-700 hover:text-teal-900 font-medium underline ml-2 text-[10px]">Switch</a>
        </div>
        <div className="login-form-content">
          <div className="login-form-icon"><Lock size={22} /></div>
          <span className="login-section-label">LET?S GET TO WORK</span>
          <h2>Welcome back</h2>
          <p className="login-description">Sign in to manage your plant?s maintenance.</p>
          <form onSubmit={handleFormLogin} className="login-form">
            <div><label htmlFor="employee-id">Employee ID or email</label><div className="login-input-wrap"><User size={18} /><input id="employee-id" type="text" value={emailOrId} onChange={(e) => setEmailOrId(e.target.value)} placeholder="Enter your ID or email" autoComplete="username" disabled={isLoading} required /></div></div>
            <div><label htmlFor="password">Password</label><div className="login-input-wrap"><Lock size={18} /><input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" disabled={isLoading} required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
            <button className="login-submit" type="submit" disabled={isLoading}>{isLoading ? <><Loader2 size={18} className="animate-spin" /> Signing in?</> : <>Sign in to workspace <ArrowRight size={18} /></>}</button>
            <div className="login-divider"><span />Administrator access<span /></div>
            <button className="login-admin" type="button" onClick={handleQuickAdminLogin} disabled={isLoading}><Shield size={17} /> Quick administrator sign in</button>
          </form>
          <p className="login-help">Need access? Contact your workspace administrator.</p>
          <div className="login-security"><Shield size={17} /><p><strong>Your workspace, protected.</strong><br />Secure access to {companyName} equipment and operations.</p></div>
        </div>
        <footer className="login-footer"><span>Maintenance Module</span><span>{description || 'Industrial asset management'}</span></footer>
      </section>
    </main>
  );
}
