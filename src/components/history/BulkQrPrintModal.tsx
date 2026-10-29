'use client';

import { assetScanUrl } from '@/lib/scanUrl';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  QrCode,
  X,
  CheckSquare,
  Square,
  Copy,
  Check,
  Grid3X3,
  Grid2X2,
  Search,
  Hash,
  SlidersHorizontal,
  LayoutGrid,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export interface BulkQrAsset {
  id: string;
  mcNo?: string;
  serialNo?: string;
  serialNumber?: string;
  name: string;
  brand?: string;
  model?: string;
  type?: string;
  typeName?: string;
  unit?: string;
  currentLine?: string;
  location?: string;
  company?: string;
  status?: string;
  sNo?: number;
}

interface BulkQrPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: BulkQrAsset[];
  companyName?: string;
}

export function BulkQrPrintModal({
  isOpen,
  onClose,
  assets,
  companyName: propCompanyName,
}: BulkQrPrintModalProps) {
  // Client mount flag for ReactDOM.createPortal
  const [mounted, setMounted] = useState<boolean>(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Origin URL for QR codes
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  // Determine active company
  const effectiveCompanyName = useMemo(() => {
    if (propCompanyName) return propCompanyName;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cmms_company_name');
      if (stored) return stored;
      const tenant = localStorage.getItem('cmms_active_tenant');
      if (tenant) return tenant.charAt(0).toUpperCase() + tenant.slice(1);
    }
    const sample = assets.find((a) => a.company);
    return sample?.company || 'Factory Asset Management';
  }, [propCompanyName, assets]);

  // Selection mode: 'COUNT' (chosen number) | 'RANGE' (e.g. # 1 to # 34) | 'CUSTOM' (checkboxes)
  const [selectionMode, setSelectionMode] = useState<'COUNT' | 'RANGE' | 'CUSTOM'>('COUNT');

  // Chosen number input
  const [chosenCount, setChosenCount] = useState<number>(() => {
    return assets.length > 0 ? Math.min(assets.length, 34) : 10;
  });

  // Range inputs
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(() => Math.min(assets.length, 34));

  // Filters
  const [lineFilter, setLineFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected asset IDs (for custom checkbox selection)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // Sticker format mode:
  // 'QR_ONLY' (Default: Centered QR code with Machine ID beneath it, clean sticker)
  // 'PURE_QR' (100% QR code only, zero text)
  // 'QR_WITH_DETAILS' (QR code + brand, model, line)
  const [stickerFormat, setStickerFormat] = useState<'QR_ONLY' | 'PURE_QR' | 'QR_WITH_DETAILS'>('QR_ONLY');

  // Grid columns for printable layout: 3-COL (Standard A4), 4-COL (Compact mini), 2-COL (Large)
  const [gridColumns, setGridColumns] = useState<'2-COL' | '3-COL' | '4-COL'>('3-COL');

  // Copied feedback
  const [copied, setCopied] = useState<boolean>(false);

  // Print isolation: activate body class before printing
  useEffect(() => {
    if (!isOpen) return;

    const handleBeforePrint = () => {
      document.body.classList.add('printing-bulk-qr-active');
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-bulk-qr-active');
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      document.body.classList.remove('printing-bulk-qr-active');
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [isOpen]);

  // Extract unique lines for filter
  const availableLines = useMemo(() => {
    const lines = new Set<string>();
    assets.forEach((a) => {
      const line = a.currentLine || (a.location?.includes('Line') ? a.location : '') || (a.unit?.includes('Line') ? a.unit : '');
      if (line) lines.add(line);
    });
    return Array.from(lines).sort();
  }, [assets]);

  // Filter pool based on line and search query
  const filteredPool = useMemo(() => {
    return assets.filter((a) => {
      if (lineFilter !== 'ALL') {
        const line = a.currentLine || a.location || a.unit || '';
        if (!line.toLowerCase().includes(lineFilter.toLowerCase())) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const idMatch = a.id?.toLowerCase().includes(q);
        const mcNoMatch = a.mcNo?.toLowerCase().includes(q);
        const serialMatch = a.serialNo?.toLowerCase().includes(q) || a.serialNumber?.toLowerCase().includes(q);
        const nameMatch = a.name?.toLowerCase().includes(q);
        const brandMatch = a.brand?.toLowerCase().includes(q);
        const modelMatch = a.model?.toLowerCase().includes(q);
        if (!idMatch && !mcNoMatch && !serialMatch && !nameMatch && !brandMatch && !modelMatch) return false;
      }

      return true;
    });
  }, [assets, lineFilter, searchQuery]);

  // Sync limits when filtered pool changes
  useEffect(() => {
    if (filteredPool.length > 0 && chosenCount > filteredPool.length) {
      setChosenCount(filteredPool.length);
    }
    if (rangeEnd > filteredPool.length) {
      setRangeEnd(Math.max(1, filteredPool.length));
    }
  }, [filteredPool.length]);

  // Initialize selectedIds when switching to custom mode or when pool loads
  useEffect(() => {
    if (filteredPool.length > 0 && selectedIds.size === 0) {
      const initial = new Set<string>();
      const limit = Math.min(filteredPool.length, chosenCount || 34);
      for (let i = 0; i < limit; i++) {
        initial.add(filteredPool[i].id);
      }
      setSelectedIds(initial);
    }
  }, [filteredPool]);

  // Determine final items to print
  const itemsToPrint = useMemo(() => {
    if (selectionMode === 'COUNT') {
      const count = Math.max(1, Math.min(chosenCount || 1, filteredPool.length));
      return filteredPool.slice(0, count);
    }

    if (selectionMode === 'RANGE') {
      const startIdx = Math.max(0, (rangeStart || 1) - 1);
      const endIdx = Math.min(filteredPool.length, Math.max(startIdx + 1, rangeEnd || filteredPool.length));
      return filteredPool.slice(startIdx, endIdx);
    }

    // CUSTOM mode
    return filteredPool.filter((a) => selectedIds.has(a.id));
  }, [selectionMode, chosenCount, rangeStart, rangeEnd, filteredPool, selectedIds]);

  if (!isOpen) return null;

  // Toggle individual asset in CUSTOM mode
  const toggleSelectAsset = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectAllPool = () => {
    const next = new Set<string>();
    filteredPool.forEach((a) => next.add(a.id));
    setSelectedIds(next);
  };

  const clearAllPool = () => {
    setSelectedIds(new Set());
  };

  // Trigger print with guaranteed print isolation
  const handlePrint = () => {
    document.body.classList.add('printing-bulk-qr-active');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-bulk-qr-active');
    }, 1000);
  };

  // Copy scan URLs
  const handleCopyUrls = () => {
    if (typeof window === 'undefined') return;
    const urls = itemsToPrint
      .map((item) => `${assetScanUrl(origin, item.id)}`)
      .join('\n');
    navigator.clipboard?.writeText(urls);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render individual sticker based on selected format
  const renderSticker = (asset: BulkQrAsset, idx: number, isPrintPortal: boolean = false) => {
    const qrValue = `${assetScanUrl(origin, asset.id)}?brand=${encodeURIComponent(asset.brand || '')}&model=${encodeURIComponent(asset.model || '')}&unit=${encodeURIComponent(asset.unit || '')}&company=${encodeURIComponent(asset.company || effectiveCompanyName)}`;
    const displayId = asset.mcNo && asset.mcNo !== '-' ? asset.mcNo : asset.id;
    const serialLabel = asset.serialNo || asset.serialNumber || '';
    const lineLabel = asset.currentLine || asset.location || asset.unit || '';

    // =========================================================================
    // 1. PURE QR CODE (NO TEXT AT ALL)
    // =========================================================================
    if (stickerFormat === 'PURE_QR') {
      return (
        <div
          key={asset.id}
          className="relative bg-white rounded-xl border-2 border-slate-900 p-2.5 sm:p-3 flex flex-col items-center justify-center text-center shadow-xs print-break-inside-avoid print:border-[1.5pt] print:border-black print:rounded-[2mm] print:p-[2mm] print:bg-white"
        >
          {!isPrintPortal && selectionMode === 'CUSTOM' && (
            <button
              type="button"
              onClick={() => toggleSelectAsset(asset.id)}
              className="absolute top-1.5 right-1.5 no-print p-1 rounded hover:bg-slate-100 text-indigo-600 cursor-pointer"
            >
              <CheckSquare className="w-4 h-4 fill-indigo-600 text-white" />
            </button>
          )}

          {!isPrintPortal && (
            <span className="absolute top-1 left-1.5 text-[9px] font-mono text-slate-400 no-print">
              #{idx + 1}
            </span>
          )}

          <div className="p-1 bg-white flex items-center justify-center">
            <QRCodeSVG
              value={qrValue}
              size={120}
              level="H"
              bgColor="#ffffff"
              fgColor="#000000"
              className="w-24 h-24 sm:w-28 sm:h-28 print:w-[32mm] print:h-[32mm]"
            />
          </div>
        </div>
      );
    }

    // =========================================================================
    // 2. QR CODE ONLY (CLEAN: QR CODE + MACHINE ID & SERIAL NO BENEATH) - DEFAULT & RECOMMENDED
    // =========================================================================
    if (stickerFormat === 'QR_ONLY') {
      return (
        <div
          key={asset.id}
          className="relative bg-white rounded-xl border-2 border-slate-900 p-2.5 sm:p-3 flex flex-col items-center justify-center text-center shadow-xs print-break-inside-avoid print:border-[1.5pt] print:border-black print:rounded-[2mm] print:p-[2mm] print:bg-white text-slate-900"
        >
          {!isPrintPortal && selectionMode === 'CUSTOM' && (
            <button
              type="button"
              onClick={() => toggleSelectAsset(asset.id)}
              className="absolute top-1.5 right-1.5 no-print p-1 rounded hover:bg-slate-100 text-indigo-600 cursor-pointer"
            >
              <CheckSquare className="w-4 h-4 fill-indigo-600 text-white" />
            </button>
          )}

          {!isPrintPortal && (
            <span className="absolute top-1 left-1.5 text-[9px] font-mono text-slate-400 no-print">
              #{idx + 1}
            </span>
          )}

          {/* QR Code */}
          <div className="p-1 bg-white flex items-center justify-center">
            <QRCodeSVG
              value={qrValue}
              size={110}
              level="H"
              bgColor="#ffffff"
              fgColor="#000000"
              className="w-22 h-22 sm:w-24 sm:h-24 print:w-[28mm] print:h-[28mm]"
            />
          </div>

          {/* Machine Number / Serial Number */}
          <div className="mt-1.5 text-center w-full px-1">
            <div className="font-mono font-black text-xs sm:text-sm print:text-[9.5pt] text-slate-950 tracking-wider truncate">
              {displayId}
            </div>
            {serialLabel ? (
              <div className="text-[9px] print:text-[6.5pt] font-semibold text-slate-500 print:text-black truncate font-mono">
                {serialLabel}
              </div>
            ) : lineLabel ? (
              <div className="text-[9px] print:text-[6.5pt] font-semibold text-slate-500 print:text-black truncate">
                {lineLabel}
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    // =========================================================================
    // 3. QR + ASSET DETAILS CARD
    // =========================================================================
    return (
      <div
        key={asset.id}
        className="relative bg-white rounded-xl border-2 border-slate-900 p-2.5 sm:p-3 flex flex-row items-center gap-3 shadow-xs print-break-inside-avoid print:border-[1.5pt] print:border-black print:rounded-[2.5mm] print:p-[2.5mm] print:gap-[2.5mm] print:bg-white text-slate-900"
      >
        {!isPrintPortal && selectionMode === 'CUSTOM' && (
          <button
            type="button"
            onClick={() => toggleSelectAsset(asset.id)}
            className="absolute top-1.5 right-1.5 no-print p-1 rounded hover:bg-slate-100 text-indigo-600 cursor-pointer"
          >
            <CheckSquare className="w-4 h-4 fill-indigo-600 text-white" />
          </button>
        )}

        <div className="shrink-0 p-1 bg-white border border-slate-900 rounded-lg flex items-center justify-center print:border-black">
          <QRCodeSVG
            value={qrValue}
            size={80}
            level="H"
            bgColor="#ffffff"
            fgColor="#000000"
            className="w-16 h-16 sm:w-18 sm:h-18 print:w-[22mm] print:h-[22mm]"
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center text-left space-y-0.5 print:space-y-[0.5mm]">
          <div className="text-[7.5px] print:text-[5.5pt] font-extrabold uppercase tracking-wider text-slate-400 print:text-black">
            {asset.company || effectiveCompanyName}
          </div>
          <div className="font-mono font-black text-xs sm:text-sm print:text-[9pt] text-slate-950 tracking-tight truncate leading-tight">
            {displayId}
          </div>
          <div className="text-[9.5px] print:text-[6.5pt] font-bold text-slate-800 truncate">
            {asset.brand || 'Equipment'} {asset.model && asset.model !== '-' ? `• ${asset.model}` : ''}
          </div>
          {serialLabel ? (
            <div className="text-[8.5px] print:text-[6pt] font-semibold text-indigo-700 print:text-black truncate font-mono">
              SN: {serialLabel}
            </div>
          ) : lineLabel ? (
            <div className="text-[8.5px] print:text-[6pt] font-semibold text-indigo-700 print:text-black truncate">
              {lineLabel}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Dynamic CSS rule to guarantee 100% print isolation */}
      <style>{`
        @media print {
          body > *:not(#bulk-qr-print-portal) {
            display: none !important;
            visibility: hidden !important;
          }
          #bulk-qr-print-portal {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            z-index: 99999999 !important;
          }
          #bulk-qr-print-portal * {
            visibility: visible !important;
          }
          @page {
            size: auto;
            margin: 6mm;
          }
        }
      `}</style>

      {/* ===================================================================== */}
      {/* 1. ON-SCREEN MODAL (Hidden during print) */}
      {/* ===================================================================== */}
      <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto no-print">
        <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[96vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
          
          {/* Top Bar */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-900/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
                <QrCode className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                    Print QR Codes Only
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 uppercase tracking-wider">
                    {effectiveCompanyName}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Select chosen number of machines to print pure scannable QR sticker tags
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={handlePrint}
                disabled={itemsToPrint.length === 0}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/30"
              >
                <Printer className="w-4 h-4" />
                <span>Print {itemsToPrint.length} QR Codes Now</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
                title="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Controls Bar */}
          <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 space-y-3 shrink-0">
            
            {/* Row 1: Mode Switcher + Number Inputs */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              
              {/* Mode Tabs */}
              <div className="inline-flex items-center p-1 bg-slate-200/80 rounded-xl text-xs font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={() => setSelectionMode('COUNT')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    selectionMode === 'COUNT'
                      ? 'bg-white text-indigo-700 shadow-xs font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5" />
                  <span>By Chosen Number</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectionMode('RANGE')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    selectionMode === 'RANGE'
                      ? 'bg-white text-indigo-700 shadow-xs font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>By Number Range</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectionMode('CUSTOM')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    selectionMode === 'CUSTOM'
                      ? 'bg-white text-indigo-700 shadow-xs font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Custom Selection</span>
                </button>
              </div>

              {/* Number Selection Details */}
              {selectionMode === 'COUNT' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                    Number of QR Codes:
                  </span>
                  
                  <div className="inline-flex items-center rounded-xl border border-slate-300 bg-white shadow-2xs overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setChosenCount(Math.max(1, chosenCount - 1))}
                      className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-bold text-sm cursor-pointer border-r border-slate-200"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={filteredPool.length || 1}
                      value={chosenCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) setChosenCount(Math.max(1, Math.min(val, filteredPool.length)));
                      }}
                      className="w-16 py-1 text-center font-mono font-bold text-xs text-indigo-700 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setChosenCount(Math.min(filteredPool.length, chosenCount + 1))}
                      className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-bold text-sm cursor-pointer border-l border-slate-200"
                    >
                      +
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {[5, 10, 20, 34, 43, 77].filter((n) => n <= filteredPool.length || n === 34).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setChosenCount(Math.min(n, filteredPool.length))}
                        className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                          chosenCount === n
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setChosenCount(filteredPool.length)}
                      className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                        chosenCount === filteredPool.length
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      All ({filteredPool.length})
                    </button>
                  </div>
                </div>
              )}

              {selectionMode === 'RANGE' && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-slate-700">From #</span>
                  <input
                    type="number"
                    min={1}
                    max={filteredPool.length}
                    value={rangeStart}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v)) setRangeStart(Math.max(1, Math.min(v, rangeEnd)));
                    }}
                    className="w-16 h-8 px-2 text-center font-mono font-bold bg-white border border-slate-300 rounded-lg text-indigo-700 shadow-2xs outline-none"
                  />
                  <span className="font-bold text-slate-700">to #</span>
                  <input
                    type="number"
                    min={rangeStart}
                    max={filteredPool.length}
                    value={rangeEnd}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v)) setRangeEnd(Math.max(rangeStart, Math.min(v, filteredPool.length)));
                    }}
                    className="w-16 h-8 px-2 text-center font-mono font-bold bg-white border border-slate-300 rounded-lg text-indigo-700 shadow-2xs outline-none"
                  />
                  <span className="text-slate-500 font-semibold">
                    ({Math.max(0, rangeEnd - rangeStart + 1)} assets)
                  </span>
                </div>
              )}

              {selectionMode === 'CUSTOM' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllPool}
                    className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition cursor-pointer shadow-2xs flex items-center gap-1"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Select All ({filteredPool.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={clearAllPool}
                    className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition cursor-pointer shadow-2xs flex items-center gap-1"
                  >
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                    <span>Clear</span>
                  </button>
                </div>
              )}

            </div>

            {/* Row 2: Sticker Format Selector + Density + Line Filter */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200/80">
              
              {/* Left: Sticker Format Pill Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-700">Print Format:</span>
                
                <div className="inline-flex items-center p-0.5 bg-slate-200 rounded-lg text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setStickerFormat('QR_ONLY')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      stickerFormat === 'QR_ONLY'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    QR Code + S/N
                  </button>

                  <button
                    type="button"
                    onClick={() => setStickerFormat('PURE_QR')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      stickerFormat === 'PURE_QR'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    Pure QR (No Text)
                  </button>

                  <button
                    type="button"
                    onClick={() => setStickerFormat('QR_WITH_DETAILS')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      stickerFormat === 'QR_WITH_DETAILS'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    QR + Asset Tag
                  </button>
                </div>

                {/* Line Filter */}
                {availableLines.length > 0 && (
                  <div className="flex items-center gap-1 ml-2">
                    <span className="text-[11px] font-bold text-slate-600">Line:</span>
                    <select
                      value={lineFilter}
                      onChange={(e) => setLineFilter(e.target.value)}
                      className="h-7 px-2 text-[11px] font-bold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-2xs focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="ALL">All Lines ({assets.length})</option>
                      {availableLines.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Right: Layout Density (Columns) + Copy URLs */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-300 shadow-2xs text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setGridColumns('3-COL')}
                    className={`px-2 py-1 rounded flex items-center gap-1 transition cursor-pointer ${
                      gridColumns === '3-COL' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
                    }`}
                    title="3 columns (Standard A4 sheet)"
                  >
                    <Grid3X3 className="w-3 h-3" />
                    <span>3 Col</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGridColumns('4-COL')}
                    className={`px-2 py-1 rounded flex items-center gap-1 transition cursor-pointer ${
                      gridColumns === '4-COL' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
                    }`}
                    title="4 columns (Compact mini QR)"
                  >
                    <LayoutGrid className="w-3 h-3" />
                    <span>4 Col</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGridColumns('2-COL')}
                    className={`px-2 py-1 rounded flex items-center gap-1 transition cursor-pointer ${
                      gridColumns === '2-COL' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
                    }`}
                    title="2 columns (Large QR)"
                  >
                    <Grid2X2 className="w-3 h-3" />
                    <span>2 Col</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopyUrls}
                  className="h-7 px-2.5 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition cursor-pointer shadow-2xs flex items-center gap-1"
                  title="Copy all QR URLs to clipboard"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                  <span>{copied ? 'Copied' : 'Copy Links'}</span>
                </button>
              </div>

            </div>

          </div>

          {/* Interactive Screen Preview */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70">
            <div className="mb-3 flex items-center justify-between text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
              <span className="font-bold">
                Previewing <span className="text-indigo-600 font-extrabold">{itemsToPrint.length}</span> QR codes (Page details will be 100% hidden when printing)
              </span>
              <span className="text-slate-400">
                Format: {stickerFormat === 'QR_ONLY' ? 'QR Code + S/N' : stickerFormat === 'PURE_QR' ? 'Pure QR Only' : 'QR + Details'}
              </span>
            </div>

            {itemsToPrint.length === 0 && (
              <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-300">
                <QrCode className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700">No assets selected</p>
                <p className="text-xs text-slate-400 mt-1">Adjust your chosen number or filters above.</p>
              </div>
            )}

            <div
              className={`grid gap-3 ${
                gridColumns === '2-COL'
                  ? 'grid-cols-2'
                  : gridColumns === '4-COL'
                  ? 'grid-cols-4'
                  : 'grid-cols-3'
              }`}
            >
              {itemsToPrint.map((asset, idx) => renderSticker(asset, idx, false))}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="bg-white border-t border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Clean QR Print Ready • Only QR codes will print</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={itemsToPrint.length === 0}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-md shadow-indigo-600/30"
              >
                <Printer className="w-4 h-4" />
                <span>Print {itemsToPrint.length} QR Codes</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. DEDICATED PRINT PORTAL (Active during print, mounted into document.body) */}
      {/* ===================================================================== */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <div id="bulk-qr-print-portal">
          <div
            className={`grid gap-[3mm] p-[3mm] bg-white ${
              gridColumns === '2-COL'
                ? 'grid-cols-2'
                : gridColumns === '4-COL'
                ? 'grid-cols-4'
                : 'grid-cols-3'
            }`}
          >
            {itemsToPrint.map((asset, idx) => renderSticker(asset, idx, true))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
