'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import type { Machine } from '@/types/cmms';

interface RelocationDeliveryChallanProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Machine;
  destination: string;
  movedBy?: string;
  reason?: string;
  station?: string;
}

export function RelocationDeliveryChallan({
  isOpen,
  onClose,
  asset,
  destination,
}: RelocationDeliveryChallanProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!isOpen) return null;

  const today = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());

  const companyName =
    asset.company ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('cmms_company_name') || 'Esstee Exports India Pvt Ltd'
      : 'Esstee Exports India Pvt Ltd');
  const particulars = `Make: ${asset.brand || '-'} | Machine Type: ${asset.typeName || asset.type || '-'} | Asset ID: ${asset.id}`;

  const handlePrint = () => {
    document.body.classList.add('printing-relocation-dc-active');
    window.print();
  };

  useEffect(() => {
    if (!isOpen) return;
    const onAfterPrint = () => document.body.classList.remove('printing-relocation-dc-active');
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('afterprint', onAfterPrint);
      document.body.classList.remove('printing-relocation-dc-active');
    };
  }, [isOpen]);

  const challan = (
    <div className="print-challan-sheet bg-white text-slate-950 border-2 border-slate-950 rounded-sm p-5 sm:p-7 text-[12px]">
      <div className="text-center border-b-2 border-slate-950 pb-3">
        <div className="text-[11px] font-black uppercase tracking-[0.18em]">
          Returnable Delivery Challan
        </div>
        <div className="text-[11px] font-bold">(Material Movement)</div>
        <h2 className="text-lg sm:text-xl font-black uppercase mt-2">{companyName}</h2>
      </div>

      <div className="grid grid-cols-[1fr_150px] border-b-2 border-slate-950 mt-0">
        <div className="border-r-2 border-slate-950 py-2 pr-3">
          <span className="font-bold">D.C. Date:</span>{' '}
          <span className="font-mono font-bold">{today}</span>
        </div>
        <div className="py-2 pl-3">
          <span className="font-bold">DC No:</span>
        </div>
      </div>

      <div className="border-b-2 border-slate-950 py-2">
        <span className="font-bold">Party Name:</span>{' '}
        <span className="font-bold">{destination}</span>
      </div>

      <table className="w-full border-collapse table-fixed">
        <thead>
          <tr className="border-b-2 border-slate-950">
            <th className="w-12 border-r-2 border-slate-950 py-2 text-center">Sl.No.</th>
            <th className="w-28 border-r-2 border-slate-950 py-2 text-center">Order No.</th>
            <th className="py-2 text-left px-3">Particulars</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b-2 border-slate-950 align-top">
            <td className="border-r-2 border-slate-950 h-44 text-center py-3 font-bold">1</td>
            <td className="border-r-2 border-slate-950 h-44 text-center py-3"></td>
            <td className="h-44 py-3 px-3 font-bold leading-relaxed">
              {particulars}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="grid grid-cols-3 text-center pt-8 text-[10px] font-bold">
        <div>Store Incharge</div>
        <div>Authorised Signature</div>
        <div>Party Signature</div>
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 no-print">
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[94vh] overflow-y-auto shadow-2xl border border-slate-200">
          <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">Relocation Delivery Challan</h3>
              <p className="text-[10px] text-slate-500">Generated for {asset.id}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="print-keep px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print DC
              </button>
              <button type="button" onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="p-4 sm:p-6">{challan}</div>
        </div>
      </div>
      {mounted &&
        createPortal(
          <div id="relocation-dc-print-portal" className="hidden print:block">
            {challan}
          </div>,
          document.body
        )}
    </>
  );
}
