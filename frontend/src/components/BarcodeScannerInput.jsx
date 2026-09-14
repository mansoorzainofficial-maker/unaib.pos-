import React, { useState, useRef, useEffect } from 'react';
import { ScanLine, Search, AlertCircle } from 'lucide-react';

export default function BarcodeScannerInput({ onScan, placeholder = "Scan barcode or type and press Enter..." }) {
  const [value, setValue] = useState('');
  const [lastScanned, setLastScanned] = useState(null);
  const inputRef = useRef(null);

  // Focus input automatically on mount and when F2 key is pressed
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }

    const handleGlobalKeyDown = (e) => {
      // F2 or Ctrl+B focuses barcode input
      if (e.key === 'F2' || (e.ctrlKey && e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const barcode = value.trim();
    if (!barcode) return;

    setLastScanned(barcode);
    onScan(barcode);
    setValue('');

    // Play subtle audio beep on scan
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } catch (err) {
      // Audio context may be restricted
    }
  };

  return (
    <div className="w-full relative">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="absolute left-3.5 text-emerald-600 pointer-events-none flex items-center">
          <ScanLine className="w-5 h-5 animate-pulse" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-11 pr-24 py-2.5 bg-white border-2 border-emerald-500 focus:border-emerald-600 text-slate-900 placeholder-slate-400 text-sm font-mono rounded-xl shadow-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition-all"
        />

        <div className="absolute right-2 flex items-center space-x-1.5">
          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-mono border border-slate-300">
            F2 Focus
          </span>
          <button
            type="submit"
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            Add
          </button>
        </div>
      </form>

      {lastScanned && (
        <div className="text-[10px] text-slate-500 mt-1 pl-2 flex items-center gap-1">
          <span>Last scanned:</span>
          <span className="font-mono text-emerald-600 font-bold">{lastScanned}</span>
        </div>
      )}
    </div>
  );
}
