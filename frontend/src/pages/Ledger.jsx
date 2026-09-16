import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Users,
  Truck,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  RefreshCw,
  Wallet,
  Building2,
  CheckCircle2
} from 'lucide-react';
import { ledgerApi } from '../services/ledgerApi';
import LedgerTable from '../components/LedgerTable';
import PaymentForm from '../components/PaymentForm';
import { useLanguage } from '../context/LanguageContext';

export default function Ledger({ initialTab = 'supplier', initialPartyId = null }) {
  const { t, isUrdu } = useLanguage();
  const [activeTab, setActiveTab] = useState(initialTab || 'supplier');
  const [parties, setParties] = useState([]);
  const [selectedPartyId, setSelectedPartyId] = useState(initialPartyId || '');
  const [statement, setStatement] = useState(null);
  const [loadingParties, setLoadingParties] = useState(false);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [partySearch, setPartySearch] = useState('');
  const [notification, setNotification] = useState('');

  // Sync when initialTab or initialPartyId props change
  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialPartyId) {
      setSelectedPartyId(initialPartyId);
      loadStatement(activeTab, initialPartyId);
    }
  }, [initialPartyId]);

  // Fetch parties whenever activeTab changes
  useEffect(() => {
    loadParties();
  }, [activeTab]);

  const loadParties = async () => {
    setLoadingParties(true);
    setStatement(null);
    try {
      const list = await ledgerApi.getParties(activeTab);
      setParties(list);
      if (list.length > 0) {
        const targetId = (initialPartyId && list.some(p => p.id === Number(initialPartyId)))
          ? initialPartyId
          : list[0].id;
        setSelectedPartyId(targetId);
        loadStatement(activeTab, targetId);
      } else {
        setSelectedPartyId('');
      }
    } catch (err) {
      console.error('Failed to load parties:', err);
    } finally {
      setLoadingParties(false);
    }
  };

  const loadStatement = async (type, partyId) => {
    if (!partyId) return;
    setLoadingStatement(true);
    try {
      const data = await ledgerApi.getStatement(type, partyId);
      setStatement(data);
    } catch (err) {
      console.error('Failed to load statement:', err);
    } finally {
      setLoadingStatement(false);
    }
  };

  const handleSelectParty = (id) => {
    setSelectedPartyId(id);
    loadStatement(activeTab, id);
  };

  // Called when PaymentForm successfully records a payment
  const handlePaymentSuccess = (updatedStatement) => {
    setStatement(updatedStatement);
    // Update balance in local parties list in real-time
    setParties(prev => prev.map(p => {
      if (p.id === Number(selectedPartyId)) {
        return {
          ...p,
          current_balance: updatedStatement.summary?.current_balance || 0
        };
      }
      return p;
    }));

    setNotification(t('payment_post_success'));
    setTimeout(() => setNotification(''), 4000);
  };

  const selectedParty = parties.find(p => p.id === Number(selectedPartyId)) || statement?.party;
  const isSupplier = activeTab === 'supplier';

  // Filter parties by search
  const filteredParties = parties.filter(p => {
    if (!partySearch.trim()) return true;
    const q = partySearch.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) || (p.phone || '').includes(q);
  });

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      {/* Top Banner / Tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>{t('unified_ledger_title')}</span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                {t('live_calculated_balance')}
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {t('ledger_sub')}
            </p>
          </div>
        </div>

        {/* Tab Switcher: Supplier / Client */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setActiveTab('supplier')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg transition-all cursor-pointer ${
              isSupplier
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>{t('tab_suppliers')}</span>
          </button>
          <button
            onClick={() => setActiveTab('client')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg transition-all cursor-pointer ${
              !isSupplier
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{t('tab_clients')}</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Grid: Left Party Selector + Right Statement & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Column: Party List */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-xs p-3 space-y-3 flex flex-col h-[650px]">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="font-bold text-xs text-slate-800">
              {isSupplier ? t('all_suppliers') : t('all_customers')}
            </span>
            <span className="text-[10px] text-slate-400 font-mono font-semibold">
              {filteredParties.length} {t('available_count')}
            </span>
          </div>

          {/* Search Party */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={partySearch}
              onChange={(e) => setPartySearch(e.target.value)}
              placeholder={t('search_party_placeholder')}
              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Parties List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
            {loadingParties ? (
              <div className="py-10 text-center text-slate-400 text-xs">{t('loading_parties')}</div>
            ) : filteredParties.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">{t('no_party_found')}</div>
            ) : (
              filteredParties.map(p => {
                const isSelected = Number(p.id) === Number(selectedPartyId);
                const bal = Number(p.current_balance || 0);

                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectParty(p.id)}
                    className={`w-full text-right p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-300 shadow-xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 truncate">{p.name}</span>
                      <span className={`font-mono text-[11px] font-black ${
                        bal > 0 ? 'text-amber-700' : bal < 0 ? 'text-emerald-700' : 'text-slate-500'
                      }`}>
                        Rs. {Math.abs(bal).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      <span>{p.phone || t('no_phone')}</span>
                      <span className="font-bold">
                        {bal > 0 ? (isSupplier ? t('payable_cr') : t('receivable_dr')) : bal < 0 ? t('advance') : t('settled_clean')}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Statement, Summary KPIs & In-Page Payment Action */}
        <div className="lg:col-span-3 space-y-4">
          {/* Summary KPIs & Action Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>{selectedParty?.name || t('select_party_heading')}</span>
                  {selectedParty?.phone && (
                    <span className="text-xs text-slate-400 font-mono font-normal">({selectedParty.phone})</span>
                  )}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {selectedParty?.address || t('no_address')}
                </p>
              </div>

              {/* In-Page Action Button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPaymentModalOpen(true)}
                  disabled={!selectedParty}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSupplier ? t('btn_record_payment') : t('btn_receive_payment')}</span>
                </button>

                <button
                  onClick={() => loadStatement(activeTab, selectedPartyId)}
                  title={isUrdu ? "ریفریش کریں" : "Refresh"}
                  className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 3 KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold mb-1">
                  <span>{isSupplier ? t('kpi_purchases') : t('kpi_sales')}</span>
                  <ArrowDownLeft className="w-4 h-4 text-rose-600" />
                </div>
                <div className="font-mono text-base font-black text-slate-900">
                  Rs. {Number(statement?.summary?.total_debit || 0).toLocaleString()}
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold mb-1">
                  <span>{isSupplier ? t('kpi_paid') : t('kpi_received')}</span>
                  <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="font-mono text-base font-black text-emerald-700">
                  Rs. {Number(statement?.summary?.total_credit || 0).toLocaleString()}
                </div>
              </div>

              <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
                <div className="flex items-center justify-between text-amber-900 text-[11px] font-bold mb-1">
                  <span>{t('kpi_net_due')}</span>
                  <Wallet className="w-4 h-4 text-amber-700" />
                </div>
                <div className="font-mono text-lg font-black text-amber-900">
                  Rs. {Math.abs(Number(statement?.summary?.current_balance || 0)).toLocaleString()}{' '}
                  <span className="text-xs font-bold">
                    {Number(statement?.summary?.current_balance || 0) > 0
                      ? isSupplier ? t('due_payable_cr') : t('due_receivable_dr')
                      : Number(statement?.summary?.current_balance || 0) < 0 ? t('due_advance') : t('due_nil')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          {loadingStatement ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 text-xs">
              {t('statement_loading')}
            </div>
          ) : (
            <LedgerTable
              entries={statement?.entries || []}
              partyType={activeTab}
              partyName={selectedParty?.name || ''}
            />
          )}
        </div>
      </div>

      {/* In-Page Payment Form Modal */}
      <PaymentForm
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        partyType={activeTab}
        party={selectedParty}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
