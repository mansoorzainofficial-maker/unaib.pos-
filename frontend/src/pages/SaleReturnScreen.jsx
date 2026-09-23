import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import CustomerForm from '../components/CustomerForm';
import BarcodeScannerInput from '../components/BarcodeScannerInput';
import { getCachedProducts } from '../utils/indexedDB';
import {
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  Receipt,
  User,
  Package,
  Calendar,
  DollarSign,
  Printer,
  History,
  Plus,
  Trash2,
  RotateCw,
  UserPlus,
  X,
  Building2,
  Wallet
} from 'lucide-react';
import useSubmitGuard from '../hooks/useSubmitGuard';
import ActionButton from '../components/ActionButton';

export default function SaleReturnScreen() {
  const { isUrdu } = useLanguage();
  const [activeTab, setActiveTab] = useState('new'); // 'new' or 'history'
  
  // New Return State
  const [searchInvoice, setSearchInvoice] = useState('');
  const [searching, setSearching] = useState(false);
  const [matchedInvoice, setMatchedInvoice] = useState(null);
  const [candidateInvoices, setCandidateInvoices] = useState([]);
  
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  const [refundMode, setRefundMode] = useState('cash'); // 'cash' or 'khata_credit'
  const [reason, setReason] = useState('خراب پرزہ / ڈیفیکٹو (Defective item)');
  
  const [returnItems, setReturnItems] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  
  const [successModal, setSuccessModal] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  // History State
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadProductsAndCustomers();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const loadProductsAndCustomers = async () => {
    try {
      const [prodRes, custRes] = await Promise.all([
        api.products.getAll().catch(err => {
          console.warn('SaleReturn: Products load warning:', err);
          return { success: false, products: [] };
        }),
        api.invoices.getCustomers().catch(err => {
          console.warn('SaleReturn: Customers load warning:', err);
          return { success: false, customers: [] };
        })
      ]);

      let list = prodRes.products || prodRes.data || (Array.isArray(prodRes) ? prodRes : []);
      if (list.length === 0) {
        try {
          const cached = await getCachedProducts();
          if (cached && cached.length > 0) list = cached;
        } catch (_) {}
      }
      setProductsList(list);

      const custs = custRes.customers || custRes.data || (Array.isArray(custRes) ? custRes : []);
      setCustomersList(custs);
    } catch (e) {
      console.error('Failed to load products/customers:', e);
      try {
        const cached = await getCachedProducts();
        if (cached && cached.length > 0) setProductsList(cached);
      } catch (_) {}
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.returns.getSaleReturns();
      setHistoryList(res.returns || []);
    } catch (e) {
      console.error('Failed to load sale returns history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSelectInvoice = async (invoiceOrId) => {
    const id = typeof invoiceOrId === 'object' ? (invoiceOrId.id || invoiceOrId.invoice_number) : invoiceOrId;
    setSearching(true);
    setErrorMsg('');
    try {
      const res = await api.invoices.getDetails(id);
      const inv = res.invoice;
      if (inv) {
        setMatchedInvoice(inv);
        setCandidateInvoices([]);
        setCustomerId(inv.customer_id || '');
        setCustomerName(inv.customer_name || '');
        setCustomerPhone(inv.customer_phone || '');
        setCustomerSearchQuery(inv.customer_name || '');
        // Map items from invoice to return choices
        if (Array.isArray(inv.items)) {
          setReturnItems(
            inv.items.map(it => {
              const serial = (Array.isArray(it.serial_numbers) && it.serial_numbers.length > 0)
                ? (typeof it.serial_numbers[0] === 'object' ? it.serial_numbers[0].serial_number : it.serial_numbers[0])
                : null;
              return {
                product_id: it.product_id,
                name: it.product_name,
                max_qty: it.quantity,
                quantity: 1,
                unit_price: it.unit_price,
                serial_numbers: serial ? [serial] : []
              };
            })
          );
        }
      } else {
        setErrorMsg(isUrdu ? 'بل کی تفصیلات لوڈ نہ ہو سکیں۔' : 'Could not load invoice details.');
      }
    } catch (err) {
      console.error('Select invoice error:', err);
      setErrorMsg(isUrdu ? 'بل کی تفصیلات لوڈ کرنے میں غلطی ہوئی۔' : 'Error loading invoice details.');
    } finally {
      setSearching(false);
    }
  };

  const handleSearchInvoice = async (e) => {
    e.preventDefault();
    const query = searchInvoice.trim();
    if (!query) return;

    setSearching(true);
    setErrorMsg('');
    setCandidateInvoices([]);
    setMatchedInvoice(null);

    try {
      // 1. Search across invoices by invoice_number, customer_name, and phone
      const listRes = await api.invoices.getAll({ search: query, limit: 10 });
      const foundInvoices = listRes.invoices || [];

      if (foundInvoices.length === 1) {
        // Exactly one match - load it immediately!
        await handleSelectInvoice(foundInvoices[0].id);
      } else if (foundInvoices.length > 1) {
        // Multiple matches (e.g. party name with multiple bills) - let user pick!
        setCandidateInvoices(foundInvoices);
      } else {
        // Fallback: direct lookup by getDetails (in case of exact ID or number)
        try {
          const directRes = await api.invoices.getDetails(query);
          if (directRes && directRes.invoice) {
            await handleSelectInvoice(directRes.invoice.id);
            return;
          }
        } catch (_) {}

        setErrorMsg(
          isUrdu
            ? `بل نمبر یا پارٹی کے نام "${query}" کا کوئی بل نہیں ملا۔ آپ نیچے سے براہ راست سامان منتخب کر سکتے ہیں۔`
            : `No invoice found matching "${query}". You can pick products manually below.`
        );
      }
    } catch (err) {
      console.error('Invoice search error:', err);
      // Fallback to direct getDetails
      try {
        const directRes = await api.invoices.getDetails(query);
        if (directRes && directRes.invoice) {
          await handleSelectInvoice(directRes.invoice.id);
          return;
        }
      } catch (_) {}

      setErrorMsg(isUrdu ? 'بل تلاش کرنے میں غلطی ہوئی۔' : 'Error searching invoice.');
    } finally {
      setSearching(false);
    }
  };

  const handleClearMatchedInvoice = () => {
    setMatchedInvoice(null);
    setCandidateInvoices([]);
    setSearchInvoice('');
    setReturnItems([]);
    setCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerSearchQuery('');
  };

  const handleAddManualItem = (productId) => {
    const prod = productsList.find(p => String(p.id) === String(productId));
    if (!prod) return;
    
    // If already in return items, increment quantity
    const existingIndex = returnItems.findIndex(i => String(i.product_id) === String(prod.id));
    if (existingIndex !== -1) {
      const next = [...returnItems];
      next[existingIndex] = {
        ...next[existingIndex],
        quantity: Number(next[existingIndex].quantity || 0) + 1
      };
      setReturnItems(next);
      return;
    }

    setReturnItems([
      ...returnItems,
      {
        product_id: prod.id,
        name: prod.name,
        max_qty: 999,
        quantity: 1,
        unit_price: prod.sale_price,
        has_serials: prod.has_serials,
        serial_numbers: []
      }
    ]);
  };

  // Barcode scanner handler for Sale Return screen
  const handleScannerInput = async (barcode) => {
    const clean = (barcode || '').trim();
    if (!clean) return;

    setErrorMsg('');

    // 1. Check if it's an invoice barcode (starts with INV or UCA or contains hyphenated format)
    const isLikelyInvoice = clean.toUpperCase().startsWith('INV') || clean.toUpperCase().startsWith('UCA') || clean.length > 10;
    if (isLikelyInvoice) {
      setSearchInvoice(clean);
      await handleSelectInvoice(clean);
      return;
    }

    // 2. Check if it matches a product barcode
    const matchedProd = productsList.find(p => p.barcode && p.barcode.toLowerCase() === clean.toLowerCase());
    if (matchedProd) {
      handleAddManualItem(matchedProd.id);
      return;
    }

    // 3. Fallback: try looking up invoice directly by the scanned value
    setSearchInvoice(clean);
    await handleSelectInvoice(clean);
  };

  const handleUpdateItem = (index, field, value) => {
    const updated = [...returnItems];
    updated[index][field] = value;
    setReturnItems(updated);
  };

  const handleRemoveItem = (index) => {
    setReturnItems(returnItems.filter((_, idx) => idx !== index));
  };

  const handleSelectCustomer = (cust) => {
    if (!cust) {
      setCustomerId('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerSearchQuery('');
    } else {
      setCustomerId(cust.id);
      setCustomerName(cust.name);
      setCustomerPhone(cust.phone || '');
      setCustomerSearchQuery(cust.name);
    }
    setIsCustomerDropdownOpen(false);
  };

  const handleCustomerCreated = (newCust) => {
    if (!newCust) return;
    setCustomersList(prev => [newCust, ...prev.filter(c => c.id !== newCust.id)]);
    handleSelectCustomer(newCust);
    setIsCustomerModalOpen(false);
  };

  const calculateTotalRefund = () => {
    return returnItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);
  };

  const [handleSubmitReturn, submitting] = useSubmitGuard(async () => {
    if (returnItems.length === 0) {
      setErrorMsg(isUrdu ? 'براہ کرم واپسی کے لیے کم از کم ایک چیز منتخب کریں۔' : 'Please select at least one item to return.');
      return;
    }

    // STRICT CHECK: Khata credit must have a registered customer
    if (refundMode === 'khata_credit' && !customerId) {
      setErrorMsg(
        isUrdu
          ? '⚠️ کھاتے میں جمع (Khata Credit) کرنے کے لیے ضروری ہے کہ آپ لسٹ سے گاہک منتخب کریں یا "+ نیا کسٹمر" بٹن سے نیا گاہک بنائیں۔'
          : 'Khata Credit requires selecting a registered customer. Please search and select from the list, or add a new customer.'
      );
      return;
    }

    setErrorMsg('');

    try {
      const payload = {
        invoice_id: matchedInvoice ? matchedInvoice.id : null,
        invoice_number: matchedInvoice ? matchedInvoice.invoice_number : (searchInvoice || null),
        customer_id: customerId || null,
        customer_name: customerName.trim() || 'عام واک ان گاہک',
        customer_phone: customerPhone.trim() || null,
        refund_mode: refundMode,
        reason: reason,
        items: returnItems.map(it => ({
          product_id: it.product_id,
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          serial_numbers: it.serial_numbers || []
        }))
      };

      const res = await api.returns.createSaleReturn(payload);
      if (res.success) {
        setSuccessModal({
          returnNumber: res.data.returnNumber,
          totalRefund: res.data.totalRefund,
          customerName: customerName || 'عام واک ان گاہک',
          items: returnItems,
          refundMode: refundMode,
          reason: reason,
          date: new Date().toLocaleString()
        });

        // Reset form
        setReturnItems([]);
        setMatchedInvoice(null);
        setSearchInvoice('');
        setCustomerName('');
        setCustomerPhone('');
        setCustomerId('');
        setCustomerSearchQuery('');
        setIsCustomerDropdownOpen(false);

        // Preload history so it's ready immediately
        loadHistory();
      } else {
        setErrorMsg(res.message || 'Error creating sale return');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Sale return failed');
    }
  }, { cooldownMs: 1200 });

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden text-slate-800">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>{isUrdu ? 'سیل واپسی (Sale Return)' : 'Sale Return'}</span>
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full uppercase">
                {isUrdu ? 'گاہک سے مال واپسی' : 'Customer Return'}
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {isUrdu ? 'گاہک سے خریدا ہوا مال واپس لیں، اسٹاک بڑھائیں اور رقم یا کھاتہ ایڈجسٹ کریں۔' : 'Return sold items, restore stock and adjust cash or customer khata.'}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'new'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isUrdu ? '🔄 نئی واپسی بنائیں' : 'Create Return'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{isUrdu ? 'گزشتہ واپسی ریکارڈ' : 'Returns History'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'new' ? (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Search Existing Invoice by Barcode / Number or Party */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h2 className="text-xs font-black uppercase text-slate-500 tracking-wider">
              {isUrdu ? '۱۔ بارکوڈ اسکین کریں یا بل نمبر / پارٹی نام سے تلاش کریں:' : '1. Scan Barcode or Search by Bill No / Customer Name:'}
            </h2>

            {/* Quick Barcode Scanner Bar */}
            <div className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-200">
              <BarcodeScannerInput
                onScan={handleScannerInput}
                placeholder={isUrdu ? "بارکوڈ اسکین کریں (رسید بل بارکوڈ یا سامان کا بارکوڈ)..." : "Scan invoice barcode or product barcode to auto-load..."}
                theme="amber"
                autoFocus={false}
              />
            </div>

            <form onSubmit={handleSearchInvoice} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder={isUrdu ? 'بل نمبر (مثلاً: UCA-20260920-0001 یا 0001) یا گاہک کا نام یا فون درج کریں...' : 'Enter Invoice No (e.g. UCA-20260920-0001 or 0001), Customer Name, or Phone...'}
                  value={searchInvoice}
                  onChange={(e) => setSearchInvoice(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-amber-500 focus:outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shrink-0 shadow-xs"
              >
                {searching ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>{isUrdu ? 'بل تلاش کریں' : 'Find Bill'}</span>
                  </>
                )}
              </button>
            </form>

            {/* Candidate Invoices List (when multiple matches found, e.g. Party Name) */}
            {candidateInvoices && candidateInvoices.length > 1 && (
              <div className="mt-4 p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                  <span>{isUrdu ? `اس نام/نمبر سے ${candidateInvoices.length} بل ملے، واپسی کے لیے مطلوبہ بل منتخب کریں:` : `Found ${candidateInvoices.length} matching invoices. Pick one to return:`}</span>
                  <button
                    type="button"
                    onClick={() => setCandidateInvoices([])}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {candidateInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() => handleSelectInvoice(inv.id)}
                      className="p-3 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-400 rounded-xl cursor-pointer transition-all shadow-2xs group flex flex-col justify-between space-y-2"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-blue-700 text-xs">{inv.invoice_number}</span>
                          <span className="font-mono font-bold text-slate-900 text-xs">Rs. {Number(inv.grand_total).toLocaleString()}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-800 mt-1 truncate">{inv.customer_name || (isUrdu ? 'عام واک ان گاہک' : 'Walk-in')}</div>
                        {inv.customer_phone && <div className="text-[11px] text-slate-400 font-mono">{inv.customer_phone}</div>}
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {inv.created_at ? new Date(inv.created_at).toLocaleDateString('en-PK') : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="w-full py-1.5 bg-amber-500 group-hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        {isUrdu ? 'یہ بل منتخب کریں ✓' : 'Select Invoice ✓'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Matched Invoice Banner */}
            {matchedInvoice && (
              <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-emerald-950 text-sm">{matchedInvoice.invoice_number}</span>
                      <span className="text-emerald-700 font-bold">• {matchedInvoice.customer_name || (isUrdu ? 'عام واک ان گاہک' : 'Walk-in')}</span>
                      {matchedInvoice.customer_phone && <span className="text-[11px] text-emerald-600 font-mono">({matchedInvoice.customer_phone})</span>}
                    </div>
                    <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                      {isUrdu ? 'کل رقم: ' : 'Total: '}
                      <strong className="font-mono">Rs. {Number(matchedInvoice.grand_total).toLocaleString()}</strong>
                      {matchedInvoice.items ? ` • ${matchedInvoice.items.length} ${isUrdu ? 'آئٹمز شامل کر دیے گئے' : 'items loaded'}` : ''}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearMatchedInvoice}
                  className="px-3 py-1.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{isUrdu ? 'بل تبدیل کریں' : 'Change Bill'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Customer & Refund Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 relative">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>{isUrdu ? 'گاہک کی تفصیل (Customer):' : 'Customer Details:'}</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>{isUrdu ? '+ نیا کسٹمر' : '+ New Customer'}</span>
                </button>
              </div>

              {customerId ? (
                /* Selected Customer Card */
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 relative">
                  <button
                    type="button"
                    onClick={() => handleSelectCustomer(null)}
                    className="absolute top-2 left-2 p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white/80 transition-colors cursor-pointer"
                    title={isUrdu ? 'تبدیل کریں' : 'Change customer'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {customerName ? customerName.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div className="min-w-0 pr-6">
                      <div className="font-bold text-xs text-slate-900 truncate">{customerName}</div>
                      <div className="text-[11px] text-slate-500">{customerPhone || (isUrdu ? 'کوئی فون درج نہیں' : 'No Phone')}</div>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-emerald-100 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <Wallet className="w-3 h-3" />
                      {isUrdu ? 'موجودہ ادھار/بیلنس:' : 'Current Balance:'}
                    </span>
                    <span className="font-bold text-emerald-900">
                      Rs. {Number(customersList.find(c => c.id === customerId)?.current_balance ?? 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                /* Search & Select Input */
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={isUrdu ? 'کسٹمر کا نام یا فون تلاش کریں...' : 'Search customer by name or phone...'}
                      value={customerSearchQuery}
                      onChange={(e) => {
                        setCustomerSearchQuery(e.target.value);
                        setCustomerName(e.target.value);
                        setIsCustomerDropdownOpen(true);
                      }}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-amber-500 focus:outline-none"
                    />

                    {/* Autocomplete Dropdown */}
                    {isCustomerDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto">
                        <div className="p-1.5 border-b border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-semibold px-2">
                          <span>{isUrdu ? 'رجسٹرڈ کسٹمرز' : 'Registered Customers'}</span>
                          <button
                            type="button"
                            onClick={() => setIsCustomerDropdownOpen(false)}
                            className="hover:text-slate-600 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                        {customersList
                          .filter(c => 
                            !customerSearchQuery.trim() ||
                            (c.name && c.name.toLowerCase().includes(customerSearchQuery.toLowerCase())) ||
                            (c.phone && c.phone.includes(customerSearchQuery))
                          )
                          .slice(0, 10)
                          .map(cust => (
                            <div
                              key={cust.id}
                              onClick={() => handleSelectCustomer(cust)}
                              className="p-2.5 hover:bg-amber-50 cursor-pointer border-b border-slate-50 last:border-0 flex items-center justify-between transition-colors"
                            >
                              <div>
                                <div className="font-bold text-xs text-slate-800">{cust.name}</div>
                                <div className="text-[10px] text-slate-400">{cust.phone || (isUrdu ? 'فون درج نہیں' : 'No Phone')}</div>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 block">{isUrdu ? 'کھاتہ' : 'Khata'}</span>
                                <span className={`text-xs font-bold ${Number(cust.current_balance) > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                                  Rs. {Number(cust.current_balance || 0).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        {customersList.filter(c => 
                            !customerSearchQuery.trim() ||
                            (c.name && c.name.toLowerCase().includes(customerSearchQuery.toLowerCase())) ||
                            (c.phone && c.phone.includes(customerSearchQuery))
                          ).length === 0 && (
                          <div className="p-3 text-center text-xs text-slate-400">
                            {isUrdu ? 'کوئی کسٹمر نہیں ملا' : 'No customer found'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder={isUrdu ? 'فون نمبر (اختیاری)...' : 'Phone number (optional)...'}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-amber-500 focus:outline-none"
                  />

                  {refundMode === 'khata_credit' && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 flex items-start gap-1.5 font-medium leading-relaxed">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span>
                        {isUrdu 
                          ? '⚠️ کھاتے میں ریفنڈ کے لیے ضروری ہے کہ آپ اوپر لسٹ سے رجسٹرڈ گاہک منتخب کریں یا "+ نیا کسٹمر" بٹن دبائیں۔' 
                          : '⚠️ Khata Credit requires selecting a registered customer from the list.'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isUrdu ? 'رقم کی واپسی کا طریقہ:' : 'Refund Payment Mode:'}</span>
              </label>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRefundMode('cash')}
                  className={`p-3 rounded-xl border text-xs font-bold cursor-pointer text-center transition-all ${
                    refundMode === 'cash'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  💵 {isUrdu ? 'نقد رقم واپسی' : 'Cash Refund'}
                  <div className="text-[10px] font-normal text-slate-400 mt-0.5">گلے سے رقم واپس دی</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRefundMode('khata_credit')}
                  className={`p-3 rounded-xl border text-xs font-bold cursor-pointer text-center transition-all ${
                    refundMode === 'khata_credit'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  📒 {isUrdu ? 'کھاتے میں جمع' : 'Khata Credit'}
                  <div className="text-[10px] font-normal text-slate-400 mt-0.5">ادھار سے رقم کاٹی</div>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <label className="text-xs font-bold text-slate-700">
                {isUrdu ? 'واپسی کی وجہ:' : 'Return Reason:'}
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-amber-500 focus:outline-none"
              >
                <option value="خراب پرزہ / ڈیفیکٹو (Defective item)">خراب پرزہ / ڈیفیکٹو (Defective item)</option>
                <option value="گاہک نے غلط سامان خریدا تھا">گاہک نے غلط سامان خریدا تھا (Wrong Item)</option>
                <option value="وارنٹی کلیم واپسی (Warranty Return)">وارنٹی کلیم واپسی (Warranty Return)</option>
                <option value="پیکنگ کھلی ہوئی / ناپسندیدہ">پیکنگ کھلی ہوئی / ناپسندیدہ</option>
                <option value="دیگر وجہ">دیگر وجہ (Other Reason)</option>
              </select>
            </div>
          </div>

          {/* Section 3: Items to Return */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500" />
                <span>{isUrdu ? 'واپس کی جانے والی اشیاء (Items to Return):' : 'Items to Return:'}</span>
              </h2>

              {/* Manual add dropdown */}
              <div className="flex items-center gap-2">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddManualItem(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none cursor-pointer"
                >
                  <option value="">+ {isUrdu ? 'پراڈکٹ لسٹ سے چیز شامل کریں...' : 'Add Item from Catalog...'}</option>
                  {productsList.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Rs. {p.sale_price})</option>
                  ))}
                </select>
              </div>
            </div>

            {returnItems.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                {isUrdu ? 'اوپر بل نمبر تلاش کریں یا دائیں طرف سے پراڈکٹ شامل کریں۔' : 'Search an invoice above or add products from catalog.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-2.5">{isUrdu ? 'پراڈکٹ کا نام' : 'Product Name'}</th>
                      <th className="py-2.5 w-24">{isUrdu ? 'تعداد' : 'Qty'}</th>
                      <th className="py-2.5 w-32">{isUrdu ? 'واپسی قیمت' : 'Refund Price'}</th>
                      <th className="py-2.5 w-32">{isUrdu ? 'کل رقم' : 'Total'}</th>
                      <th className="py-2.5 w-44">{isUrdu ? 'سیریل نمبر (اگر ہو)' : 'Serial No.'}</th>
                      <th className="py-2.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {returnItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-3 font-bold text-slate-800">{item.name}</td>
                        <td className="py-3">
                          <input
                            type="number"
                            min="1"
                            max={item.max_qty || 999}
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                            className="w-20 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center"
                          />
                        </td>
                        <td className="py-3">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => handleUpdateItem(idx, 'unit_price', e.target.value)}
                            className="w-28 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right"
                          />
                        </td>
                        <td className="py-3 font-black text-emerald-700">
                          Rs. {(Number(item.quantity || 0) * Number(item.unit_price || 0)).toLocaleString()}
                        </td>
                        <td className="py-3">
                          <input
                            type="text"
                            placeholder="SN-12345..."
                            value={item.serial_numbers ? item.serial_numbers.join(', ') : ''}
                            onChange={(e) => handleUpdateItem(idx, 'serial_numbers', e.target.value.split(',').map(s => s.trim()))}
                            className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-slate-300 hover:text-rose-600 transition-all cursor-pointer p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Total Footer & Confirm Button */}
            {returnItems.length > 0 && (
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500">{isUrdu ? 'کل واپسی رقم:' : 'Total Refund Amount:'}</span>
                  <span className="text-xl font-black text-emerald-600">
                    Rs. {calculateTotalRefund().toLocaleString()}
                  </span>
                </div>

                <ActionButton
                  type="button"
                  loading={submitting}
                  loadingText={isUrdu ? 'واپسی پروسیس ہو رہی ہے...' : 'Processing Return...'}
                  onClick={handleSubmitReturn}
                  icon={RotateCcw}
                  className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-sm shadow-amber-500/20"
                >
                  {isUrdu ? 'سیل واپسی مکمل کریں (Confirm Return)' : 'Confirm Return'}
                </ActionButton>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* History Tab */
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-slate-800">
                  {isUrdu ? 'گزشتہ سیل واپسی ریکارڈ (Recent Sale Returns)' : 'Recent Sale Returns'}
                </h2>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                  {historyList.length} {isUrdu ? 'ریکارڈز' : 'Returns'}
                </span>
              </div>
              <button
                type="button"
                onClick={loadHistory}
                disabled={loadingHistory}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title={isUrdu ? 'فہرست تازہ کریں' : 'Refresh List'}
              >
                <RotateCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                <span>{isUrdu ? 'ریفریش' : 'Refresh'}</span>
              </button>
            </div>

            {loadingHistory ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Loading Returns History...
              </div>
            ) : historyList.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                {isUrdu ? 'ابھی تک کوئی سیل واپسی ریکارڈ نہیں ہے۔' : 'No sale returns recorded yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 uppercase font-bold">
                    <tr>
                      <th className="px-4 py-3">Return No.</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Invoice No.</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3 text-right">Refund Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyList.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-amber-700">{r.return_number}</td>
                        <td className="px-4 py-3 text-slate-500">{new Date(r.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{r.customer_name || 'Walk-in'}</td>
                        <td className="px-4 py-3 text-slate-500">{r.invoice_number || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.refund_mode === 'cash' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {r.refund_mode === 'cash' ? 'Cash Refund' : 'Khata Credit'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{r.reason || '-'}</td>
                        <td className="px-4 py-3 font-black text-right text-emerald-600">
                          Rs. {Number(r.total_refund_amount).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success Receipt Modal */}
      {successModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">
                {isUrdu ? 'سیل واپسی درج ہو گئی!' : 'Return Processed!'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isUrdu ? 'اسٹاک بحال کر دیا گیا ہے اور رقم ایڈجسٹ ہو گئی ہے۔' : 'Stock restored & accounts updated successfully.'}
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Return Slip:</span>
                <span className="font-bold text-slate-900">{successModal.returnNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="font-bold text-slate-800">{successModal.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mode:</span>
                <span className="font-bold text-emerald-700">{successModal.refundMode === 'cash' ? 'Cash Refunded' : 'Khata Credited'}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-900 font-bold">Total Refund:</span>
                <span className="font-black text-emerald-600">Rs. {successModal.totalRefund.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isUrdu ? 'پرنٹ رسید' : 'Print Slip'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSuccessModal(null);
                    setActiveTab('history');
                    loadHistory();
                  }}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isUrdu ? 'ہسٹری میں دیکھیں' : 'View in History'}</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSuccessModal(null);
                  setActiveTab('history');
                  loadHistory();
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                {isUrdu ? 'مکمل کریں اور بند کریں' : 'Done & Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Quick Add Modal */}
      {isCustomerModalOpen && (
        <CustomerForm
          isOpen={isCustomerModalOpen}
          onClose={() => setIsCustomerModalOpen(false)}
          onSuccess={handleCustomerCreated}
        />
      )}
    </div>
  );
}
