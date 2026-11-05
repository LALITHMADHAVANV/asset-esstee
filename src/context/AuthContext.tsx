'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { UserProfile, UserRole } from '@/types/cmms';

export const ROLE_PASSWORDS: Record<UserRole, string> = {
  CEO: 'ceo123',
  ADMIN: 'admin123',
  ASSET_MANAGER: 'admin123',
  SENIOR_MECHANIC: 'senior123',
  MECHANIC: 'mechanic123',
  SENIOR_ELECTRICIAN: 'senior123',
  ELECTRICIAN: 'electrician123',
  STORE_PERSON: 'stores123',
};

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole | null;
  companySlug: string;
  companyName: string;
  isLoading: boolean;
  loginAsRole: (role: UserRole) => Promise<void>;
  loginAsUser: (profile: UserProfile) => Promise<void>;
  loginWithEmail: (email: string, pass: string, companySlug?: string) => Promise<UserProfile>;
  updateUserPassword: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function resolveUserTitle(role: UserRole, companyName: string = 'Company'): string {
  switch (role) {
    case 'CEO':
      return 'Chief Executive Officer (Managing Director)';
    case 'ADMIN':
    case 'ASSET_MANAGER':
      return 'Plant Administrator & Asset Director';
    case 'SENIOR_MECHANIC':
      return 'Senior Sewing Master Mechanic';
    case 'SENIOR_ELECTRICIAN':
      return 'Senior Plant Electrician & Automation Lead';
    case 'ELECTRICIAN':
      return 'Industrial Plant Electrician';
    case 'STORE_PERSON':
      return 'Tool Crib & Store In-Charge';
    case 'MECHANIC':
      return 'Line Sewing Mechanic';
    default:
      return `${companyName} Specialist`;
  }
}

const AUTH_STORAGE_KEY = 'cmms_current_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const authRevision = useRef(0);

  // Only the server can restore an authenticated session.
  useEffect(() => {
    let isMounted = true;

    const revision = authRevision.current;
    const isCurrent = () => isMounted && revision === authRevision.current;
    async function initAuth() {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
        const data = response.ok ? await response.json() : null;
        if (!isCurrent()) return;
        if (data?.authenticated && data?.user?.companySlug) {
          setUser(data.user);
          try {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
            localStorage.setItem('cmms_active_company', data.user.companySlug);
            localStorage.setItem('cmms_active_tenant', data.user.companySlug);
          } catch { /* Storage may be disabled; the session cookie is authoritative. */ }
        } else {
          setUser(null);
          try {
            localStorage.removeItem(AUTH_STORAGE_KEY);
          } catch { /* Storage may be disabled. */ }
        }
      } catch {
        if (isCurrent()) setUser(null);
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    }

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const loginWithEmail = async (
    rawEmail: string,
    rawPass: string,
    targetCompanySlug?: string
  ): Promise<UserProfile> => {
    authRevision.current += 1;
    setIsLoading(true);
    const email = (rawEmail || '').trim();
    const pass = rawPass || '';

    if (!email) {
      setIsLoading(false);
      throw new Error('Please enter your email or employee ID');
    }
    if (!pass) {
      setIsLoading(false);
      throw new Error('Please enter your password');
    }

    // Use only an explicit selection or a company-scoped login URL.
    const pathMatch = typeof window !== 'undefined'
      ? window.location.pathname.match(/^\/([a-z0-9_-]+)\/login\/?$/i)
      : null;
    const effectiveSlug = (targetCompanySlug || pathMatch?.[1] || '').trim().toLowerCase();
    if (effectiveSlug && !/^[a-z0-9_-]+$/.test(effectiveSlug)) {
      setIsLoading(false);
      throw new Error('Please select your company workspace before signing in.');
    }

    try {
      const payload = JSON.stringify({
        email,
        password: pass,
        companySlug: effectiveSlug,
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(effectiveSlug ? { 'x-company-slug': effectiveSlug } : {}),
      };

      // Call /api/auth/login directly (with /maintenance fallback)
      let res: Response | null = null;
      try {
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers,
          body: payload,
          credentials: 'include',
        });
      } catch {
        res = await fetch('/maintenance/api/auth/login', {
          method: 'POST',
          headers,
          body: payload,
          credentials: 'include',
        });
      }

      if (!res) {
        throw new Error('Connection failed. Please check your internet connection.');
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success || !data.user) {
        throw new Error(data.error || 'Invalid credentials. Please try again.');
      }

      if (!data.user.companySlug || (effectiveSlug && data.user.companySlug !== effectiveSlug)) {
        throw new Error('The returned workspace does not match your selection. Please sign in again.');
      }
      setUser(data.user);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
          localStorage.setItem('cmms_active_company', data.user.companySlug || effectiveSlug);
          localStorage.setItem('cmms_active_tenant', data.user.companySlug || effectiveSlug);
        } catch { /* Continue with the authenticated session cookie. */ }
        window.dispatchEvent(new Event('cmms_tenant_changed'));
      }
      return data.user;
    } catch (err: unknown) {
      setIsLoading(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsUser = async (profile: UserProfile): Promise<void> => {
    setUser(profile);
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
      const slug = profile.companySlug || 'esstee';
      localStorage.setItem('cmms_active_company', slug);
      localStorage.setItem('cmms_active_tenant', slug);
      window.dispatchEvent(new Event('cmms_tenant_changed'));
    }
    setIsLoading(false);
  };

  const loginAsRole = async (targetRole: UserRole): Promise<void> => {
    const slug = user?.companySlug || 'esstee';
    const cName = user?.company || (slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : 'Esstee');
    const roleTitle = resolveUserTitle(targetRole, cName);
    const roleProfile: UserProfile = {
      uid: `${targetRole.slice(0, 3)}-01`,
      name: `${targetRole.replace('_', ' ')} Staff`,
      email: `${targetRole.toLowerCase()}@${slug}.com`,
      role: targetRole,
      title: roleTitle,
      company: cName,
      companySlug: slug,
      status: 'ACTIVE',
    };
    setUser(roleProfile);
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(roleProfile));
      localStorage.setItem('cmms_active_company', slug);
    }
    setIsLoading(false);
  };

  const updateUserPassword = async (newPassword: string): Promise<void> => {
    if (!user) {
      throw new Error('No user is currently authenticated.');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    const payload = JSON.stringify({
      email: user.email,
      password: newPassword,
      name: user.name,
      role: user.role,
    });
    const headers = {
      'Content-Type': 'application/json',
      'x-company-slug': user.companySlug || 'esstee',
    };

    let res = await fetch('/api/auth/set-password', {
      method: 'POST',
      headers,
      body: payload,
      credentials: 'include',
    }).catch(() => null);

    if (!res || !res.ok) {
      res = await fetch('/maintenance/api/auth/set-password', {
        method: 'POST',
        headers,
        body: payload,
        credentials: 'include',
      }).catch(() => null);
    }

    if (!res) {
      throw new Error('Failed to update password. Please check your connection.');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update password');
    }
  };

  const logout = async (): Promise<void> => {
    authRevision.current += 1;
    setUser(null);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch { }

    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem('cmms_active_company');
      localStorage.removeItem('cmms_active_tenant');
      window.dispatchEvent(new Event('cmms_tenant_changed'));
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ? (user.role.toString().toUpperCase() as UserRole) : null,
        companySlug: user?.companySlug || 'esstee',
        companyName: user?.company || (user?.companySlug ? user.companySlug.charAt(0).toUpperCase() + user.companySlug.slice(1) : 'Esstee'),
        isLoading,
        loginAsRole,
        loginAsUser,
        loginWithEmail,
        updateUserPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
