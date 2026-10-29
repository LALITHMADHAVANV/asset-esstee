'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { canAccessRoute, normalizeRole } from '@/lib/constants/roles';

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, isLoading } = useAuth();
  const { showToast } = useToast();

  const userRole = normalizeRole(user?.role || role);
  const isAuthorized = canAccessRoute(userRole, pathname);

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      const scopedSlug = pathname.match(/^\/([a-z0-9_-]+)\/dashboard(?:\/|$)/i)?.[1];
      router.replace(scopedSlug ? `/${scopedSlug}/login` : '/login');
      return;
    }

    const userSlug = (user.companySlug || 'esstee').toLowerCase();
    const browserPath = typeof window !== 'undefined' ? window.location.pathname : pathname;
    const browserSegments = browserPath.split('/').filter(Boolean);

    // 1. If actual browser URL is bare `/dashboard` or `/dashboard/...`, redirect to company-scoped route
    if (browserSegments.length > 0 && browserSegments[0] === 'dashboard') {
      router.replace(`/${userSlug}${browserPath}${window.location.search}${window.location.hash}`);
      return;
    }

    // 2. If actual browser URL is scoped to another company, block and redirect
    if (browserSegments.length > 1 && browserSegments[1] === 'dashboard' && browserSegments[0] !== userSlug) {
      showToast(`Cross-company access restricted. Redirected to your ${user.company || userSlug} workspace.`, 'warning');
      router.replace(`/${userSlug}/dashboard`);
      return;
    }

    // 3. Permission check
    if (!isAuthorized) {
      showToast('Access restricted: Your account credentials do not have permissions for this page.', 'warning');
      router.replace(`/${userSlug}/dashboard`);
    }
  }, [user, userRole, isLoading, pathname, router, showToast, isAuthorized]);

  // Prevent flash of content during loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Prevent flash of protected content when unauthenticated / signing out
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Redirecting to sign-in...</p>
        </div>
      </div>
    );
  }

  const browserUrl = typeof window !== 'undefined' ? window.location.pathname : pathname;
  const requestedSlug = browserUrl.match(/^\/([a-z0-9_-]+)\/dashboard(?:\/|$)/i)?.[1];
  if (requestedSlug && requestedSlug !== user.companySlug) {
    return <p className="p-6 text-sm text-slate-500">Opening your company workspace...</p>;
  }

  // Prevent flash of forbidden pages for unauthorized roles
  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Access restricted. Redirecting to your desk...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
