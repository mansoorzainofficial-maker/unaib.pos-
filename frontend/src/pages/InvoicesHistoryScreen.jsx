import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import ThermalReceipt from '../components/ThermalReceipt';
import Modal from '../components/Modal';
import { Receipt, Search, Printer, Calendar, User, Eye, Ban, AlertTriangle, CheckCircle, RefreshCw, Trash2, Edit3, Plus, Minus, Save, ShoppingBag, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function InvoicesHistoryScreen() {
  const { isUrdu } = useLanguage();
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' (default - hides voided bills), 'voided', 'all'
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  // Void Bill state
  const [invoiceToVoid, setInvoiceToVoid] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Edit Invoice state
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [editDiscountType, setEditDiscountType] = useState('amount');
  const [editDiscountValue, setEditDiscountValue] = useState(0);
  const [editTaxRate, setEditTaxRate] = useState(0);
  const [editShippingCost, setEditShippingCost] = useState(0);
  const [editShippingNotes, setEditShippingNotes] = useState('');
  const [editExtraCharges, setEditExtraCharges] = useState(0);
  const [editPaymentMethod, setEditPaymentMethod] = useState('cash');
  const [editPaidAmount, setEditPaidAmount] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);

  // Product quick-search inside Edit Modal
  const [allProducts, setAllProducts] = useState([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');

  const formatCustName = (name) => {
    if (!name) return isUrdu ? 'عام واک ان گاہک' : 'Walk-in Customer';
    if (!isUrdu) return name;
    const lower = String(name).trim().toLowerCase();
    if (lower === 'walk-in customer' || lower === 'walk-in' || lower === 'walk in') {
      return 'عام واک ان گاہک';
    }
    if (lower.startsWith('walk-in udhar')) {
      return name.replace(/walk-in udhar/i, 'واک ان ادھار گاہک');
    }
    if (lower === 'valued customer') {
      return 'محترم گاہک';
    }
    return name;
  };

  useEffect(() => {
    loadInvoices();
  }, [search, startDate, endDate]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const res = await api.invoices.getAll({
        search: search || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined
      });
      if (res.success) setInvoices(res.invoices);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReceipt = async (invoiceNumber) => {
    try {
      const res = await api.invoices.getDetails(invoiceNumber);
      if (res.success && res.invoice) {
        setSelectedInvoice(res.invoice);
      }
    } catch (err) {
      alert(isUrdu ? 'بل کی تفصیلات لوڈ نہ ہو سکیں' : 'Could not load invoice details');
    }
  };

  const handleConfirmVoid = async (e) => {
    e.preventDefault();
    if (!invoiceToVoid) return;

    setIsVoiding(true);
    try {
      const trimmedReason = voidReason.trim() || (isUrdu ? 'گاہک نے مال واپس کیا / کیشئر منسوخی' : 'Customer returned items / Voided by cashier');
      const res = await api.invoices.void(invoiceToVoid.id, {
        void_reason: trimmedReason,
        reason: trimmedReason
      });

      if (res.success) {
        setFeedbackMsg({
          type: 'success',
          text: isUrdu
            ? `بل نمبر #${invoiceToVoid.invoice_number} کامیابی سے منسوخ ہو کر اسکرین سے ہٹا دیا گیا۔ اسٹاک اور کھاتہ بحال!`
            : `Invoice #${invoiceToVoid.invoice_number} voided and removed from screen. Stock & Khata restored.`
        });
        setInvoiceToVoid(null);
        setVoidReason('');
        loadInvoices(); // Refresh list
        setTimeout(() => setFeedbackMsg(null), 4000);
      }
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || (isUrdu ? 'بل منسوخ کرنے میں خرابی ہوئی' : 'Failed to void invoice')
      });
    } finally {
      setIsVoiding(false);
    }
  };

  const handleDeletePermanent = async (inv) => {
    const confirmPrompt = isUrdu
      ? `کیا آپ واقعی بل نمبر #${inv.invoice_number} کو مستقل طور پر سسٹم سے ڈیلیٹ کرنا چاہتے ہیں؟ (اسٹاک اور کھاتہ خودکار بحال ہوگا)`
      : `Are you sure you want to permanently delete invoice #${inv.invoice_number}? (Stock and khata will be restored)`;

    if (!window.confirm(confirmPrompt)) return;

    try {
      const res = await api.invoices.delete(inv.id);
      if (res.success) {
        setFeedbackMsg({
          type: 'success',
          text: isUrdu
            ? `بل نمبر #${inv.invoice_number} کامیابی سے مستقل ڈیلیٹ ہو گیا۔`
            : `Invoice #${inv.invoice_number} permanently deleted.`
        });
        loadInvoices();
        setTimeout(() => setFeedbackMsg(null), 4000);
      }
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || (isUrdu ? 'بل ڈیلیٹ کرنے میں خرابی ہوئی' : 'Failed to delete invoice')
      });
    }
  };

  // Open Edit Modal and load full invoice items
  const handleOpenEditModal = async (inv) => {
    try {
      setLoading(true);
      const res = await api.invoices.getDetails(inv.invoice_number || inv.id);
      if (!res.success || !res.invoice) {
        alert(isUrdu ? 'بل کی تفصیلات لوڈ نہ ہو سکیں' : 'Could not load invoice details');
        return;
      }
      const full = res.invoice;
      setEditingInvoice(full);
      setEditItems((full.items || []).map(it => ({
        product_id: it.product_id,
        product_name: it.product_name,
        barcode: it.barcode || '',
        unit_price: Number(it.unit_price) || 0,
        quantity: Number(it.quantity) || 1,
        cost_price: Number(it.cost_price) || 0,
        warranty_months: Number(it.warranty_months) || 0,
        serial_numbers: it.serial_numbers || []
      })));
      setEditDiscountType(full.discount_type || 'amount');
      setEditDiscountValue(Number(full.discount_value) || 0);
      setEditTaxRate(Number(full.tax_rate) || 0);
      setEditShippingCost(Number(full.shipping_cost) || 0);
      setEditShippingNotes(full.shipping_notes || '');
      setEditExtraCharges(Number(full.extra_charges) || 0);
      setEditPaymentMethod(full.payment_method || 'cash');
      setEditPaidAmount(Number(full.paid_amount) || 0);
      setEditNotes(full.notes || '');
      setEditError(null);
      setProductSearchQuery('');

      // Preload product catalog for quick-add if not loaded
      if (allProducts.length === 0) {
        try {
          const pRes = await api.products.getAll({ limit: 500 });
          if (pRes && pRes.products) setAllProducts(pRes.products);
        } catch (e) {
          console.warn('Could not preload products for edit', e);
        }
      }
    } catch (err) {
      console.error(err);
      alert(isUrdu ? 'بل میں ترمیم کے لیے ڈیٹا لوڈ نہ ہو سکا' : 'Failed to load invoice for editing');
    } finally {
      setLoading(false);
    }
  };

  const handleItemQtyChange = (index, deltaOrVal) => {
    setEditItems(prev => {
      const updated = [...prev];
      let newQty;
      if (typeof deltaOrVal === 'number' && (deltaOrVal === 1 || deltaOrVal === -1)) {
        newQty = (Number(updated[index].quantity) || 1) + deltaOrVal;
      } else {
        newQty = Number(deltaOrVal);
      }
      if (isNaN(newQty) || newQty < 1) newQty = 1;
      updated[index] = { ...updated[index], quantity: newQty };
      return updated;
    });
  };

  const handleItemPriceChange = (index, newPrice) => {
    setEditItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], unit_price: Math.max(0, Number(newPrice) || 0) };
      return updated;
    });
  };

  const handleRemoveItem = (index) => {
    setEditItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddProductToInvoice = (prod) => {
    setEditItems(prev => {
      const idx = prev.findIndex(it => Number(it.product_id) === Number(prod.id));
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: (Number(updated[idx].quantity) || 1) + 1 };
        return updated;
      } else {
        return [...prev, {
          product_id: prod.id,
          product_name: prod.name,
          barcode: prod.barcode || '',
          unit_price: Number(prod.sale_price) || 0,
          quantity: 1,
          cost_price: Number(prod.cost_price) || 0,
          warranty_months: Number(prod.warranty_months) || 0,
          serial_numbers: []
        }];
      }
    });
    setProductSearchQuery('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingInvoice) return;
    if (editItems.length === 0) {
      setEditError(isUrdu ? 'بل میں کم از کم ایک پروڈکٹ ہونا ضروری ہے' : 'Invoice must have at least one product');
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);

    try {
      const payload = {
        customer_id: editingInvoice.customer_id,
        customer_name: editingInvoice.customer_name,
        customer_phone: editingInvoice.customer_phone,
        items: editItems.map(it => ({
          product_id: it.product_id,
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          cost_price: it.cost_price,
          warranty_months: it.warranty_months,
          serial_numbers: it.serial_numbers || []
        })),
        discount_type: editDiscountType,
        discount_value: editDiscountValue,
        tax_rate: editTaxRate,
        shipping_cost: editShippingCost,
        shipping_notes: editShippingNotes,
        extra_charges: editExtraCharges,
        payment_method: editPaymentMethod,
        paid_amount: editPaidAmount,
        notes: editNotes,
        show_previous_balance: editingInvoice.show_previous_balance
      };

      const res = await api.invoices.update(editingInvoice.id, payload);
      if (res.success) {
        setFeedbackMsg({
          type: 'success',
          text: isUrdu
            ? `بل نمبر #${editingInvoice.invoice_number} میں ترمیم کامیابی سے محفوظ ہو گئی۔ اسٹاک اور کھاتہ خودکار ایڈجسٹ ہو گئے!`
            : `Invoice #${editingInvoice.invoice_number} updated successfully. Stock & Khata rebalanced!`
        });
        setEditingInvoice(null);
        loadInvoices();
        setTimeout(() => setFeedbackMsg(null), 5000);
      } else {
        setEditError(res.message || (isUrdu ? 'ترمیم محفوظ کرنے میں خرابی ہوئی' : 'Failed to update invoice'));
      }
    } catch (err) {
      setEditError(err.message || (isUrdu ? 'ترمیم محفوظ کرنے میں خرابی ہوئی' : 'Failed to update invoice'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Live totals inside Edit Invoice Modal
  const editSubtotal = editItems.reduce((acc, it) => acc + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1), 0);
  let editDiscountAmount = 0;
  if (editDiscountType === 'percentage') {
    editDiscountAmount = (editSubtotal * (Number(editDiscountValue) || 0)) / 100;
  } else {
    editDiscountAmount = Number(editDiscountValue) || 0;
  }
  editDiscountAmount = Math.min(editDiscountAmount, editSubtotal);
  const editTaxable = editSubtotal - editDiscountAmount;
  const editTaxAmount = (editTaxable * (Number(editTaxRate) || 0)) / 100;
  const editGrandTotal = Math.round((editTaxable + editTaxAmount + (Number(editShippingCost) || 0) + (Number(editExtraCharges) || 0)) * 100) / 100;
  const editBalanceDue = Math.max(0, Math.round((editGrandTotal - (Number(editPaidAmount) || 0)) * 100) / 100);

  const filteredProducts = productSearchQuery.trim()
    ? allProducts.filter(p =>
        (p.name && p.name.toLowerCase().includes(productSearchQuery.toLowerCase())) ||
        (p.barcode && p.barcode.toLowerCase().includes(productSearchQuery.toLowerCase()))
      ).slice(0, 8)
    : [];

  // Check whether invoice is voided or cancelled
  const isInvoiceVoid = (inv) => inv?.status === 'void' || inv?.status === 'cancelled' || !!inv?.voided_at;

  // Counts
  const activeCount = invoices.filter(i => !isInvoiceVoid(i)).length;
  const voidCount = invoices.filter(i => isInvoiceVoid(i)).length;

  // Filtered list: strictly remove voided invoices when on active tab (default)
  const displayedInvoices = invoices.filter(inv => {
    const isVoid = isInvoiceVoid(inv);
    if (statusFilter === 'active') return !isVoid;
    if (statusFilter === 'voided') return isVoid;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-slate-100 text-slate-800 p-4 space-y-4 select-text">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            {isUrdu ? 'فروخت کے بل و رسیدوں کا ریکارڈ' : 'Bills & Invoices Record'}
          </h2>
          <p className="text-xs text-slate-500">
            {isUrdu
              ? 'تمام درست بلوں کی ہسٹری، رسید دوبارہ پرنٹ کرنا اور غلط بل منسوخ کر کے اسکرین سے ہٹانا'
              : 'Historical invoices, thermal receipt reprint, and void invoice management'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Tabs: Active vs Voided */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isUrdu ? `✓ درست و فعال بل (${activeCount})` : `Active Bills (${activeCount})`}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('voided')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'voided'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isUrdu ? `🗑️ منسوخ شدہ بل (${voidCount})` : `Voided (${voidCount})`}
            </button>
          </div>

          <button
            type="button"
            onClick={() => loadInvoices()}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
            title={isUrdu ? 'لسٹ تازہ کریں' : 'Refresh Invoices List'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{isUrdu ? 'تازہ کریں' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold animate-fade-in ${
          feedbackMsg.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {feedbackMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={isUrdu ? 'بل نمبر یا گاہک کے فون نمبر سے تلاش کریں...' : 'Search by Invoice # or Customer Phone...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 focus:border-emerald-500 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden"
          />
        </div>

        <div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-emerald-500 rounded-lg text-xs text-slate-700 focus:outline-hidden"
          />
        </div>

        <div>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-emerald-500 rounded-lg text-xs text-slate-700 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Invoices List */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] sticky top-0 border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">{isUrdu ? 'بل نمبر #' : 'Invoice #'}</th>
              <th className="py-2.5 px-2">{isUrdu ? 'حالت' : 'Status'}</th>
              <th className="py-2.5 px-2">{isUrdu ? 'تاریخ و وقت' : 'Date & Time'}</th>
              <th className="py-2.5 px-2">{isUrdu ? 'گاہک' : 'Customer'}</th>
              <th className="py-2.5 px-2">{isUrdu ? 'کیشئر' : 'Cashier'}</th>
              <th className="py-2.5 px-2">{isUrdu ? 'طریقہ ادائیگی' : 'Payment'}</th>
              <th className="py-2.5 px-2 text-right">{isUrdu ? 'کل رقم' : 'Grand Total'}</th>
              <th className="py-2.5 pr-3 text-right">{isUrdu ? 'اقدامات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedInvoices.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-8 text-center text-slate-400">
                  {statusFilter === 'active'
                    ? (isUrdu ? 'کوئی فعال بل تلاش کے مطابق نہیں ملا۔' : 'No active invoices found.')
                    : (isUrdu ? 'کوئی منسوخ شدہ بل نہیں ملا۔' : 'No voided invoices found.')}
                </td>
              </tr>
            ) : (
              displayedInvoices.map((inv) => {
                const isVoid = isInvoiceVoid(inv);
                return (
                  <tr
                    key={inv.id}
                    className={`transition-colors ${
                      isVoid ? 'bg-rose-50/50 hover:bg-rose-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold">
                      <span className={isVoid ? 'line-through text-slate-400' : 'text-emerald-700'}>
                        {inv.invoice_number}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      {isVoid ? (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200"
                          title={inv.void_reason || 'Voided'}
                        >
                          {isUrdu ? 'منسوخ (Void)' : 'VOIDED'}
                        </span>
                      ) : Number(inv.total_refunded) > 0 ? (
                        <div className="flex flex-col gap-0.5 items-start">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs">
                            <span>🔄</span>
                            <span>{Number(inv.total_refunded) >= Number(inv.grand_total)
                              ? (isUrdu ? 'واپسی شدہ' : 'Returned')
                              : (isUrdu ? 'جزوی واپسی' : 'Partial Return')}</span>
                          </span>
                          <span className="text-[9px] text-amber-700 font-mono font-semibold">
                            -Rs. {Math.round(Number(inv.total_refunded)).toLocaleString()}
                          </span>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {isUrdu ? 'فعال / درست' : 'Active'}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-slate-500 font-mono">
                      {new Date(inv.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="font-semibold text-slate-900">
                        {formatCustName(inv.customer_name)}
                      </div>
                      {inv.customer_phone && <div className="text-[10px] text-slate-500 font-mono">{inv.customer_phone}</div>}
                      {isVoid && inv.void_reason && (
                        <div className="text-[10px] text-rose-700 font-medium mt-0.5">
                          {isUrdu ? `منسوخی کی وجہ: ${inv.void_reason}` : `Void Reason: ${inv.void_reason}`}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-slate-700">{inv.cashier_name || 'Terminal'}</td>
                    <td className="py-2.5 px-2 font-semibold text-[11px] text-slate-600">
                      {inv.payment_method === 'cash'
                        ? isUrdu ? '💵 نقد' : 'Cash'
                        : inv.payment_method === 'card'
                        ? isUrdu ? '💳 کارڈ' : 'Card'
                        : inv.payment_method === 'bank'
                        ? isUrdu ? '🏦 آن لائن' : 'Bank'
                        : inv.payment_method === 'credit'
                        ? isUrdu ? '📝 ادھار کھاتہ' : 'Khata'
                        : inv.payment_method}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">
                      <div>Rs. {inv.grand_total?.toLocaleString()}</div>
                      {Number(inv.total_refunded) > 0 && (
                        <div className="text-[10px] text-amber-700 font-semibold font-mono">
                          {isUrdu ? 'خالص: ' : 'Net: '}Rs. {Math.max(0, (Number(inv.grand_total) || 0) - Number(inv.total_refunded)).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <div className="inline-flex items-center space-x-1.5">
                        <button
                          onClick={() => handleOpenReceipt(inv.invoice_number)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-semibold transition-colors cursor-pointer"
                          title={isUrdu ? 'رسید دیکھیں یا پرنٹ کریں' : 'View / Print Receipt'}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isUrdu ? 'رسید' : 'View'}</span>
                        </button>

                        {!isVoid && (
                          <button
                            onClick={() => handleOpenEditModal(inv)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-semibold transition-colors cursor-pointer"
                            title={isUrdu ? 'یہ بل تبدیل / ایڈٹ کریں (اسٹاک اور کھاتہ خودکار ایڈجسٹ ہوگا)' : 'Edit this Bill (Stock & Khata Auto-Adjusts)'}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{isUrdu ? 'ترمیم' : 'Edit'}</span>
                          </button>
                        )}

                        {!isVoid && (
                          <button
                            onClick={() => {
                              setInvoiceToVoid(inv);
                              setVoidReason('');
                            }}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-xs font-semibold transition-colors cursor-pointer"
                            title={isUrdu ? 'یہ بل منسوخ کریں (اسٹاک اور کھاتہ خودکار بحال ہوگا)' : 'Void / Cancel this Bill (Restore Stock & Khata)'}
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>{isUrdu ? 'منسوخ' : 'Void'}</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleDeletePermanent(inv)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold transition-colors cursor-pointer"
                          title={isUrdu ? 'یہ بل مستقل ڈیلیٹ کریں (اسٹاک اور کھاتہ بحال ہوگا)' : 'Permanently Delete this Bill'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isUrdu ? 'ڈیلیٹ' : 'Delete'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* REPRINT RECEIPT MODAL */}
      <Modal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title={isUrdu ? `بل رسید: ${selectedInvoice?.invoice_number}` : `Invoice: ${selectedInvoice?.invoice_number}`}
        maxWidth="max-w-lg"
      >
        {selectedInvoice && (
          <ThermalReceipt
            invoice={selectedInvoice}
            onClose={() => setSelectedInvoice(null)}
          />
        )}
      </Modal>

      {/* VOID BILL CONFIRMATION MODAL */}
      <Modal
        isOpen={!!invoiceToVoid}
        onClose={() => setInvoiceToVoid(null)}
        title={isUrdu ? `بل منسوخی کی تصدیق: ${invoiceToVoid?.invoice_number}` : `Void / Cancel Bill: ${invoiceToVoid?.invoice_number}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmVoid} className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5 text-xs text-rose-900">
            <div className="flex items-center gap-1.5 font-bold text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{isUrdu ? 'اہم انتباہ (یہ عمل ناقابل تنسیخ ہے)' : 'Caution (Irreversible Action)'}</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {isUrdu
                ? 'یہ بل ڈیٹا بیس میں مستقل طور پر منسوخ (VOID) نشان زد ہو جائے گا:'
                : 'This bill will be permanently marked as "VOID":'}
            </p>
            <ul className="list-disc list-inside text-[10px] space-y-0.5 text-rose-800 pl-1">
              <li>{isUrdu ? 'بیچے گئے تمام آئٹمز کا اسٹاک فوری دکان کے گودام میں واپس جمع ہو جائے گا۔' : 'Item stock will immediately return to Inventory.'}</li>
              <li>{isUrdu ? 'تمام سیریل نمبرز دوبارہ دکان میں فروخت کے لیے دستیاب ہو جائیں گے۔' : 'Serial numbers will be marked back as in-stock.'}</li>
              <li>{isUrdu ? 'اگر گاہک کے کھاتے میں ادھار گیا تھا تو کھاتے میں خودکار الٹی انٹری ہو کر بیلنس بحال ہو جائے گا۔' : 'Customer ledger debt will be automatically reversed.'}</li>
            </ul>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600">{isUrdu ? 'گاہک:' : 'Customer:'}</span>
              <span className="font-semibold text-slate-900">
                {formatCustName(invoiceToVoid?.customer_name)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">{isUrdu ? 'بل کی کل رقم:' : 'Bill Amount:'}</span>
              <span className="font-mono font-bold text-emerald-700">Rs. {invoiceToVoid?.grand_total?.toLocaleString()}</span>
            </div>
            {invoiceToVoid?.balance_due > 0 && (
              <div className="flex justify-between">
                <span className="text-amber-800">{isUrdu ? 'کھاتے کا ادھار بیلنس:' : 'Khata Udhar Balance:'}</span>
                <span className="font-mono font-bold text-amber-700">Rs. {invoiceToVoid?.balance_due?.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {isUrdu ? 'بل منسوخ کرنے کی ٹھوس وجہ درج کریں *' : 'Reason for Voiding Bill:'}
            </label>
            <textarea
              rows={2}
              required
              placeholder={
                isUrdu
                  ? 'مثلاً گاہک نے مال واپس کر دیا یا غلط آئٹم پنچ ہوا تھا...'
                  : 'e.g. Customer returned items / cashier wrong item punch...'
              }
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-rose-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setInvoiceToVoid(null)}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold"
            >
              {isUrdu ? 'منسوخ' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isVoiding || !voidReason.trim()}
              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20 cursor-pointer"
            >
              <Ban className="w-4 h-4" />
              <span>
                {isVoiding
                  ? isUrdu ? 'منسوخ ہو رہا ہے...' : 'Voiding...'
                  : isUrdu ? '✓ تصدیق کریں اور بل منسوخ کریں' : 'Confirm & Void Bill'}
              </span>
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT INVOICE MODAL */}
      <Modal
        isOpen={!!editingInvoice}
        onClose={() => setEditingInvoice(null)}
        title={isUrdu ? `بل میں ترمیم (Edit Invoice): ${editingInvoice?.invoice_number}` : `Edit Invoice: ${editingInvoice?.invoice_number}`}
        maxWidth="max-w-4xl"
      >
        {editingInvoice && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            {/* Informational Guidance Banner */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
              <Edit3 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-blue-800">
                  {isUrdu ? 'خودکار اسٹاک اور کھاتہ ایڈجسٹمنٹ' : 'Automatic Stock & Khata Adjustments'}
                </span>
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  {isUrdu
                    ? 'بل میں کسی بھی پروڈکٹ کی تعداد بڑھانے پر اسٹاک سے مزید کمی ہوگی اور گھٹانے پر مال گودام میں خودکار واپس ہوگا۔ گاہک کا کھاتہ/ادھار بھی نئے ٹوٹل کے مطابق اپڈیٹ ہو جائے گا۔'
                    : 'Modifying quantities will automatically adjust product warehouse stock (deduct if increased, restore if decreased) and rebalance customer ledger balance.'}
                </p>
              </div>
            </div>

            {/* Error Banner */}
            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {/* Customer & Payment Info Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">{isUrdu ? 'گاہک:' : 'Customer:'}</span>
                <span className="font-bold text-slate-900 text-xs">
                  {formatCustName(editingInvoice.customer_name)}
                </span>
                {editingInvoice.customer_phone && (
                  <span className="text-slate-500 font-mono text-[10px] block">
                    {editingInvoice.customer_phone}
                  </span>
                )}
              </div>

              <div>
                <label className="text-slate-500 block text-[11px] mb-1 font-semibold">
                  {isUrdu ? 'طریقہ ادائیگی:' : 'Payment Method:'}
                </label>
                <select
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-blue-500"
                >
                  <option value="cash">{isUrdu ? '💵 نقد (Cash)' : 'Cash'}</option>
                  <option value="card">{isUrdu ? '💳 کارڈ (Card)' : 'Card'}</option>
                  <option value="bank">{isUrdu ? '🏦 آن لائن / بینک (Bank)' : 'Bank'}</option>
                  <option value="credit">{isUrdu ? '📝 ادھار کھاتہ (Khata/Udhar)' : 'Khata / Credit'}</option>
                </select>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">{isUrdu ? 'کیشئر:' : 'Cashier:'}</span>
                <span className="font-semibold text-slate-800 text-xs">
                  {editingInvoice.cashier_name || 'Terminal'}
                </span>
                <span className="text-slate-400 font-mono text-[10px] block">
                  {new Date(editingInvoice.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Add Product Search Input */}
            <div className="relative">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={isUrdu ? 'بل میں مزید پروڈکٹ شامل کرنے کے لیے نام یا بارکوڈ لکھیں...' : 'Search by name or barcode to add product...'}
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {filteredProducts.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddProductToInvoice(p)}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between text-xs transition-colors cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {p.barcode || 'No Barcode'} • {isUrdu ? 'موجودہ اسٹاک: ' : 'Stock: '}{p.stock_quantity}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-emerald-700">Rs. {Number(p.sale_price).toLocaleString()}</div>
                        <span className="text-[10px] font-semibold text-blue-600 flex items-center gap-0.5 justify-end">
                          <Plus className="w-3 h-3" /> {isUrdu ? 'شامل کریں' : 'Add'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">{isUrdu ? 'آئٹم' : 'Item'}</th>
                    <th className="py-2 px-2 text-center w-28">{isUrdu ? 'قیمت فی عدد' : 'Unit Price'}</th>
                    <th className="py-2 px-2 text-center w-36">{isUrdu ? 'تعداد (Qty)' : 'Quantity'}</th>
                    <th className="py-2 px-2 text-right w-28">{isUrdu ? 'کل رقم' : 'Line Total'}</th>
                    <th className="py-2 pr-3 text-center w-12">{isUrdu ? 'ہٹائیں' : 'Del'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {editItems.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-6 text-center text-slate-400 font-medium">
                        {isUrdu ? 'بل میں کوئی پروڈکٹ نہیں ہے۔ اوپر سے شامل کریں۔' : 'No items in invoice. Search above to add.'}
                      </td>
                    </tr>
                  ) : (
                    editItems.map((item, idx) => {
                      const lineTotal = (Number(item.unit_price) || 0) * (Number(item.quantity) || 1);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{item.product_name}</div>
                            {item.barcode && <div className="text-[10px] text-slate-400 font-mono">{item.barcode}</div>}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <div className="inline-flex items-center">
                              <span className="text-[10px] text-slate-400 mr-1">Rs.</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.unit_price}
                                onChange={(e) => handleItemPriceChange(idx, e.target.value)}
                                className="w-20 px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900 text-xs text-right focus:outline-hidden focus:border-blue-500"
                              />
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleItemQtyChange(idx, -1)}
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                                title={isUrdu ? 'تعداد کم کریں' : 'Decrease Quantity'}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleItemQtyChange(idx, e.target.value)}
                                className="w-14 px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900 text-xs text-center focus:outline-hidden focus:border-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleItemQtyChange(idx, 1)}
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                                title={isUrdu ? 'تعداد بڑھائیں' : 'Increase Quantity'}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">
                            Rs. {lineTotal.toLocaleString()}
                          </td>
                          <td className="py-2.5 pr-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 rounded text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                              title={isUrdu ? 'یہ آئٹم ہٹائیں' : 'Remove Item'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Calculations & Additional Costs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
              {/* Left Column: Notes & Delivery */}
              <div className="space-y-2.5">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    {isUrdu ? 'بل نوٹس (Notes):' : 'Invoice Notes:'}
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder={isUrdu ? 'بل پر کوئی خاص نوٹ درج کریں...' : 'Add invoice notes...'}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      {isUrdu ? 'شپنگ / کرایہ:' : 'Shipping Cost:'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editShippingCost}
                      onChange={(e) => setEditShippingCost(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      {isUrdu ? 'اضافی چارجز:' : 'Extra Charges:'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editExtraCharges}
                      onChange={(e) => setEditExtraCharges(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Financial Breakdown */}
              <div className="space-y-1.5 bg-white p-3 rounded-lg border border-slate-200">
                <div className="flex justify-between items-center text-slate-600">
                  <span>{isUrdu ? 'سب ٹوٹل:' : 'Subtotal:'}</span>
                  <span className="font-mono font-semibold">Rs. {editSubtotal.toLocaleString()}</span>
                </div>

                {/* Discount Row */}
                <div className="flex justify-between items-center text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span>{isUrdu ? 'رعایت (Discount):' : 'Discount:'}</span>
                    <select
                      value={editDiscountType}
                      onChange={(e) => setEditDiscountType(e.target.value)}
                      className="px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-semibold"
                    >
                      <option value="amount">Rs.</option>
                      <option value="percentage">%</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      value={editDiscountValue}
                      onChange={(e) => setEditDiscountValue(e.target.value)}
                      className="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-right font-mono text-xs focus:outline-hidden focus:border-blue-500"
                    />
                    <span className="font-mono text-rose-600 font-semibold text-[11px]">
                      -Rs. {editDiscountAmount.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Tax Row */}
                <div className="flex justify-between items-center text-slate-600">
                  <div className="flex items-center gap-1">
                    <span>{isUrdu ? 'ٹیکس (Tax %):' : 'Tax Rate (%):'}</span>
                    <input
                      type="number"
                      min="0"
                      value={editTaxRate}
                      onChange={(e) => setEditTaxRate(e.target.value)}
                      className="w-14 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-right font-mono text-xs focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <span className="font-mono text-slate-700 font-semibold">
                    +Rs. {editTaxAmount.toLocaleString()}
                  </span>
                </div>

                {/* Grand Total */}
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
                  <span>{isUrdu ? 'کل رقم (Grand Total):' : 'Grand Total:'}</span>
                  <span className="font-mono text-base text-emerald-700">Rs. {editGrandTotal.toLocaleString()}</span>
                </div>

                {/* Paid Amount */}
                <div className="flex justify-between items-center pt-1.5">
                  <span className="font-semibold text-slate-700">{isUrdu ? 'وصول شدہ رقم (Paid):' : 'Paid Amount:'}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">Rs.</span>
                    <input
                      type="number"
                      min="0"
                      value={editPaidAmount}
                      onChange={(e) => setEditPaidAmount(e.target.value)}
                      className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-lg text-right font-mono font-bold text-slate-900 text-xs focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Balance Due (Udhar) */}
                {editBalanceDue > 0 && (
                  <div className="flex justify-between items-center text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200 font-semibold">
                    <span>{isUrdu ? 'باقی ادھار (Udhar Khata):' : 'Balance Due (Khata):'}</span>
                    <span className="font-mono font-bold text-amber-700">Rs. {editBalanceDue.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingInvoice(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                {isUrdu ? 'منسوخ' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSavingEdit || editItems.length === 0}
                className="flex-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 cursor-pointer transition-all"
              >
                <Save className="w-4 h-4" />
                <span>
                  {isSavingEdit
                    ? isUrdu ? 'تبدیلیاں محفوظ ہو رہی ہیں...' : 'Saving Changes...'
                    : isUrdu ? '✓ تبدیلیاں محفوظ کریں اور اسٹاک اپڈیٹ کریں' : 'Save Changes & Sync Stock'}
                </span>
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
