import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { supplierApi } from '../services/supplierApi';
import Modal from '../components/Modal';
import { useLanguage } from '../context/LanguageContext';
import {
  BookOpen,
  Users,
  Truck,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Printer,
  Calendar,
  Plus,
  FileText,
  UserCheck,
  CreditCard,
  Maximize2,
  Minimize2,
  Filter,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Building2,
  Wallet,
  Phone,
  MapPin,
  Clock,
  Download,
  Edit,
  Trash2
} from 'lucide-react';

export default function LedgerScreen({ initialTab = 'customers' }) {
  const { t, isUrdu } = useLanguage();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [summary, setSummary] = useState({ total_receivable: 0, total_payable: 0 });

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      setSelectedParty(null);
      setStatementData(null);
      setIsExpanded(false);
    }
  }, [initialTab]);

  // Parties directory state
  const [parties, setParties] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Selected party statement state
  const [selectedParty, setSelectedParty] = useState(null);
  const [statementData, setStatementData] = useState(null);
  const [statementLoading, setStatementLoading] = useState(false);

  // Window sizing & full-screen expanded views
  const [isExpanded, setIsExpanded] = useState(false); // In-page full-width view
  const [isLargeModalOpen, setIsLargeModalOpen] = useState(false); // Extra-large dedicated modal

  // In-ledger transaction filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entrySearch, setEntrySearch] = useState('');

  // Record payment voucher state
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [referenceNo, setReferenceNo] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  // Add party modal state
  const [isAddPartyOpen, setIsAddPartyOpen] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [partyForm, setPartyForm] = useState({
    name: '',
    phone: '',
    extra: '',
    address: '',
    opening_balance: 0
  });
  const [partySubmitting, setPartySubmitting] = useState(false);

  useEffect(() => {
    loadSummary();
    loadParties();
  }, [activeTab, search]);

  const loadSummary = async () => {
    try {
      const res = await api.ledger.getSummary();
      if (res.success && res.summary) setSummary(res.summary);
    } catch (err) {
      console.error('loadSummary error:', err);
    }
  };

  const loadParties = async () => {
    setLoading(true);
    try {
      if (activeTab === 'customers') {
        const res = await api.invoices.getCustomers({ search: search || undefined });
        if (res.success) {
          setParties(res.customers || []);
          // Auto-select first customer if none selected
          if (!selectedParty && res.customers && res.customers.length > 0) {
            handleOpenPartyStatement(res.customers[0]);
          }
        }
      } else {
        const res = await api.products.getSuppliers();
        if (res.success) {
          const list = (res.suppliers || []).filter(s =>
            !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
            (s.contact_person && s.contact_person.toLowerCase().includes(search.toLowerCase())) ||
            (s.phone && s.phone.includes(search))
          );
          setParties(list);
          // Auto-select first supplier if none selected
          if (!selectedParty && list.length > 0) {
            handleOpenPartyStatement(list[0]);
          }
        }
      }
    } catch (err) {
      console.error('loadParties error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPartyStatement = async (party) => {
    setSelectedParty(party);
    setStatementLoading(true);
    setStartDate('');
    setEndDate('');
    setEntrySearch('');
    try {
      if (activeTab === 'customers') {
        const res = await api.ledger.getCustomer(party.id);
        if (res.success) setStatementData(res);
      } else {
        const res = await api.ledger.getSupplier(party.id);
        if (res.success) setStatementData(res);
      }
    } catch (err) {
      alert(err.message || 'Failed to load ledger statement');
    } finally {
      setStatementLoading(false);
    }
  };

  const handleOpenAddParty = () => {
    setEditingParty(null);
    setPartyForm({ name: '', phone: '', extra: '', address: '', opening_balance: 0 });
    setIsAddPartyOpen(true);
  };

  const handleOpenEditParty = (party) => {
    if (!party) return;
    setEditingParty(party);
    setPartyForm({
      name: party.name || '',
      phone: party.phone || '',
      extra: party.contact_person || party.email || '',
      address: party.address || '',
      opening_balance: party.current_balance || 0
    });
    setIsAddPartyOpen(true);
  };

  const handleDeleteParty = async () => {
    if (!selectedParty) return;
    const isCustomer = activeTab === 'customers';
    const confirmPrompt = isUrdu
      ? `کیا آپ واقعی ${isCustomer ? 'گاہک' : 'سپلائر'} "${selectedParty.name}" کو ڈیلیٹ کرنا چاہتے ہیں؟`
      : `Are you sure you want to delete ${isCustomer ? 'customer' : 'supplier'} "${selectedParty.name}"?`;

    if (!window.confirm(confirmPrompt)) return;

    try {
      if (isCustomer) {
        await api.invoices.deleteCustomer(selectedParty.id);
      } else {
        await supplierApi.delete(selectedParty.id);
      }
      alert(isUrdu ? `✓ ${isCustomer ? 'گاہک' : 'سپلائر'} کامیابی سے ڈیلیٹ ہو گیا۔` : 'Deleted successfully');
      setSelectedParty(null);
      setStatementData(null);
      await loadParties();
      await loadSummary();
    } catch (err) {
      alert(err.message || (isUrdu ? 'ڈیلیٹ کرنے میں رکاوٹ پیش آئی۔' : 'Failed to delete'));
    }
  };

  const handleAddPartySubmit = async (e) => {
    e.preventDefault();
    if (!partyForm.name.trim()) return;
    setPartySubmitting(true);
    try {
      if (editingParty) {
        // Edit Mode
        if (activeTab === 'customers') {
          const res = await api.invoices.updateCustomer(editingParty.id, {
            name: partyForm.name.trim(),
            phone: partyForm.phone ? partyForm.phone.trim() : '',
            address: partyForm.address ? partyForm.address.trim() : ''
          });
          if (res.success) {
            setIsAddPartyOpen(false);
            setEditingParty(null);
            setPartyForm({ name: '', phone: '', extra: '', address: '', opening_balance: 0 });
            await loadParties();
            await loadSummary();
            if (selectedParty?.id === editingParty.id) {
              handleOpenPartyStatement({
                ...selectedParty,
                name: partyForm.name.trim(),
                phone: partyForm.phone ? partyForm.phone.trim() : '',
                address: partyForm.address ? partyForm.address.trim() : ''
              });
            }
          }
        } else {
          await supplierApi.update(editingParty.id, {
            name: partyForm.name.trim(),
            contact_person: partyForm.extra ? partyForm.extra.trim() : null,
            phone: partyForm.phone ? partyForm.phone.trim() : null,
            address: partyForm.address ? partyForm.address.trim() : null
          });
          setIsAddPartyOpen(false);
          setEditingParty(null);
          setPartyForm({ name: '', phone: '', extra: '', address: '', opening_balance: 0 });
          await loadParties();
          await loadSummary();
          if (selectedParty?.id === editingParty.id) {
            handleOpenPartyStatement({
              ...selectedParty,
              name: partyForm.name.trim(),
              contact_person: partyForm.extra ? partyForm.extra.trim() : null,
              phone: partyForm.phone ? partyForm.phone.trim() : null,
              address: partyForm.address ? partyForm.address.trim() : null
            });
          }
        }
      } else {
        // Create Mode
        if (activeTab === 'customers') {
          const res = await api.invoices.createCustomer({
            name: partyForm.name,
            phone: partyForm.phone,
            email: partyForm.extra,
            address: partyForm.address,
            opening_balance: Number(partyForm.opening_balance) || 0
          });
          if (res.success) {
            setIsAddPartyOpen(false);
            setPartyForm({ name: '', phone: '', extra: '', address: '', opening_balance: 0 });
            await loadParties();
            await loadSummary();
          }
        } else {
          const res = await api.products.createSupplier({
            name: partyForm.name,
            phone: partyForm.phone,
            contact_person: partyForm.extra,
            address: partyForm.address,
            opening_balance: Number(partyForm.opening_balance) || 0
          });
          if (res.success) {
            setIsAddPartyOpen(false);
            setPartyForm({ name: '', phone: '', extra: '', address: '', opening_balance: 0 });
            await loadParties();
            await loadSummary();
          }
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to save party');
    } finally {
      setPartySubmitting(false);
    }
  };

  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedParty || !paymentAmount) return;

    setPaymentSubmitting(true);
    try {
      const payload = {
        party_type: activeTab === 'customers' ? 'customer' : 'supplier',
        party_id: selectedParty.id,
        amount: Number(paymentAmount),
        payment_method: paymentMethod,
        payment_date: paymentDate,
        reference_no: referenceNo,
        description: paymentNotes
      };

      const res = await api.ledger.recordPayment(payload);
      if (res.success) {
        setIsPaymentOpen(false);
        setPaymentAmount('');
        setReferenceNo('');
        setPaymentNotes('');
        // Refresh statement & list
        handleOpenPartyStatement(selectedParty);
        loadParties();
        loadSummary();
      }
    } catch (err) {
      alert(err.message || 'Failed to record payment');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // Filtered transactions calculation
  const filteredEntries = useMemo(() => {
    if (!statementData?.entries) return [];
    return statementData.entries.filter(en => {
      if (startDate && en.entry_date < startDate) return false;
      if (endDate && en.entry_date > endDate) return false;
      if (entrySearch && entrySearch.trim()) {
        const q = entrySearch.toLowerCase().trim();
        const matchRef = (en.reference_no || '').toLowerCase().includes(q);
        const matchDesc = (en.description || '').toLowerCase().includes(q);
        const matchDate = (en.entry_date || '').includes(q);
        if (!matchRef && !matchDesc && !matchDate) return false;
      }
      return true;
    });
  }, [statementData, startDate, endDate, entrySearch]);

  const filteredDebit = useMemo(() => {
    return filteredEntries.reduce((sum, en) => sum + (Number(en.debit) || 0), 0);
  }, [filteredEntries]);

  const filteredCredit = useMemo(() => {
    return filteredEntries.reduce((sum, en) => sum + (Number(en.credit) || 0), 0);
  }, [filteredEntries]);

  const handlePrint = () => {
    window.print();
  };

  const storeInfo = statementData?.store || {
    store_name: 'Unaib Computer Accessories',
    store_tagline: 'Gaming Rigs, High-End Components & Genuine Accessories',
    store_address: 'Shop #14, Ground Floor, Techno City Plaza, I.I. Chundrigar Rd, Karachi',
    store_phone: '+92 300 9258123 / 021-32278910',
    store_email: 'sales@unaibcomputers.com'
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 text-slate-800 p-4 space-y-4">
      {/* Header & Tab Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            <span>{isUrdu ? 'ڈبل انٹری کھاتہ لیجر (گاہک و سپلائرز)' : 'Double-Entry Party Ledgers (Khata / Udhar)'}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {isUrdu
              ? 'گاہکوں سے وصول طلب ادھار اور سپلائرز کے واجب الادا بقایا جات، روزنامچہ لیجر اور پرنٹ ایبل اسٹیٹمنٹس'
              : 'Official customer receivables, supplier vendor payables, transaction logs, and printable accounts statements'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('customers');
              setSelectedParty(null);
              setStatementData(null);
              setIsExpanded(false);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'customers' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{isUrdu ? '👥 گاہکوں کا کھاتہ (وصول طلب)' : 'Customer Khata (Receivables)'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('suppliers');
              setSelectedParty(null);
              setStatementData(null);
              setIsExpanded(false);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'suppliers' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>{isUrdu ? '🚚 سپلائر کھاتہ (واجب الادا)' : 'Supplier Khata (Payables)'}</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ocean Blue Card - Customer Udhar */}
        <div className="bg-blue-600 text-white p-5 rounded-2xl flex justify-between items-center shadow-sm shadow-blue-500/20 min-h-[135px]">
          <div>
            <div className="text-[11px] uppercase font-bold text-blue-100 tracking-wider flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4 text-white" />
              <span>{isUrdu ? 'مارکیٹ سے کل وصول طلب ادھار (Customer Udhar)' : 'Total Customer Udhar (Market Receivables)'}</span>
            </div>
            <div className="text-3xl lg:text-4xl font-black font-mono text-white my-1.5 tracking-tight">
              Rs. {summary.total_receivable?.toLocaleString()}
            </div>
            <div className="text-xs font-medium text-blue-100">
              {isUrdu ? 'یہ رقم گاہکوں اور مارکیٹ سے وصول کرنی ہے' : 'Yeh raqam market se wasool karni hai'}
            </div>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white shrink-0">
            <Users className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Fresh Teal Card - Supplier Debt */}
        <div className="bg-teal-500 text-white p-5 rounded-2xl flex justify-between items-center shadow-sm shadow-teal-500/20 min-h-[135px]">
          <div>
            <div className="text-[11px] uppercase font-bold text-teal-100 tracking-wider flex items-center gap-1.5">
              <ArrowDownRight className="w-4 h-4 text-white" />
              <span>{isUrdu ? 'سپلائرز کو کل واجب الادا رقم (Supplier Debt)' : 'Total Supplier Debt (Vendor Payables)'}</span>
            </div>
            <div className="text-3xl lg:text-4xl font-black font-mono text-white my-1.5 tracking-tight">
              Rs. {summary.total_payable?.toLocaleString()}
            </div>
            <div className="text-xs font-medium text-teal-100">
              {isUrdu ? 'ڈسٹری بیوٹرز اور مال سپلائرز کو ادا کرنی ہے' : 'Distributors aur maal suppliers ko ada karni hai'}
            </div>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white shrink-0">
            <Truck className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      {/* MAIN WORKSPACE: Directory List & Statement Panel */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* LEFT DIRECTORY: Hidden when in Full-Width Expanded View */}
        {!isExpanded && (
          <div className="w-4/12 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shrink-0 transition-all duration-200 shadow-xs">
            {/* Directory Header */}
            <div className="p-3 border-b border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  {activeTab === 'customers' ? <Users className="w-3.5 h-3.5 text-emerald-600" /> : <Building2 className="w-3.5 h-3.5 text-pink-700" />}
                  <span>
                    {activeTab === 'customers'
                      ? (isUrdu ? `گاہک / کسٹمرز (${parties.length})` : `Customers (${parties.length})`)
                      : (isUrdu ? `سپلائرز / پارٹیاں (${parties.length})` : `Suppliers (${parties.length})`)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleOpenAddParty}
                  className="flex items-center space-x-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-semibold transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {activeTab === 'customers'
                      ? (isUrdu ? '+ نیا گاہک' : '+ Add Customer')
                      : (isUrdu ? '+ نیا سپلائر' : '+ Add Supplier')}
                  </span>
                </button>
              </div>

              {/* Directory Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    isUrdu
                      ? (activeTab === 'customers' ? 'گاہک کا نام یا موبائل نمبر تلاش کریں...' : 'سپلائر کا نام یا رابطہ تلاش کریں...')
                      : (activeTab === 'customers' ? 'Search customers by name or phone...' : 'Search suppliers by name or contact...')
                  }
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden shadow-xs"
                />
              </div>
            </div>

            {/* Parties Scroll List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loading ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  {isUrdu ? 'کھاتے لوڈ ہو رہے ہیں...' : `Loading ${activeTab}...`}
                </div>
              ) : parties.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs space-y-1">
                  <p className="font-medium text-slate-700">
                    {isUrdu ? `کوئی ${activeTab === 'customers' ? 'گاہک' : 'سپلائر'} نہیں ملا۔` : `No ${activeTab} found.`}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {isUrdu
                      ? `نیا کھاتہ بنانے کے لیے اوپر "+ نیا ${activeTab === 'customers' ? 'گاہک' : 'سپلائر'}" پر کلک کریں۔`
                      : `Click "+ Add ${activeTab === 'customers' ? 'Customer' : 'Supplier'}" to register a new account.`}
                  </p>
                </div>
              ) : (
                parties.map((party) => {
                  const balance = party.current_balance || 0;
                  const isSelected = selectedParty?.id === party.id;

                  return (
                    <button
                      key={party.id}
                      onClick={() => handleOpenPartyStatement(party)}
                      className={`w-full p-3 text-left flex justify-between items-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 border-l-4 border-blue-600 text-slate-900 shadow-inner'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="font-semibold text-xs text-slate-900 truncate">{party.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <span>{party.phone || party.contact_person || (isUrdu ? 'فون درج نہیں' : 'No Phone')}</span>
                        </div>
                      </div>

                      <div className="text-right font-mono shrink-0">
                        <div className="text-[9px] uppercase text-slate-400 font-semibold tracking-wider">
                          {isUrdu ? 'بقایا کھاتہ' : 'Balance'}
                        </div>
                        <div className={`text-xs font-bold ${
                          balance > 0
                            ? activeTab === 'customers' ? 'text-amber-700' : 'text-rose-600'
                            : balance < 0 ? 'text-blue-700' : 'text-slate-400'
                        }`}>
                          Rs. {Math.abs(balance).toLocaleString()}
                          {balance > 0 ? (activeTab === 'customers' ? (isUrdu ? ' (نامہ Dr)' : ' (Dr)') : (isUrdu ? ' (جمعہ Cr)' : ' (Cr)')) : ''}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* RIGHT STATEMENT PANEL: Expands to 100% when isExpanded is true */}
        <div className={`${isExpanded ? 'w-full' : 'w-8/12'} flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs transition-all duration-200`}>
          {!selectedParty ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 p-8">
              <FileText className="w-14 h-14 text-slate-400 stroke-[1.5]" />
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">
                  {isUrdu ? 'کوئی کھاتہ منتخب نہیں ہوا' : 'No Account Selected'}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {isUrdu
                    ? `مکمل کھاتہ اسٹیٹمنٹ دیکھنے کے لیے بائیں جانب فہرست سے کسی بھی ${activeTab === 'customers' ? 'گاہک' : 'سپلائر'} پر کلک کریں۔`
                    : `Click any ${activeTab === 'customers' ? 'customer' : 'supplier'} from the directory list on the left to view complete statement of account.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Statement Header Card */}
              <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Party Profile Information */}
                  <div className="flex items-start gap-3">
                    {/* Back Button if in Full-Width Mode */}
                    {isExpanded && (
                      <button
                        onClick={() => setIsExpanded(false)}
                        title={isUrdu ? 'تقسیم شدہ منظر پر واپس جائیں' : 'Collapse to Split View'}
                        className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition-colors shrink-0 mt-0.5 cursor-pointer shadow-xs"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    )}

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                          activeTab === 'customers'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-pink-50 text-pink-700 border border-pink-200'
                        }`}>
                          {activeTab === 'customers'
                            ? (isUrdu ? 'گاہک کھاتہ' : 'Customer Khata')
                            : (isUrdu ? 'سپلائر کھاتہ' : 'Supplier Khata')}
                        </span>
                        {statementLoading && (
                          <span className="text-[11px] text-slate-500 flex items-center gap-1">
                            <span className="w-2.5 h-2.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                            {isUrdu ? 'لوڈ ہو رہا ہے...' : 'Loading...'}
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
                        <span>{selectedParty.name}</span>
                      </h3>

                      <div className="text-xs text-slate-500 font-mono flex flex-wrap items-center gap-3 mt-1">
                        {selectedParty.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{selectedParty.phone}</span>
                          </span>
                        )}
                        {selectedParty.contact_person && (
                          <span className="text-slate-700">
                            {isUrdu ? 'رابطہ کار:' : 'Contact:'} {selectedParty.contact_person}
                          </span>
                        )}
                        {selectedParty.address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{selectedParty.address}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Sizing Controls Bar */}
                  <div className="flex items-center flex-wrap gap-2">
                    {/* Record Payment Voucher Button */}
                    <button
                      onClick={() => setIsPaymentOpen(true)}
                      className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>
                        {activeTab === 'customers'
                          ? (isUrdu ? 'رقم وصول کریں (Receive)' : 'Receive Payment')
                          : (isUrdu ? 'ادائیگی کریں (Pay)' : 'Pay Supplier')}
                      </span>
                    </button>

                    {/* Edit Party Button */}
                    <button
                      onClick={() => handleOpenEditParty(selectedParty)}
                      title={isUrdu ? `${activeTab === 'customers' ? 'گاہک' : 'سپلائر'} کی تفصیلات میں ترمیم کریں` : 'Edit Party Details'}
                      className="flex items-center space-x-1 px-2.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>{isUrdu ? 'ترمیم' : 'Edit'}</span>
                    </button>

                    {/* Delete Party Button */}
                    <button
                      onClick={handleDeleteParty}
                      title={isUrdu ? `${activeTab === 'customers' ? 'گاہک' : 'سپلائر'} حذف کریں` : 'Delete Party'}
                      className="flex items-center space-x-1 px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isUrdu ? 'حذف' : 'Delete'}</span>
                    </button>

                    {/* Dedicated Large Statement Window Modal */}
                    <button
                      onClick={() => setIsLargeModalOpen(true)}
                      title={isUrdu ? 'بڑی اسکرین پر مکمل اسٹیٹمنٹ کھولیں' : 'Open Dedicated Full-Screen Statement Window'}
                      className="flex items-center space-x-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-blue-700" />
                      <span>{isUrdu ? '🖥️ بڑا ونڈو' : '🖥️ Large Window'}</span>
                    </button>

                    {/* In-Page Full-Width Mode Toggle */}
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      title={isExpanded ? (isUrdu ? "تقسیم منظر پر واپس جائیں" : "Collapse to Split View") : (isUrdu ? "مکمل اسکرین پھیلائیں" : "Expand Statement to Full Screen Width")}
                      className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                      {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>

                    {/* Print Statement Button */}
                    <button
                      onClick={handlePrint}
                      title={isUrdu ? 'آفیشل کھاتہ اسٹیٹمنٹ A4 پرنٹ کریں' : 'Print A4 Statement (Official Ledger)'}
                      className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                    >
                      <Printer className="w-4 h-4 text-emerald-600" />
                      <span>{isUrdu ? '🖨️ پرنٹ اسٹیٹمنٹ' : '🖨️ Print Statement'}</span>
                    </button>
                  </div>
                </div>

                {/* Net Balance & Financial KPI Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex justify-between items-center">
                    <span className="text-slate-600 font-medium">{isUrdu ? 'کل مال بل رقم:' : 'Total Billed:'}</span>
                    <span className="font-mono font-bold text-slate-900">
                      Rs. {filteredDebit.toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex justify-between items-center">
                    <span className="text-slate-600 font-medium">{isUrdu ? 'کل وصول / جمع رقم:' : 'Total Paid/Credit:'}</span>
                    <span className="font-mono font-bold text-emerald-700">
                      Rs. {filteredCredit.toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex justify-between items-center">
                    <span className="text-slate-700 font-semibold">{isUrdu ? 'خالص بقایا کھاتہ:' : 'Net Balance:'}</span>
                    <span className={`font-mono font-black text-sm ${
                      (statementData?.current_balance || 0) > 0
                        ? activeTab === 'customers' ? 'text-amber-700' : 'text-rose-600'
                        : 'text-emerald-700'
                    }`}>
                      Rs. {Math.abs(statementData?.current_balance || 0).toLocaleString()}{' '}
                      {(statementData?.current_balance || 0) > 0
                        ? activeTab === 'customers'
                          ? (isUrdu ? '(ادھار نامہ Dr)' : '(Udhar Dr)')
                          : (isUrdu ? '(واجب الادا جمعہ Cr)' : '(Payable Cr)')
                        : (isUrdu ? '(صاف / NIL)' : '(Clear)')}
                    </span>
                  </div>
                </div>

                {/* Search & Date Filter Strip */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                    <input
                      type="text"
                      value={entrySearch}
                      onChange={(e) => setEntrySearch(e.target.value)}
                      placeholder={isUrdu ? 'واؤچر نمبر، بل یا تفصیل سے تلاش کریں...' : 'Filter by voucher #, invoice, or particulars...'}
                      className="w-full pl-8 pr-2.5 py-1 bg-white border border-slate-300 rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="text-[11px]">{isUrdu ? 'شروع تاریخ:' : 'From:'}</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-2 py-1 bg-white border border-slate-300 rounded-md text-xs text-slate-800"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="text-[11px]">{isUrdu ? 'ختم تاریخ:' : 'To:'}</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-2 py-1 bg-white border border-slate-300 rounded-md text-xs text-slate-800"
                    />
                  </div>

                  {(startDate || endDate || entrySearch) && (
                    <button
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                        setEntrySearch('');
                      }}
                      className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-md text-xs cursor-pointer"
                      title={isUrdu ? 'فلٹرز ختم کریں' : 'Reset Filters'}
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{isUrdu ? 'ری سیٹ' : 'Reset'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="flex-1 overflow-y-auto p-3">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-bold tracking-wider sticky top-0 border-b border-slate-200 z-10 shadow-xs">
                    <tr>
                      <th className="py-2.5 px-3 w-28">{isUrdu ? 'تاریخ' : 'Date'}</th>
                      <th className="py-2.5 px-3 w-40">{isUrdu ? 'واؤچر / حوالہ #' : 'Ref / Voucher #'}</th>
                      <th className="py-2.5 px-3">{isUrdu ? 'سامان و تفصیل (Particulars)' : 'Particulars / Description'}</th>
                      <th className="py-2.5 px-3 text-right w-32">{isUrdu ? 'نامہ / ڈیبٹ (Dr +)' : 'Debit (Dr +)'}</th>
                      <th className="py-2.5 px-3 text-right w-32">{isUrdu ? 'جمعہ / کریڈٹ (Cr -)' : 'Credit (Cr -)'}</th>
                      <th className="py-2.5 pr-3 text-right w-36">{isUrdu ? 'میزان بقایا (Balance)' : 'Running Balance'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {filteredEntries.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-12 text-center text-slate-500 font-sans space-y-1">
                          <p className="font-semibold text-sm text-slate-700">
                            {isUrdu ? 'کوئی ٹرانزیکشن یا اندراج نہیں ملا' : 'No transactions found'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {entrySearch || startDate || endDate
                              ? (isUrdu ? 'فلٹر کے مطابق کوئی ریکارڈ نہیں ملا۔ فلٹر ختم کرنے کے لیے ری سیٹ پر کلک کریں۔' : 'No records match your active filters. Click Reset to clear filters.')
                              : (isUrdu ? 'اس پارٹی کے کھاتے میں ابھی تک کوئی اندراج نہیں ہوا ہے۔' : 'No ledger transactions recorded yet for this party.')}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredEntries.map((en) => (
                        <tr key={en.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{en.entry_date}</td>
                          <td className="py-2.5 px-3 font-semibold text-blue-700 whitespace-nowrap">
                            {en.reference_no || '—'}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-800">
                            <div className="font-medium text-slate-900">{en.description}</div>
                            {en.payment_method && (
                              <div className="text-[10px] text-slate-500 font-mono uppercase mt-0.5">
                                {isUrdu ? 'ذریعہ ادائیگی:' : 'Mode:'} {en.payment_method}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium">
                            {en.debit > 0 ? (
                              <span className="text-amber-800 font-bold">Rs. {en.debit.toLocaleString()}</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium">
                            {en.credit > 0 ? (
                              <span className="text-emerald-700 font-bold">Rs. {en.credit.toLocaleString()}</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-black text-slate-900">
                            Rs. {en.balance.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          DEDICATED FULL-SCREEN / EXTRA-LARGE STATEMENT MODAL (MAX-W-7XL)
          Solves "Window size is too small": Gives 96% screen width & large typography!
          ========================================================================= */}
      <Modal
        isOpen={isLargeModalOpen && !!selectedParty}
        onClose={() => setIsLargeModalOpen(false)}
        title={isUrdu ? `کھاتہ اسٹیٹمنٹ: ${selectedParty?.name}` : `Statement of Account: ${selectedParty?.name}`}
        maxWidth="w-[96vw] max-w-7xl"
      >
        {selectedParty && (
          <div className="space-y-4 text-xs">
            {/* Modal Header Profile Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                    activeTab === 'customers'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-pink-50 text-pink-700 border border-pink-200'
                  }`}>
                    {activeTab === 'customers'
                      ? (isUrdu ? 'گاہک کھاتہ' : 'Customer Account')
                      : (isUrdu ? 'سپلائر کھاتہ' : 'Supplier Account')}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {isUrdu ? 'کھاتہ آئی ڈی:' : 'Account ID:'} #{selectedParty.id}
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 mt-1">{selectedParty.name}</h2>
                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-4 mt-1 font-mono">
                  {selectedParty.phone && <span>📞 {isUrdu ? 'فون:' : 'Phone:'} {selectedParty.phone}</span>}
                  {selectedParty.contact_person && <span>👤 {isUrdu ? 'رابطہ کار:' : 'Contact:'} {selectedParty.contact_person}</span>}
                  {selectedParty.address && <span>📍 {isUrdu ? 'پتہ:' : 'Address:'} {selectedParty.address}</span>}
                </div>
              </div>

              {/* Net Balance in Large Modal */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-right shrink-0 shadow-xs">
                <div className="text-[10px] uppercase font-semibold text-slate-500">
                  {isUrdu ? 'موجودہ خالص بقایا کھاتہ' : 'Current Net Balance'}
                </div>
                <div className={`text-xl font-black font-mono mt-0.5 ${
                  (statementData?.current_balance || 0) > 0
                    ? activeTab === 'customers' ? 'text-amber-700' : 'text-rose-600'
                    : 'text-emerald-700'
                }`}>
                  Rs. {Math.abs(statementData?.current_balance || 0).toLocaleString()}{' '}
                  {(statementData?.current_balance || 0) > 0
                    ? activeTab === 'customers'
                      ? (isUrdu ? '(ادھار نامہ Dr)' : '(Udhar Dr)')
                      : (isUrdu ? '(واجب الادا جمعہ Cr)' : '(Payable Cr)')
                    : (isUrdu ? '(صاف / NIL)' : '(NIL)')}
                </div>
              </div>
            </div>

            {/* Financial KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  {isUrdu ? 'کل نامہ / ڈیبٹ (+)' : 'Total Debited (+)'}
                </div>
                <div className="text-lg font-black font-mono text-amber-800 mt-0.5">
                  Rs. {filteredDebit.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {isUrdu ? 'کل مال فروخت / بل' : 'Total sale invoices / bills'}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  {isUrdu ? 'کل جمعہ / کریڈٹ (-)' : 'Total Credited (-)'}
                </div>
                <div className="text-lg font-black font-mono text-emerald-700 mt-0.5">
                  Rs. {filteredCredit.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {isUrdu ? 'کل وصول شدہ / ادا شدہ رقم' : 'Total payments received / cleared'}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  {isUrdu ? 'کل اندراجات' : 'Total Transactions'}
                </div>
                <div className="text-lg font-black font-mono text-slate-900 mt-0.5">
                  {filteredEntries.length} {isUrdu ? 'ریکارڈز' : 'Records'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {isUrdu ? 'اسٹیٹمنٹ کی سطریں' : 'Filtered ledger lines'}
                </div>
              </div>
            </div>

            {/* Filter Toolbar inside Large Modal */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative min-w-[220px]">
                  <Search className="w-4 h-4 absolute left-3 top-2 text-slate-400" />
                  <input
                    type="text"
                    value={entrySearch}
                    onChange={(e) => setEntrySearch(e.target.value)}
                    placeholder={isUrdu ? 'اندراجات میں تلاش کریں...' : 'Search within transactions...'}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span>{isUrdu ? 'شروع:' : 'From:'}</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span>{isUrdu ? 'ختم:' : 'To:'}</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                  />
                </div>

                {(startDate || endDate || entrySearch) && (
                  <button
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                      setEntrySearch('');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs cursor-pointer shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isUrdu ? 'ری سیٹ' : 'Reset'}</span>
                  </button>
                )}
              </div>

              {/* Print Button inside Large Modal */}
              <button
                onClick={handlePrint}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{isUrdu ? '🖨️ پرنٹ اسٹیٹمنٹ (A4)' : '🖨️ Print Statement (A4)'}</span>
              </button>
            </div>

            {/* High-definition Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-[50vh] overflow-y-auto shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-bold tracking-wider sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="py-3 px-4 w-32">{isUrdu ? 'تاریخ' : 'Date'}</th>
                    <th className="py-3 px-4 w-44">{isUrdu ? 'واؤچر / بل #' : 'Ref / Voucher #'}</th>
                    <th className="py-3 px-4">{isUrdu ? 'تفصیل و سامان' : 'Particulars / Description'}</th>
                    <th className="py-3 px-4 text-right w-36">{isUrdu ? 'نامہ (Dr +)' : 'Debit (Dr +)'}</th>
                    <th className="py-3 px-4 text-right w-36">{isUrdu ? 'جمعہ (Cr -)' : 'Credit (Cr -)'}</th>
                    <th className="py-3 pr-4 text-right w-40">{isUrdu ? 'میزان بقایا' : 'Running Balance'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-500 font-sans">
                        {isUrdu ? 'اس تاریخ کے درمیان کوئی ریکارڈ موجود نہیں ہے۔' : 'No transactions recorded for this selected range.'}
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((en) => (
                      <tr key={en.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{en.entry_date}</td>
                        <td className="py-3 px-4 font-semibold text-blue-700 whitespace-nowrap">{en.reference_no || '—'}</td>
                        <td className="py-3 px-4 font-sans text-slate-800">
                          <div className="font-medium text-slate-900">{en.description}</div>
                          {en.payment_method && (
                            <div className="text-[10px] text-slate-500 font-mono uppercase mt-0.5">
                              {isUrdu ? 'ذریعہ ادائیگی:' : 'Mode:'} {en.payment_method}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          {en.debit > 0 ? (
                            <span className="text-amber-800 font-bold">Rs. {en.debit.toLocaleString()}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          {en.credit > 0 ? (
                            <span className="text-emerald-700 font-bold">Rs. {en.credit.toLocaleString()}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right font-black text-slate-900 text-sm">
                          Rs. {en.balance.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsLargeModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
              >
                {isUrdu ? 'ونڈو بند کریں' : 'Close Window'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {activeTab === 'customers'
                    ? (isUrdu ? 'رقم وصول کریں' : 'Receive Payment')
                    : (isUrdu ? 'ادائیگی کریں' : 'Pay Supplier')}
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isUrdu ? 'A4 پرنٹ اسٹیٹمنٹ' : 'Print A4 Statement'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* =========================================================================
          OFFICIAL PRINTABLE STATEMENT (A4 / PAGE PRINT FORMAT)
          Visible ONLY during print via #ledger-printable-statement in index.css!
          ========================================================================= */}
      {selectedParty && (
        <div id="ledger-printable-statement" className="hidden print:block">
          {/* Header */}
          <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: '900', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {storeInfo.store_name || 'Unaib Computer Accessories'}
                </h1>
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px', fontStyle: 'italic' }}>
                  {storeInfo.store_tagline || 'Gaming Rigs, High-End Components & Genuine Accessories'}
                </div>
                <div style={{ fontSize: '11px', color: '#334155', marginTop: '4px' }}>
                  📍 {storeInfo.store_address || 'Techno City Plaza, Karachi'}
                </div>
                <div style={{ fontSize: '11px', color: '#334155' }}>
                  📞 {isUrdu ? 'فون:' : 'Phone:'} {storeInfo.store_phone} | ✉️ {storeInfo.store_email}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '800',
                  padding: '4px 10px',
                  border: '2px solid #0f172a',
                  display: 'inline-block',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  {isUrdu ? 'کھاتہ اسٹیٹمنٹ' : 'STATEMENT OF ACCOUNT'}
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                  {isUrdu ? 'پرنٹ تاریخ:' : 'Print Date:'} {new Date().toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Party Profile Banner */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: '12px',
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            padding: '10px 14px',
            marginBottom: '16px',
            borderRadius: '4px'
          }}>
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>
                {activeTab === 'customers'
                  ? (isUrdu ? 'گاہک (کسٹمر / کھاتہ دار)' : 'Customer (Gahak / Khata)')
                  : (isUrdu ? 'سپلائر (وینڈر / ڈسٹری بیوٹر)' : 'Supplier (Vendor / Distributor)')}
              </div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                {selectedParty.name}
              </div>
              <div style={{ fontSize: '11px', color: '#334155', marginTop: '3px' }}>
                {selectedParty.phone && <span>{isUrdu ? 'فون:' : 'Phone:'} {selectedParty.phone} • </span>}
                {selectedParty.contact_person && <span>{isUrdu ? 'رابطہ کار:' : 'Contact:'} {selectedParty.contact_person} • </span>}
                {selectedParty.address && <span>{selectedParty.address}</span>}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>
                {isUrdu ? 'موجودہ خالص بقایا کھاتہ' : 'Current Net Balance'}
              </div>
              <div style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>
                Rs. {Math.abs(statementData?.current_balance || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: (statementData?.current_balance || 0) > 0 ? '#b45309' : '#059669' }}>
                {(statementData?.current_balance || 0) > 0
                  ? activeTab === 'customers'
                    ? (isUrdu ? 'وصول طلب رقم (RECEIVABLE)' : 'WASOOL TALAB (RECEIVABLE)')
                    : (isUrdu ? 'واجب الادا بقایا (PAYABLE)' : 'ADAIGI BAAQI (PAYABLE)')
                  : (isUrdu ? 'صاف کھاتہ / NIL' : 'NIL / CLEAR ACCOUNT')}
              </div>
            </div>
          </div>

          {/* Statement Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '16px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', borderTop: '1px solid #94a3b8', borderBottom: '2px solid #475569' }}>
                <th style={{ padding: '8px 6px', textAlign: 'left', width: '15%' }}>{isUrdu ? 'تاریخ' : 'Date'}</th>
                <th style={{ padding: '8px 6px', textAlign: 'left', width: '20%' }}>{isUrdu ? 'واؤچر / بل #' : 'Voucher / Ref #'}</th>
                <th style={{ padding: '8px 6px', textAlign: 'left', width: '35%' }}>{isUrdu ? 'تفصیل و اندراج' : 'Description / Particulars'}</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', width: '15%' }}>{isUrdu ? 'نامہ (+)' : 'Debit (+)'}</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', width: '15%' }}>{isUrdu ? 'جمعہ (-)' : 'Credit (-)'}</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', width: '15%' }}>{isUrdu ? 'میزان بقایا' : 'Balance'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((en, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                  <td style={{ padding: '6px', whiteSpace: 'nowrap' }}>{en.entry_date}</td>
                  <td style={{ padding: '6px', fontWeight: 'bold' }}>{en.reference_no || '—'}</td>
                  <td style={{ padding: '6px' }}>
                    {en.description}
                    {en.payment_method && <span style={{ fontSize: '9px', color: '#64748b' }}> ({en.payment_method})</span>}
                  </td>
                  <td style={{ padding: '6px', textAlign: 'right', fontWeight: en.debit > 0 ? 'bold' : 'normal' }}>
                    {en.debit > 0 ? `Rs. ${en.debit.toLocaleString()}` : '—'}
                  </td>
                  <td style={{ padding: '6px', textAlign: 'right', fontWeight: en.credit > 0 ? 'bold' : 'normal' }}>
                    {en.credit > 0 ? `Rs. ${en.credit.toLocaleString()}` : '—'}
                  </td>
                  <td style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>
                    Rs. {en.balance.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#f1f5f9', fontWeight: 'bold' }}>
                <td colSpan="3" style={{ padding: '8px 6px', textAlign: 'right', textTransform: 'uppercase' }}>
                  {isUrdu ? 'کل ٹوٹل:' : 'Totals:'}
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                  Rs. {filteredDebit.toLocaleString()}
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                  Rs. {filteredCredit.toLocaleString()}
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontSize: '13px', fontWeight: '900' }}>
                  Rs. {Math.abs(statementData?.current_balance || 0).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Signatures & Verification */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '10px' }}>
            <div style={{ textAlign: 'center', width: '28%' }}>
              <div style={{ borderTop: '1px solid #475569', paddingTop: '6px', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                {isUrdu ? 'تیار کنندہ (اکاؤنٹس)' : 'Prepared By (Accounts)'}
              </div>
            </div>

            <div style={{ textAlign: 'center', width: '28%' }}>
              <div style={{ borderTop: '1px solid #475569', paddingTop: '6px', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                {isUrdu ? 'تصدیقی دستخط و مہر' : 'Authorized Seal & Sign'}
              </div>
            </div>

            <div style={{ textAlign: 'center', width: '28%' }}>
              <div style={{ borderTop: '1px solid #475569', paddingTop: '6px', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                {isUrdu ? 'دستخط وصول کنندہ / پارٹی' : 'Party Acknowledgment'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          RECORD PAYMENT MODAL (Spacious & Clean Layout)
          ========================================================================= */}
      <Modal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        title={
          isUrdu
            ? activeTab === 'customers'
              ? `رقم وصولی کا اندراج: ${selectedParty?.name}`
              : `ادائیگی کا اندراج: ${selectedParty?.name}`
            : activeTab === 'customers'
            ? `Receive Payment: ${selectedParty?.name}`
            : `Make Payment: ${selectedParty?.name}`
        }
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
          <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 flex justify-between items-center text-xs">
            <div>
              <span className="text-amber-900 font-semibold block">
                {isUrdu ? 'موجودہ واجب الادا / بقایا کھاتہ:' : 'Current Outstanding Balance:'}
              </span>
              <span className="text-[11px] text-amber-700">
                {isUrdu
                  ? activeTab === 'customers'
                    ? 'یہ رقم گاہک سے وصول کرنی باقی ہے'
                    : 'یہ رقم سپلائر کو ادا کرنی باقی ہے'
                  : activeTab === 'customers'
                  ? 'Amount receivable from customer'
                  : 'Amount payable to supplier'}
              </span>
            </div>
            <span className="font-mono font-black text-amber-700 text-base">
              Rs. {Math.abs(selectedParty?.current_balance || 0).toLocaleString()}
            </span>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-700">
                {isUrdu ? 'رقم ادائیگی / وصولی (روپے) *' : 'Payment Amount (Rs.) *'}
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                {isUrdu ? 'اپنی مرضی کی رقم لکھیں یا نیچے بٹن دبائیں:' : 'Type custom amount or click preset:'}
              </span>
            </div>
            <input
              type="number"
              min="1"
              required
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder={isUrdu ? 'مثلاً 20000 یا 30000' : 'e.g. 20000 or 30000'}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-base font-mono font-bold text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            />
            {/* Quick Amount Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-0.5">
                {isUrdu ? 'فوری رقم:' : 'Quick:'}
              </span>
              <button
                type="button"
                onClick={() => setPaymentAmount('5000')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                  paymentAmount === '5000'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {isUrdu ? '5 ہزار' : '5k'}
              </button>
              <button
                type="button"
                onClick={() => setPaymentAmount('10000')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                  paymentAmount === '10000'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {isUrdu ? '10 ہزار' : '10k'}
              </button>
              <button
                type="button"
                onClick={() => setPaymentAmount('20000')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                  paymentAmount === '20000'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}
              >
                {isUrdu ? '20 ہزار' : '20k'}
              </button>
              <button
                type="button"
                onClick={() => setPaymentAmount('30000')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                  paymentAmount === '30000'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}
              >
                {isUrdu ? '30 ہزار' : '30k'}
              </button>
              <button
                type="button"
                onClick={() => setPaymentAmount('50000')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                  paymentAmount === '50000'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {isUrdu ? '50 ہزار' : '50k'}
              </button>
              {Number(selectedParty?.current_balance || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setPaymentAmount(String(Math.abs(Math.round(Number(selectedParty?.current_balance || 0)))))}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-xs font-bold cursor-pointer"
                >
                  {isUrdu
                    ? `مکمل بقایا (Rs. ${Math.abs(Math.round(Number(selectedParty?.current_balance || 0))).toLocaleString()})`
                    : `Full Balance (Rs. ${Math.abs(Math.round(Number(selectedParty?.current_balance || 0))).toLocaleString()})`}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isUrdu ? 'طریقہ ادائیگی' : 'Payment Method'}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
              >
                <option value="cash">{isUrdu ? '💵 نقد کیش' : '💵 Cash In Hand'}</option>
                <option value="bank">{isUrdu ? '🏦 بینک ٹرانسفر / آن لائن' : '🏦 Bank Transfer / Online'}</option>
                <option value="cheque">{isUrdu ? '💳 بینک چیک' : '💳 Bank Cheque'}</option>
                <option value="wallet">{isUrdu ? '📱 ایزی پیسہ / جاز کیش' : '📱 EasyPaisa / JazzCash'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isUrdu ? 'تاریخ ادائیگی' : 'Payment Date'}
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isUrdu ? 'رسید / چیک نمبر / آن لائن ٹرانزیکشن ID (اختیاری)' : 'Receipt / Cheque # / Online Ref (Optional)'}
            </label>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder={isUrdu ? 'مثلاً REC-1049، چیک نمبر، یا بینک ٹرانزیکشن ID' : 'e.g. REC-1049, Cheque # 99482, or IBFT Trans ID'}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isUrdu ? 'تفصیل و کیفیات (نوٹس)' : 'Notes / Remarks'}
            </label>
            <input
              type="text"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder={isUrdu ? 'مثلاً جزوی رقم وصولی بل کے تحت' : 'e.g. Partial recovery against GPU Invoice #UCA-002'}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsPaymentOpen(false)}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold"
            >
              {isUrdu ? 'منسوخ' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={paymentSubmitting}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20"
            >
              {paymentSubmitting
                ? isUrdu ? 'اندراج ہو رہا ہے...' : 'Posting Voucher...'
                : isUrdu ? '✓ کھاتے میں واؤچر درج کریں' : '✓ Post to Ledger'}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          ADD NEW PARTY MODAL (Upgraded to max-w-2xl Spacious Layout)
          ========================================================================= */}
      <Modal
        isOpen={isAddPartyOpen}
        onClose={() => {
          setIsAddPartyOpen(false);
          setEditingParty(null);
        }}
        title={
          editingParty
            ? (isUrdu
                ? `${activeTab === 'customers' ? 'گاہک' : 'سپلائر'} کی تفصیلات میں ترمیم: ${editingParty.name}`
                : `Edit ${activeTab === 'customers' ? 'Customer' : 'Supplier'}: ${editingParty.name}`)
            : (isUrdu
                ? activeTab === 'customers'
                  ? 'نیا گاہک (کھاتہ دار) رجسٹر کریں'
                  : 'نیا سپلائر / ڈسٹری بیوٹر رجسٹر کریں'
                : `Register New ${activeTab === 'customers' ? 'Customer (Khata)' : 'Supplier (Vendor / Distributor)'}`)
        }
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleAddPartySubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isUrdu
                  ? activeTab === 'customers'
                    ? 'گاہک یا دکان کا نام *'
                    : 'سپلائر یا کمپنی کا نام *'
                  : activeTab === 'customers'
                  ? 'Customer / Shop Name *'
                  : 'Supplier / Vendor Company Name *'}
              </label>
              <input
                type="text"
                required
                value={partyForm.name}
                onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })}
                placeholder={
                  isUrdu
                    ? activeTab === 'customers'
                      ? 'مثلاً طارق گیمنگ زون'
                      : 'مثلاً ایپکس ٹیک ہول سیل ڈسٹری بیوٹرز'
                    : activeTab === 'customers'
                    ? 'e.g. Tariq Gaming Zone'
                    : 'e.g. Apex Tech Wholesale Distributors'
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isUrdu ? 'موبائل / فون نمبر' : 'Mobile / Phone #'}
              </label>
              <input
                type="text"
                value={partyForm.phone}
                onChange={(e) => setPartyForm({ ...partyForm, phone: e.target.value })}
                placeholder="e.g. 0321-5551234"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isUrdu
                  ? activeTab === 'customers'
                    ? 'ای میل (اختیاری)'
                    : 'رابطہ کار شخص / مینیجر'
                  : activeTab === 'customers'
                  ? 'Email (Optional)'
                  : 'Contact Person / Manager'}
              </label>
              <input
                type="text"
                value={partyForm.extra}
                onChange={(e) => setPartyForm({ ...partyForm, extra: e.target.value })}
                placeholder={
                  isUrdu
                    ? activeTab === 'customers'
                      ? 'customer@example.com'
                      : 'مثلاً اسلم بھائی (مینیجر)'
                    : activeTab === 'customers'
                    ? 'customer@example.com'
                    : 'e.g. Aslam Bhai (Manager)'
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            {!editingParty && (
              <div>
                <label className="block text-xs font-semibold text-amber-600 mb-1">
                  {isUrdu ? 'پچھلا بقایا کھاتہ / پرانا ادھار (روپے)' : 'Opening Balance / Previous Udhar (Rs.)'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={partyForm.opening_balance}
                  onChange={(e) => setPartyForm({ ...partyForm, opening_balance: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isUrdu ? 'دکان یا دفتر کا پتہ' : 'Shop / Office Address'}
            </label>
            <input
              type="text"
              value={partyForm.address}
              onChange={(e) => setPartyForm({ ...partyForm, address: e.target.value })}
              placeholder={
                isUrdu
                  ? 'مثلاً دکان نمبر 44، ٹیکنو سٹی پلازہ، کراچی'
                  : 'e.g. Shop # 44, Techno City Plaza, Karachi'
              }
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          {!editingParty && (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-[11px] text-blue-900">
              {isUrdu
                ? '💡 نوٹ: اگر اس پارٹی کا پہلے سے کوئی پرانا بقایا یا ادھار رقم باقی ہے تو یہاں لکھیں۔ سافٹ ویئر خودکار طریقے سے اس کا ابتدائی کھاتہ بنا دے گا۔'
                : '💡 Note: If this party has an existing balance from before, enter it here. The system will automatically create the opening ledger entry.'}
            </div>
          )}

          <div className="flex items-center space-x-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsAddPartyOpen(false);
                setEditingParty(null);
              }}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold"
            >
              {isUrdu ? 'منسوخ' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={partySubmitting}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20"
            >
              {partySubmitting
                ? (isUrdu ? 'محفوظ ہو رہا ہے...' : 'Saving...')
                : editingParty
                ? (isUrdu ? '✓ تبدیلیاں محفوظ کریں' : '✓ Save Changes')
                : isUrdu
                ? activeTab === 'customers'
                  ? '✓ گاہک محفوظ کریں'
                  : '✓ سپلائر محفوظ کریں'
                : `Save & Register ${activeTab === 'customers' ? 'Customer' : 'Supplier'}`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
