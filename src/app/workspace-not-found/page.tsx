'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Building2, AlertTriangle, ArrowRight, ShieldAlert, ArrowLeft } from 'lucide-react';

function WorkspaceNotFoundContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug') || searchParams.get('company') || '';

  return (
    <div className="workspace-unavailable min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(239,68,68,0.15),rgba(15,23,42,1))]">
      <div className="w-full max-w-lg bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-8 sm:p-10 shadow-2xl text-center space-y-6">

        {/* Warning Icon Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
          <ShieldAlert className="w-9 h-9" />
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Workspace Not Found
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
            {slug ? (
              <>
                The organization workspace <span className="font-mono text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">/{slug}</span> does not exist or has been deactivated in the central registry.
              </>
            ) : (
              'The requested organization workspace does not exist or has been deactivated.'
            )}
          </p>
        </div>

        {/* Diagnostic Card */}
        <div className="p-4 bg-slate-900/70 border border-slate-700/60 rounded-2xl text-left space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Workspace Notice</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Please sign in with your work email or assigned username to be directed to your company workspace.
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition duration-150 shadow-lg shadow-blue-500/20"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Sign In</span>
          </Link>
        </div>

        {/* Footer */}
        <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-700/60">
          Maintenance Module &bull; Central Registry Guard
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceNotFoundPage() {
  return (
    <Suspense fallback={<div className="workspace-unavailable min-h-screen bg-slate-900" />}>
      <WorkspaceNotFoundContent />
    </Suspense>
  );
}
