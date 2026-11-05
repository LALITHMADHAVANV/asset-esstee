'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UserManagementRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/settings?tab=USERS');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-3">
      <div className="w-8 h-8 border-4 border-[#059669] border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-500 font-medium">
        Redirecting to Settings &gt; Users...
      </p>
    </div>
  );
}
