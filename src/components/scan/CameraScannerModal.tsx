'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, X, QrCode, AlertCircle, ArrowRight } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useToast } from '@/context/ToastContext';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess?: (id: string) => void;
}

export function CameraScannerModal({ isOpen, onClose, onScanSuccess }: CameraScannerModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [manualId, setManualId] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
      return;
    }

    // Delay slight tick to allow DOM element to mount
    const timeout = setTimeout(() => {
      try {
        const scannerElement = document.getElementById('qr-camera-reader');
        if (!scannerElement) return;

        const scanner = new Html5QrcodeScanner(
          'qr-camera-reader',
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            rememberLastUsedCamera: true,
          },
          false
        );

        scannerRef.current = scanner;

        scanner.render(
          (decodedText) => {
            // Check if decoded text is a full URL or direct machine ID
            let targetId = decodedText;
            try {
              if (decodedText.includes('/scan/')) {
                const parts = decodedText.split('/scan/');
                targetId = parts[1].split('?')[0];
              } else if (decodedText.includes('id=')) {
                const url = new URL(decodedText);
                targetId = url.searchParams.get('id') || decodedText;
              }
            } catch {
              targetId = decodedText;
            }

            showToast(`Tag scanned: ${targetId}`, 'success');
            scanner.clear().catch(() => {});
            onClose();
            if (onScanSuccess) {
              onScanSuccess(targetId);
            } else {
              router.push(`/scan/${encodeURIComponent(targetId)}`);
            }
          },
          (errorMessage) => {
            // Non-critical scan tick errors can be ignored
          }
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setCameraError(msg || 'Camera feed unavailable on this device.');
      }
    }, 150);

    return () => {
      clearTimeout(timeout);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isOpen, onClose, onScanSuccess, router, showToast]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = manualId.trim();
    if (!cleanId) return;
    onClose();
    if (onScanSuccess) {
      onScanSuccess(cleanId);
    } else {
      router.push(`/scan/${encodeURIComponent(cleanId)}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-50 px-5 py-4 text-slate-800 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Live Camera QR Scanner</h4>
              <p className="text-[10px] text-slate-500 font-medium">Aim camera at machine asset sticker</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-slate-100 rounded-xl overflow-hidden border border-slate-200 min-h-[260px] flex flex-col items-center justify-center p-2 text-center">
            <div id="qr-camera-reader" className="w-full text-xs text-slate-600" />
            {cameraError && (
              <div className="p-4 text-xs text-amber-800 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Camera Access Note:</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Allow camera permission or enter the Machine Asset ID directly below.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Or Manual Tag ID Entry
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <QrCode className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="e.g. MC-SNLS-101"
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-mono font-medium"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
            >
              <span>Go</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
