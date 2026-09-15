import React from 'react';
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
  RotateCcw
} from 'lucide-react';

export default function Sidebar({ currentTab, setTab }) {
  const { isAdmin } = useAuth();
  const { t, isUrdu } = useLanguage();

  const mainNavItems = [
    { id: 'pos', label: isUrdu ? 'فروخت و بلنگ (Sale)' : 'Cash Billing (POS)', icon: ShoppingCart },
    { id: 'sale_return', label: isUrdu ? '🔄 سیل واپسی (Sale Return)' : 'Sale Return', icon: RotateCcw },
    { id: 'invoices', label: isUrdu ? 'بلوں کا ریکارڈ (Invoices)' : 'Bills & Invoices', icon: Receipt },
    { id: 'inventory', label: isUrdu ? 'سامان و اسٹاک (Stock)' : 'Inventory & Stock', icon: Package },
    { id: 'purchases', label: isUrdu ? 'مال خریداری (Purchases)' : 'Stock Purchases (GRN)', icon: Truck },
    { id: 'purchase_return', label: isUrdu ? '🚚↩️ خریداری واپسی' : 'Purchase Return', icon: RotateCcw },
    { id: 'ledger', label: isUrdu ? 'کھاتہ و پارٹیاں (Khata)' : 'Party Ledgers (Khata)', icon: BookOpen },
    { id: 'warranty', label: isUrdu ? 'وارنٹی و سیریل نمبر' : 'Warranty & Serials', icon: ShieldAlert },
    { id: 'drawer', label: isUrdu ? 'دکان کا گلہ (Drawer)' : 'Cash Drawer', icon: Landmark },
    { id: 'expenses', label: isUrdu ? 'دکان کے خرچے (Expenses)' : 'Shop Expenses', icon: CreditCard },
    ...(isAdmin ? [
      { id: 'reports', label: isUrdu ? 'مالی رپورٹس و منافع' : 'Financial Reports', icon: BarChart3, adminOnly: true }
    ] : [])
  ];

  return (
    <aside className="w-56 bg-white border-r border-slate-200/80 flex flex-col justify-between select-none py-3.5 px-2.5 shadow-xs shrink-0">
      <div className="space-y-3">
        {/* Brand Logo Header (Matching HRdream logo style) */}
        <div className="flex items-center space-x-2.5 px-2 pb-2.5 border-b border-slate-100">
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

        {/* Navigation list */}
        <nav className="space-y-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
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
            onClick={() => setTab('settings')}
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

        <div className="px-2.5 py-1.5 bg-slate-50/80 rounded-lg text-[10px] text-slate-500 flex justify-between items-center">
          <span className="font-medium text-slate-400">System</span>
          <span className="font-mono font-bold text-slate-700">v1.0.0 (SQLite)</span>
        </div>
      </div>
    </aside>
  );
}
