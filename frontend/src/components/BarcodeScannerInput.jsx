import React, { useState, useRef, useEffect } from 'react';
import { ScanLine, CheckCircle2 } from 'lucide-react';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';

export default function BarcodeScannerInput({
  onScan,
  placeholder = "Scan barcode or type and press Enter...",
  className = "",
  theme = "emerald", // 'emerald', 'amber', 'blue'
  autoFocus = true,
  badgeText = "F2 Focus"
}) {
  const [value, setValue] = useState('');
  const [lastScanned, setLastScanned] = useState(null);
  const inputRef = useRef(null);

  const handleScanTriggered = (barcode) => {
    const clean = (barcode || '').trim();
    if (!clean) return;
    setLastScanned(clean);
    setValue('');
    if (onScan) {
      onScan(clean);
    }
  };

  const { handleBarcodeComplete } = useBarcodeScanner({
    onScan: handleScanTriggered,
    inputRef,
    enabled: true,
    playBeep: true
  });

  // Focus input automatically on mount if autoFocus is true
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) {
      handleBarcodeComplete(value.trim());
    }
  };

  // Color theme classes
  const themeStyles = {
    emerald: {
      border: 'border-emerald-500 focus:border-emerald-600 focus:ring-emerald-500',
      icon: 'text-emerald-600',
      button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      badge: 'text-emerald-800 bg-emerald-50 border-emerald-200',
      highlight: 'text-emerald-700'
    },
    amber: {
      border: 'border-amber-500 focus:border-amber-600 focus:ring-amber-500',
      icon: 'text-amber-600',
      button: 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold',
      badge: 'text-amber-900 bg-amber-50 border-amber-300',
      highlight: 'text-amber-800'
    },
    blue: {
      border: 'border-blue-500 focus:border-blue-600 focus:ring-blue-500',
      icon: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700 text-white',
      badge: 'text-blue-800 bg-blue-50 border-blue-200',
      highlight: 'text-blue-700'
    }
  };

  const style = themeStyles[theme] || themeStyles.emerald;

  return (
    <div className={`w-full relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className={`absolute left-3.5 ${style.icon} pointer-events-none flex items-center`}>
          <ScanLine className="w-5 h-5 animate-pulse" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className={`w-full pl-11 pr-24 py-2.5 bg-white border-2 text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-mono rounded-xl shadow-xs focus:ring-1 focus:outline-hidden transition-all ${style.border}`}
        />

        <div className="absolute right-2 flex items-center space-x-1.5">
          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-mono border border-slate-300">
            {badgeText}
          </span>
          <button
            type="submit"
            className={`px-3 py-1 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer ${style.button}`}
          >
            Add
          </button>
        </div>
      </form>

      {lastScanned && (
        <div className="text-[10px] text-slate-500 mt-1 pl-2 flex items-center gap-1.5 animate-in fade-in">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Last scanned:</span>
          <span className={`font-mono font-bold ${style.highlight}`}>{lastScanned}</span>
        </div>
      )}
    </div>
  );
}
