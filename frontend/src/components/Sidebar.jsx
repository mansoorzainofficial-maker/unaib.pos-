import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  ShoppingCart,
  Receipt,
  Package,
  ShieldAlert,
  BarChart3,
  CreditCard,
  Settings,
  Landmark,
  Truck,
  BookOpen,
  Store,
  RotateCcw,
  Building2,
  History,
  LayoutDashboard,
  X
} from 'lucide-react';

export default function Sidebar({ currentTab, setTab, isMobileOpen = false, onCloseMobile }) {
  const { isAdmin } = useAuth();
  const { t, isUrdu } = useLanguage();
  const [dbLabel, setDbLabel] = useState(() => (navigator.onLine ? '' : 'SQLite (Local)'));
  const secretClicks = useRef(0);
  const secretTimer = useRef(null);

  const handleSecretClick = () => {
    if (!isAdmin) return;
    secretClicks.current += 1;
    clearTimeout(secretTimer.current);
    if (secretClicks.current >= 3) {
      setTab('activity_log');
      secretClicks.current = 0;
    } else {
      secretTimer.current = setTimeout(() => {
        secretClicks.current = 0;
      }, 1500);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const checkStatus = () => {
      if (!navigator.onLine) {
        if (isMounted) setDbLabel('SQLite (Local)');
        return;
      }
      fetch('/api/health')
        .then(res => res.json())
        .then(data => {
          if (isMounted && data?.database) {
            const raw = data.database.toLowerCase();
            if (raw.includes('postgres')) {
              setDbLabel('PostgreSQL (Cloud)');
            } else {
              setDbLabel('SQLite (Local)');
            }
          }
        })
        .catch(() => {
          if (isMounted) setDbLabel('SQLite (Local)');
        });
    };

    checkStatus();

    const handleOnline = () => {
      // Connection restored: instantly re-verify and update label to PostgreSQL (Cloud) without reload
      checkStatus();
    };

    const handleOffline = () => {
      // Connection lost: instantly update label to SQLite (Local)
      if (isMounted) setDbLabel('SQLite (Local)');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const timer = setInterval(checkStatus, 15000);

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(timer);
    };
  }, []);

  const mainNavItems = [
    { id: 'dashboard', label: t('nav_dashboard'), icon: LayoutDashboard },
    { id: 'pos', label: t('nav_pos'), icon: ShoppingCart },
    { id: 'sale_return', label: t('nav_sale_return'), icon: RotateCcw },
    { id: 'invoices', label: t('nav_invoices'), icon: Receipt },
    { id: 'inventory', label: t('nav_inventory'), icon: Package },
    { id: 'suppliers', label: t('nav_suppliers'), icon: Building2 },
    { id: 'grn', label: t('nav_purchases'), icon: Truck },
    { id: 'purchase_return', label: t('nav_purchase_return'), icon: RotateCcw },
    { id: 'ledger', label: t('nav_ledger'), icon: BookOpen },
    { id: 'warranty', label: t('nav_warranty'), icon: ShieldAlert },
    { id: 'accounts', label: t('nav_accounts'), icon: Landmark },
    { id: 'expenses', label: t('nav_expenses'), icon: CreditCard },
    ...(isAdmin ? [
      { id: 'reports', label: t('nav_reports'), icon: BarChart3, adminOnly: true }
    ] : [])
  ];

  const handleItemClick = (id) => {
    setTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  const renderNavContent = (isMobile = false) => (
    <div className="flex flex-col justify-between h-full select-none">
      <div className="space-y-3">
        {/* Brand Logo Header */}
        <div className="flex items-center justify-between px-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black tracking-tight text-slate-900 flex items-center gap-1.5">
                <span>UNAIB</span>
                <span className="text-[9px] bg-blue-50 text-blue-700 font-bold px-1 py-0.5 rounded border border-blue-200">POS</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Computer Accessories</p>
            </div>
          </div>
          {isMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation list */}
        <nav className="space-y-1 overflow-y-auto max-h-[calc(100vh-200px)] md:max-h-none">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center space-x-1">
                  {item.hotkey && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      isActive ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}>
                      {item.hotkey}
                    </span>
                  )}
                  {item.adminOnly && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      Admin
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Settings & Status */}
      <div className="pt-2.5 border-t border-slate-100 space-y-2">
        {isAdmin && (
          <button
            onClick={() => handleItemClick('settings')}
            className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
              currentTab === 'settings'
                ? 'bg-blue-50 text-blue-600 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
            }`}
          >
            <Settings className={`w-4 h-4 ${currentTab === 'settings' ? 'text-blue-600' : 'text-slate-400'}`} />
            <span>{isUrdu ? 'دکان کی سیٹنگز (Settings)' : 'Shop Settings'}</span>
          </button>
        )}

        <div
          onClick={handleSecretClick}
          className="px-2.5 py-1.5 bg-slate-50/80 rounded-lg text-[10px] text-slate-500 flex justify-between items-center gap-1 select-none cursor-default"
          title={dbLabel ? `v1.0.0 (${dbLabel})` : 'v1.0.0'}
        >
          <span className="font-medium text-slate-400 shrink-0">System</span>
          <span className="font-mono font-bold text-slate-700 truncate text-[9.5px]">
            v1.0.0 {dbLabel ? `(${dbLabel})` : ''}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-56 bg-white border-r border-slate-200/80 flex-col justify-between select-none py-3.5 px-2.5 shadow-xs shrink-0">
        {renderNavContent(false)}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Dark Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Sliding Drawer Body */}
          <aside className="relative w-64 max-w-[82vw] bg-white z-10 flex flex-col justify-between py-3.5 px-2.5 shadow-2xl h-full animate-slide-in">
            {renderNavContent(true)}
          </aside>
        </div>
      )}
    </>
  );
}
