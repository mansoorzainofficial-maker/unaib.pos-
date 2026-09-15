import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useLanguage } from './context/LanguageContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import POSScreen from './pages/POSScreen';
import InventoryScreen from './pages/InventoryScreen';
import WarrantyScreen from './pages/WarrantyScreen';
import FinancialReportsScreen from './pages/FinancialReportsScreen';
import InvoicesHistoryScreen from './pages/InvoicesHistoryScreen';
import ExpensesScreen from './pages/ExpensesScreen';
import SettingsScreen from './pages/SettingsScreen';
import PurchasesScreen from './pages/PurchasesScreen';
import LedgerScreen from './pages/LedgerScreen';
import SaleReturnScreen from './pages/SaleReturnScreen';
import PurchaseReturnScreen from './pages/PurchaseReturnScreen';
import LoginScreen from './pages/LoginScreen';
import CashDrawerModal from './pages/CashDrawerModal';
import {
  Package,
  ShoppingCart,
  Truck,
  Building2,
  Users,
  BarChart3,
  RotateCcw
} from 'lucide-react';

export default function App() {
  const { user, loading, isAdmin } = useAuth();
  const { t, isUrdu } = useLanguage();
  const [currentTab, setCurrentTab] = useState('pos');
  const [ledgerTab, setLedgerTab] = useState('customers');
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-100 flex items-center justify-center text-slate-600">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-slate-700">Loading Unaib POS Terminal...</span>
        </div>
      </div>
    );
  }

  // Not logged in: Show Login screen
  if (!user) {
    return <LoginScreen />;
  }

  // Fallback if cashier tries accessing admin tabs
  const activeTabSafe = (!isAdmin && (currentTab === 'reports' || currentTab === 'settings')) ? 'pos' : currentTab;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 text-slate-800 overflow-hidden select-none">
      {/* Top Application Navbar */}
      <Navbar
        onOpenShiftModal={() => setIsShiftModalOpen(true)}
        lowStockCount={lowStockCount}
      />

      {/* QUICK MODULES COMMAND BAR */}
      <div className="bg-white px-5 py-2.5 border-b border-slate-200/80 flex items-center justify-between gap-3 overflow-x-auto shadow-xs z-10 shrink-0">
        <div className="flex items-center space-x-2.5 w-full">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1 shrink-0 hidden xl:inline">
            {isUrdu ? 'شارٹ کٹ بٹن:' : 'Quick Modules:'}
          </span>

          {/* 1. INVENTORY */}
          <button
            type="button"
            onClick={() => setCurrentTab('inventory')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTabSafe === 'inventory'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>{isUrdu ? 'سامان و اسٹاک' : 'Inventory'}</span>
          </button>

          {/* 2. CASH BILLING (NAQAD SALE) */}
          <button
            type="button"
            onClick={() => setCurrentTab('pos')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTabSafe === 'pos'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>{isUrdu ? 'نیا بل / کاؤنٹر سیل' : 'Cash Billing (Naqad)'}</span>
          </button>

          {/* 2b. SALE RETURN (سیل واپسی) */}
          <button
            type="button"
            onClick={() => setCurrentTab('sale_return')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTabSafe === 'sale_return'
                ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/30'
                : 'bg-amber-50/60 text-amber-900 hover:bg-amber-100/70 border border-amber-200'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-amber-600" />
            <span>{isUrdu ? '🔄 سیل واپسی' : 'Sale Return'}</span>
          </button>

          {/* 3. GRN (STOCK PURCHASES) */}
          <button
            type="button"
            onClick={() => setCurrentTab('purchases')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTabSafe === 'purchases'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>{isUrdu ? 'مال خریداری (GRN)' : 'GRN Purchases'}</span>
          </button>

          {/* 3b. PURCHASE RETURN (خریداری واپسی) */}
          <button
            type="button"
            onClick={() => setCurrentTab('purchase_return')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTabSafe === 'purchase_return'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/30'
                : 'bg-purple-50/60 text-purple-900 hover:bg-purple-100/70 border border-purple-200'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-purple-600" />
            <span>{isUrdu ? '🚚↩️ خریداری واپسی' : 'Purchase Return'}</span>
          </button>

          {/* 4. SUPPLIERS */}
          <button
            type="button"
            onClick={() => {
              setLedgerTab('suppliers');
              setCurrentTab('ledger');
            }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTabSafe === 'ledger' && ledgerTab === 'suppliers'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>{isUrdu ? 'سپلائرز کھاتہ' : 'Suppliers'}</span>
          </button>

          {/* 5. PARTIES (CUSTOMERS) */}
          <button
            type="button"
            onClick={() => {
              setLedgerTab('customers');
              setCurrentTab('ledger');
            }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTabSafe === 'ledger' && ledgerTab === 'customers'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{isUrdu ? 'گاہکوں کا کھاتہ' : 'Parties (Customers)'}</span>
          </button>

          {/* 6. ACCOUNTS */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setCurrentTab('reports')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTabSafe === 'reports'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>{isUrdu ? 'مالی رپورٹس و منافع' : 'Accounts & Reports'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace: Sidebar + Dynamic Screen */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentTab={activeTabSafe}
          setTab={setCurrentTab}
        />

        <main className="flex-1 flex overflow-hidden relative">
          {activeTabSafe === 'pos' && (
            <POSScreen onLowStockChange={setLowStockCount} />
          )}
          {activeTabSafe === 'sale_return' && (
            <SaleReturnScreen />
          )}
          {activeTabSafe === 'invoices' && (
            <InvoicesHistoryScreen />
          )}
          {activeTabSafe === 'inventory' && (
            <InventoryScreen onLowStockChange={setLowStockCount} />
          )}
          {activeTabSafe === 'purchases' && (
            <PurchasesScreen />
          )}
          {activeTabSafe === 'purchase_return' && (
            <PurchaseReturnScreen />
          )}
          {activeTabSafe === 'ledger' && (
            <LedgerScreen initialTab={ledgerTab} />
          )}
          {activeTabSafe === 'warranty' && (
            <WarrantyScreen />
          )}
          {activeTabSafe === 'reports' && isAdmin && (
            <FinancialReportsScreen />
          )}
          {activeTabSafe === 'expenses' && (
            <ExpensesScreen />
          )}
          {activeTabSafe === 'drawer' && (
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
              <button
                onClick={() => setIsShiftModalOpen(true)}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xl text-sm"
              >
                Open Cash Drawer Session & Reconciliation
              </button>
            </div>
          )}
          {activeTabSafe === 'settings' && isAdmin && (
            <SettingsScreen />
          )}
        </main>
      </div>

      {/* Cash Drawer Reconciliation Modal */}
      <CashDrawerModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
      />
    </div>
  );
}
