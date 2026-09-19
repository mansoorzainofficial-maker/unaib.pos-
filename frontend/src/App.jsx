import React, { useState, useEffect } from 'react';
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
import Suppliers from './pages/Suppliers';
import GrnList from './pages/GrnList';
import CreateGrn from './pages/CreateGrn';
import Ledger from './pages/Ledger';
import SaleReturnScreen from './pages/SaleReturnScreen';
import PurchaseReturnScreen from './pages/PurchaseReturnScreen';
import AccountsScreen from './pages/AccountsScreen';
import ActivityLogScreen from './pages/ActivityLogScreen';
import DashboardScreen from './pages/DashboardScreen';
import LoginScreen from './pages/LoginScreen';
import CashDrawerModal from './pages/CashDrawerModal';

export default function App() {
  const { user, loading, isAdmin } = useAuth();
  const { t, isUrdu } = useLanguage();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [ledgerPartyType, setLedgerPartyType] = useState('supplier');
  const [ledgerPartyId, setLedgerPartyId] = useState(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);

  // Secret access triggers for Audit Trail (Completely hidden from client)
  useEffect(() => {
    const checkHash = () => {
      const h = window.location.hash.toLowerCase();
      if (h === '#audit' || h === '#logs' || h === '#activity') {
        if (isAdmin) setCurrentTab('activity_log');
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);

    const handleKeyDown = (e) => {
      // Secret key combination: Ctrl + Shift + A or Ctrl + Shift + L
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a' || e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        if (isAdmin) setCurrentTab('activity_log');
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('hashchange', checkHash);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAdmin]);

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
  const activeTabSafe = (!isAdmin && (currentTab === 'reports' || currentTab === 'settings' || currentTab === 'activity_log')) ? 'pos' : currentTab;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 text-slate-800 overflow-hidden select-none">
      {/* Top Application Navbar (Logo + Shop Name + Status Indicators) */}
      <Navbar
        onOpenShiftModal={() => setIsShiftModalOpen(true)}
        lowStockCount={lowStockCount}
      />

      {/* Main Workspace: Left Sidebar + Dynamic Screen */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentTab={activeTabSafe}
          setTab={setCurrentTab}
        />

        <main className="flex-1 flex overflow-hidden relative">
          {activeTabSafe === 'dashboard' && (
            <DashboardScreen onNavigate={setCurrentTab} />
          )}
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
          {activeTabSafe === 'suppliers' && (
            <Suppliers
              onNavigateToLedger={(supplierId) => {
                setLedgerPartyType('supplier');
                setLedgerPartyId(supplierId);
                setCurrentTab('ledger');
              }}
            />
          )}
          {(activeTabSafe === 'grn' || activeTabSafe === 'purchases') && (
            <GrnList
              onNavigateToCreate={() => setCurrentTab('create_grn')}
            />
          )}
          {activeTabSafe === 'create_grn' && (
            <CreateGrn
              onNavigateToList={() => setCurrentTab('grn')}
            />
          )}
          {activeTabSafe === 'purchase_return' && (
            <PurchaseReturnScreen />
          )}
          {activeTabSafe === 'ledger' && (
            <Ledger
              initialTab={ledgerPartyType}
              initialPartyId={ledgerPartyId}
            />
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
          {activeTabSafe === 'accounts' && (
            <AccountsScreen />
          )}
          {activeTabSafe === 'settings' && isAdmin && (
            <SettingsScreen />
          )}
          {activeTabSafe === 'activity_log' && isAdmin && (
            <ActivityLogScreen />
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
