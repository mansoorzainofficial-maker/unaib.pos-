import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Store, Lock, User, KeyRound, AlertCircle, ShieldCheck } from 'lucide-react';

export default function LoginScreen() {
  const { login } = useAuth();
  const [mode, setMode] = useState('pin'); // 'pin' or 'password'

  // Standard Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // PIN Pad state
  const [pin, setPin] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError('');
    try {
      await login({ username, password });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (pinValue) => {
    setLoading(true);
    setError('');
    try {
      await login({ pin: pinValue });
    } catch (err) {
      setError(err.message || 'Invalid Quick PIN');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handlePinDigit = (digit) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        handlePinSubmit(newPin);
      }
    }
  };

  const handlePinBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handlePinClear = () => {
    setPin('');
  };

  return (
    <div className="min-h-screen w-screen bg-slate-100 flex flex-col items-center justify-center p-4 relative select-none">
      {/* Background Glow */}
      <div className="absolute w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-sm z-10 space-y-5">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-emerald-600 items-center justify-center shadow-lg shadow-emerald-600/20">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            UNAIB COMPUTER ACCESSORIES
          </h1>
          <p className="text-xs text-slate-500 font-medium">Desktop Point of Sale & Management System</p>
        </div>

        {/* Card Box */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-4">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => { setMode('pin'); setError(''); }}
              className={`py-1.5 rounded-lg transition-all ${
                mode === 'pin' ? 'bg-emerald-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Quick PIN Pad
            </button>
            <button
              onClick={() => { setMode('password'); setError(''); }}
              className={`py-1.5 rounded-lg transition-all ${
                mode === 'password' ? 'bg-emerald-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Username & Password
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* MODE 1: QUICK PIN PAD */}
          {mode === 'pin' ? (
            <div className="space-y-4">
              <div className="text-center">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Enter 4-Digit Terminal PIN
                </label>
                {/* Visual PIN Dots */}
                <div className="flex justify-center gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`w-3.5 h-3.5 rounded-full border transition-all ${
                        pin.length > i
                          ? 'bg-emerald-600 border-emerald-600 scale-110 shadow-sm shadow-emerald-600/40'
                          : 'bg-slate-100 border-slate-300'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    disabled={loading}
                    onClick={() => handlePinDigit(String(num))}
                    className="h-12 bg-slate-50 hover:bg-slate-100 active:bg-emerald-600 active:text-white border border-slate-200 rounded-xl text-base font-bold text-slate-900 font-mono transition-all shadow-xs"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handlePinClear}
                  className="h-12 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handlePinDigit('0')}
                  className="h-12 bg-slate-50 hover:bg-slate-100 active:bg-emerald-600 active:text-white border border-slate-200 rounded-xl text-base font-bold text-slate-900 font-mono transition-all shadow-xs"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handlePinBackspace}
                  className="h-12 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  ⌫
                </button>
              </div>
            </div>
          ) : (
            /* MODE 2: USERNAME & PASSWORD */
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Username</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. admin or cashier1"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all mt-2"
              >
                {loading ? 'Authenticating...' : 'Sign In to Terminal'}
              </button>
            </form>
          )}

          {/* Quick Demo Credentials Assistant */}
          <div className="pt-3 border-t border-slate-200 text-[11px] text-slate-500 space-y-1.5">
            <span className="font-bold text-slate-700 block">Quick Access Credentials:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode('pin');
                  setPin('1234');
                  handlePinSubmit('1234');
                }}
                className="flex-1 p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-left transition-colors"
              >
                <div className="text-emerald-700 font-bold text-[10px]">ADMIN PIN</div>
                <div className="text-slate-800 font-mono font-bold">1234</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('pin');
                  setPin('1111');
                  handlePinSubmit('1111');
                }}
                className="flex-1 p-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-left transition-colors"
              >
                <div className="text-blue-700 font-bold text-[10px]">CASHIER PIN</div>
                <div className="text-slate-800 font-mono font-bold">1111</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
