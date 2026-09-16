import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { ShieldCheck, User, LogOut, AlertTriangle, Clock, Store, Globe } from 'lucide-react';
import OnlineStatusIndicator from './OnlineStatusIndicator';

export default function Navbar({ onOpenShiftModal, lowStockCount = 0 }) {
  const { user, logout, isAdmin } = useAuth();
  const { lang, toggleLanguage, t, isUrdu } = useLanguage();
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [currentShift, setCurrentShift] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) {
      api.drawer.getCurrentShift()
        .then(res => {
          if (res.success) {
            setCurrentShift(res);
          }
        })
        .catch(err => console.error('Error fetching shift status:', err));
    }
  }, [user]);

  return (
    <header className="h-14 bg-white border-b border-slate-200/80 px-4 md:px-5 flex items-center justify-between select-none z-20 shadow-xs">
      {/* Brand & Store Info */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-500/20">
          <Store className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-black tracking-tight text-slate-900 flex items-center gap-1.5">
            UNAIB <span className="text-blue-600 font-bold text-[10px] tracking-wider uppercase px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200">{t('terminal_title')}</span>
          </h1>
          <p className="text-[10px] font-medium text-slate-400">{t('store_sub')}</p>
        </div>
      </div>

      {/* Center Status Indicators & Language Toggle */}
      <div className="flex items-center space-x-2.5">
        {/* Real-time Online / Offline Status Indicator */}
        <OnlineStatusIndicator />

        {/* Language Switcher Pill */}
        <button
          type="button"
          onClick={toggleLanguage}
          title={isUrdu ? 'Switch to English' : 'اردو میں تبدیل کریں'}
          className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 shadow-xs transition-all cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-600" />
          <span>{isUrdu ? '🇵🇰 آسان اردو' : '🇬🇧 English'}</span>
        </button>


        {/* Low Stock Warning Indicator */}
        {lowStockCount > 0 && (
          <div className="hidden lg:flex items-center space-x-1.5 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-full text-xs font-semibold shadow-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>{lowStockCount} {t('low_stock_alert')}</span>
          </div>
        )}

        {/* Real-time Clock */}
        <div className="hidden xl:flex items-center space-x-1.5 text-slate-600 text-xs font-mono font-medium bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{currentTime}</span>
        </div>
      </div>

      {/* User Controls & Profile Pill */}
      <div className="flex items-center space-x-2.5">
        <div className="flex items-center space-x-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 px-3 py-1.5 rounded-full transition-colors">
          <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
            {user?.username?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold text-slate-800 leading-tight">{user?.full_name || user?.username}</div>
            <div className="text-[9px] uppercase font-semibold text-slate-400">
              {user?.role === 'admin' ? t('admin_role') : t('cashier_role')}
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          title={t('logout_btn')}
          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors cursor-pointer border border-transparent hover:border-rose-200"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
