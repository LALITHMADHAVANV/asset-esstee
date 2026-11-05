'use client';

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export function LiveClock() {
  const [timeStr, setTimeStr] = useState<string>('--:--:--');
  const [dateStr, setDateStr] = useState<string>('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setDateStr(
        now.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
        })
      );
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden lg:flex items-center space-x-2 text-xs text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
      <Clock className="w-3.5 h-3.5 text-indigo-600" />
      <span className="font-mono font-semibold text-slate-800">
        {dateStr ? `${dateStr} • ` : ''}
        {timeStr}
      </span>
    </div>
  );
}
