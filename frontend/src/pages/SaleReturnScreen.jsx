import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
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
  RotateCw
} from 'lucide-react';

export default function SaleReturnScreen() {
  const { isUrdu } = useLanguage();
  const [activeTab, setActiveTab] = useState('new'); // 'new' or 'history'
  
  // New Return State
  const [searchInvoice, setSearchInvoice] = useState('');
  const [searching, setSearching] = useState(false);
  const [matchedInvoice, setMatchedInvoice] = useState(null);
  
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [refundMode, setRefundMode] = useState('cash'); // 'cash' or 'khata_credit'
  const [reason, setReason] = useState('خراب پرزہ / ڈیفیکٹو (Defective item)');
  
  const [returnItems, setReturnItems] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  
  const [submitting, setSubmitting] = useState(false);
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
      const prodRes = await api.products.getAll();
      const list = prodRes.products || prodRes.data || [];
      setProductsList(list);

      const custRes = await api.invoices.getCustomers();
      setCustomersList(custRes.customers || custRes.data || []);
    } catch (e) {
      console.error('Failed to load products/customers:', e);
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

  const handleSearchInvoice = async (e) => {
    e.preventDefault();
    if (!searchInvoice.trim()) return;
    setSearching(true);
    setErrorMsg('');
    try {
      const res = await api.invoices.getById(searchInvoice.trim());
      const inv = res.invoice;
      if (inv) {
        setMatchedInvoice(inv);
        setCustomerId(inv.customer_id || '');
        setCustomerName(inv.customer_name || '');
        setCustomerPhone(inv.customer_phone || '');
        // Map items from invoice to return choices
        if (Array.isArray(inv.items)) {
          setReturnItems(
            inv.items.map(it => ({
              product_id: it.product_id,
              name: it.product_name,
              max_qty: it.quantity,
              quantity: 1,
              unit_price: it.unit_price,
              serial_numbers: (it.serial_numbers && it.serial_numbers.length > 0) ? [it.serial_numbers[0]] : []
            }))
          );
        }
      } else {
        setErrorMsg(isUrdu ? 'بل نمبر نہیں ملا۔ آپ نیچے سے براہ راست سامان منتخب کر سکتے ہیں۔' : 'Invoice not found. You can pick products manually.');
      }
    } catch (err) {
      setErrorMsg(isUrdu ? 'بل تلاش کرنے میں غلطی ہوئی۔' : 'Error searching invoice.');
    } finally {
      setSearching(false);
    }
  };

  const handleAddManualItem = (productId) => {
    const prod = productsList.find(p => p.id === Number(productId));
    if (!prod) return;
    
    // Check if already in list
    if (returnItems.some(i => i.product_id === prod.id)) {
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

  const handleUpdateItem = (index, field, value) => {
    const updated = [...returnItems];
    updated[index][field] = value;
    setReturnItems(updated);
  };

  const handleRemoveItem = (index) => {
    setReturnItems(returnItems.filter((_, idx) => idx !== index));
  };

  const calculateTotalRefund = () => {
    return returnItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);
  };

  const handleSubmitReturn = async () => {
    if (returnItems.length === 0) {
      setErrorMsg(isUrdu ? 'براہ کرم واپسی کے لیے کم از کم ایک چیز منتخب کریں۔' : 'Please select at least one item to return.');
      return;
    }

    setSubmitting(true);
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

        // Preload history so it's ready immediately
        loadHistory();
      } else {
        setErrorMsg(res.message || 'Error creating sale return');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Sale return failed');
    } finally {
      setSubmitting(false);
    }
  };

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

          {/* Section 1: Search Existing Invoice */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">
              {isUrdu ? '۱۔ بل نمبر تلاش کریں (اختیاری):' : '1. Search Invoice (Optional):'}
            </h2>
            <form onSubmit={handleSearchInvoice} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder={isUrdu ? 'بل نمبر درج کریں (مثلاً: UCA-20260915-0001)...' : 'Enter Invoice No (e.g. UCA-20260915-0001)...'}
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

            {matchedInvoice && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    <strong>{matchedInvoice.invoice_number}</strong> ({matchedInvoice.customer_name || 'Walk-in'}) - Total: Rs. {Number(matchedInvoice.grand_total).toLocaleString()}
                  </span>
                </div>
                <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  {matchedInvoice.items ? `${matchedInvoice.items.length} items loaded` : 'Loaded'}
                </span>
              </div>
            )}
          </div>

          {/* Section 2: Customer & Refund Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>{isUrdu ? 'گاہک کا نام / فون:' : 'Customer Name / Phone:'}</span>
              </label>
              <input
                type="text"
                placeholder={isUrdu ? 'کسٹمر کا نام لکھیں...' : 'Customer name...'}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-amber-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder={isUrdu ? 'فون نمبر (اختیاری)...' : 'Phone number...'}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-amber-500 focus:outline-none"
              />
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

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmitReturn}
                  className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-sm shadow-amber-500/20 transition-all"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>{isUrdu ? 'سیل واپسی مکمل کریں (Confirm Return)' : 'Confirm Return'}</span>
                    </>
                  )}
                </button>
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
    </div>
  );
}
