import { useEffect, useRef, useCallback } from 'react';

/**
 * useBarcodeScanner
 * 
 * Reusable hook for reliable barcode scanning across POS, GRN, and Sale Return screens.
 * Features:
 * - Detects USB HID hardware barcode scanner keystrokes (< 50ms intervals ending with Enter).
 * - F2 or Ctrl+B global hotkey to focus the input field.
 * - Optional audio beep feedback on scan.
 * - Auto-refocus support so workers can scan items continuously without touching the mouse.
 */
export function useBarcodeScanner({
  onScan,
  inputRef,
  enabled = true,
  playBeep = true,
  minChars = 2,
  maxKeystrokeInterval = 50
}) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  // Audio beep feedback helper
  const triggerAudioBeep = useCallback(() => {
    if (!playBeep || typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      gain.gain.setValueAtTime(0.09, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (_) {
      // Audio context restricted or unavailable
    }
  }, [playBeep]);

  // Handle scanned value
  const handleBarcodeComplete = useCallback((barcode) => {
    const clean = (barcode || '').trim();
    if (!clean || clean.length < minChars) return;
    triggerAudioBeep();
    if (onScan) {
      onScan(clean);
    }
    // Auto refocus input field if attached
    if (inputRef && inputRef.current) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [onScan, inputRef, minChars, triggerAudioBeep]);

  // Global Keydown Listener for F2 focus & rapid scanner buffer
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleGlobalKeyDown = (e) => {
      // F2 or Ctrl+B: Focus the barcode input immediately
      if (e.key === 'F2' || (e.ctrlKey && e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        if (inputRef && inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
        return;
      }

      // Check if user is typing inside a standard interactive input other than the scanner
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';
      const isScannerField = inputRef?.current && document.activeElement === inputRef.current;

      // If user is typing in another regular input (e.g. notes, price), do not intercept normal typing
      if (isInput && !isScannerField) {
        return;
      }

      const now = Date.now();
      const interval = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // When Enter is pressed
      if (e.key === 'Enter') {
        // If rapid buffer accumulated enough characters (< maxKeystrokeInterval average)
        if (bufferRef.current.length >= minChars) {
          e.preventDefault();
          const scanned = bufferRef.current;
          bufferRef.current = '';
          handleBarcodeComplete(scanned);
          return;
        }
        bufferRef.current = '';
        return;
      }

      // Printable single characters (0-9, a-z, A-Z, -, _, etc.)
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // If interval is short (< maxKeystrokeInterval), hardware scanner is streaming characters
        if (interval > maxKeystrokeInterval && bufferRef.current.length > 0) {
          // Interval too long: reset buffer
          bufferRef.current = '';
        }
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [enabled, inputRef, minChars, maxKeystrokeInterval, handleBarcodeComplete]);

  return {
    handleBarcodeComplete,
    triggerAudioBeep
  };
}
