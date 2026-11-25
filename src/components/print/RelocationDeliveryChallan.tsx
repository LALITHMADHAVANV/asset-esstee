'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import type { RelocationDcType } from '@/types/cmms';
import { apiFetch } from '@/lib/services/cmmsService';

export interface DeliveryChallanAsset {
  id: string;
  company?: string;
  category?: string;
  type?: string;
  typeName?: string;
  brand?: string;
  model?: string;
  unit?: string;
}

interface RelocationDeliveryChallanProps {
  isOpen: boolean;
  onClose: () => void;
  asset: DeliveryChallanAsset;
  assets?: DeliveryChallanAsset[];
  destination: string;
  requestId?: string;
  dcType?: RelocationDcType;
  initialDcNumber?: string;
  initialDcDate?: string;
  movedBy?: string;
  reason?: string;
  station?: string;
}

export function RelocationDeliveryChallan({
  isOpen,
  onClose,
  asset,
  assets,
  destination,
  requestId: approvedRequestId,
  dcType = 'DELIVERY_CHALLAN',
  initialDcNumber,
  initialDcDate,
  reason,
}: RelocationDeliveryChallanProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [dcNumber, setDcNumber] = useState(initialDcNumber || '');
  const [dcDate, setDcDate] = useState(initialDcDate || '');
  const [generationError, setGenerationError] = useState('');
  const requestId = useRef(approvedRequestId || '');
  const issuancePromise = useRef<Promise<{ dcNumber: string; dcDate: string }> | null>(null);
  const category = asset.category || asset.type?.split('_')[0] || 'MACHINE';
  const challanAssets = useMemo(() => assets?.length ? assets : [asset], [asset, assets]);

  const generateChallanNumber = useCallback(() => {
    if (approvedRequestId) requestId.current = approvedRequestId;
    else if (!requestId.current) requestId.current = crypto.randomUUID();
    if (!issuancePromise.current) {
      issuancePromise.current = apiFetch('/api/relocation-challans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: requestId.current,
          assetId: asset.id,
          assetIds: challanAssets.map((item) => item.id),
          category,
          destination,
          dcType,
        }),
      }).then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.dcNumber || !result.dcDate) {
          throw new Error(result.error || 'Could not generate the DC number.');
        }
        return { dcNumber: result.dcNumber as string, dcDate: result.dcDate as string };
      }).catch((error: unknown) => {
        issuancePromise.current = null;
        throw error;
      });
    }

    issuancePromise.current
      .then((result) => {
        setDcNumber(result.dcNumber);
        setDcDate(result.dcDate);
      })
      .catch((error: unknown) => {
        setGenerationError(error instanceof Error ? error.message : 'Could not generate the DC number.');
      });
  }, [asset.id, category, destination, approvedRequestId, challanAssets, dcType]);

  useEffect(() => {
    if (isOpen && !initialDcNumber) generateChallanNumber();
  }, [isOpen, initialDcNumber, generateChallanNumber]);

  useEffect(() => {
    if (!isOpen) return;
    const onAfterPrint = () => document.body.classList.remove('printing-relocation-dc-active');
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('afterprint', onAfterPrint);
      document.body.classList.remove('printing-relocation-dc-active');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const companyName =
    asset.company ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('cmms_company_name') || 'Esstee Exports India Pvt Ltd'
      : 'Esstee Exports India Pvt Ltd');
  const handlePrint = () => {
    if (!dcNumber) return;
    document.body.classList.add('printing-relocation-dc-active');
    window.print();
  };

  const challan = (
    <div className="print-challan-sheet bg-white text-slate-950 border-2 border-slate-950 rounded-sm p-5 sm:p-7 text-[12px]">
      <div className="text-center border-b-2 border-slate-950 pb-3">
        <div className="text-[11px] font-black uppercase tracking-[0.18em]">
          {dcType === 'RETURNABLE_DELIVERY_CHALLAN' ? 'Returnable Delivery Challan' : 'Delivery Challan'}
        </div>
        <div className="text-[11px] font-bold">(Material Movement)</div>
        <h2 className="text-lg sm:text-xl font-black uppercase mt-2">
          {companyName} <span className="whitespace-nowrap">• {asset.unit || 'Unit 01'}</span>
        </h2>
      </div>

      <div className="grid grid-cols-[1fr_1fr] border-x-2 border-b-2 border-slate-950 mt-0">
        <div className="border-r-2 border-slate-950 py-2 pl-2 pr-3">
          <span className="font-bold">D.C. Date:</span>{' '}
          <span className="font-mono font-bold">{dcDate || '--.--.--'}</span>
        </div>
        <div className="py-2 pl-3">
          <span className="font-bold">DC No:</span>{' '}
          <span className="font-mono font-bold">{dcNumber || 'Generating...'}</span>
        </div>
      </div>

      <div className="border-x-2 border-b-2 border-slate-950 py-2 px-2">
        <span className="font-bold">Party Name:</span>{' '}
        <span className="font-bold">{destination}</span>
      </div>

      {reason && (
        <div className="border-b-2 border-slate-950 py-2">
          <span className="font-bold">Reason:</span> {reason}
        </div>
      )}

      <table className="challan-table w-full border-collapse table-fixed">
        <thead>
          <tr>
            <th className="w-12 border border-slate-950 py-2 text-center">Sl.No.</th>
            <th className="w-32 border border-slate-950 py-2 px-1 text-center">Asset ID / Category</th>
            <th className="border border-slate-950 py-2 text-left px-3">Particulars</th>
            <th className="w-16 border border-slate-950 py-2 text-center">Qty</th>
          </tr>
        </thead>
        <tbody>
          {challanAssets.map((item, index) => (
            <tr key={item.id} className="align-top">
              <td className="border border-slate-950 h-12 text-center py-2 font-bold">{index + 1}</td>
              <td className="border border-slate-950 h-12 text-center py-2 px-1 font-mono font-bold break-words">
                {item.id} / {item.category || item.type?.split('_')[0] || 'MACHINE'}
              </td>
              <td className="border border-slate-950 h-12 py-2 px-3 font-bold leading-relaxed">
                Make: {item.brand || '-'} | Machine Type: {item.typeName || item.type || '-'}
              </td>
              <td className="border border-slate-950 h-12 py-2 text-center font-bold">1</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="border border-slate-950 py-2 px-3 text-right font-bold">
              Total Qty
            </td>
            <td className="border border-slate-950 py-2 text-center font-bold">
              {challanAssets.length}
            </td>
          </tr>
        </tfoot>
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
              <h3 className="text-sm font-black text-slate-900">
                {initialDcNumber ? 'Delivery Challan Record' : 'Relocation Delivery Challan'}
              </h3>
              <p className="text-[10px] text-slate-500">{generationError || `Generated for ${asset.id}`}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                disabled={!dcNumber}
                className="print-keep px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-lg text-xs font-bold flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print DC
              </button>
              <button type="button" onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {generationError && (
            <div className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <span>{generationError}</span>
              <button
                type="button"
                onClick={() => {
                  setGenerationError('');
                  generateChallanNumber();
                }}
                className="font-bold underline"
              >
                Retry
              </button>
            </div>
          )}
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
