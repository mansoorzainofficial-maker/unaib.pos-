import React, { useState, useEffect } from 'react';
import { Truck, Plus, CheckCircle2, AlertCircle, Loader2, ArrowRight, Calendar, DollarSign, FileText } from 'lucide-react';
import { grnApi } from '../services/grnApi';
import { supplierApi } from '../services/supplierApi';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import GrnItemRow from '../components/GrnItemRow';
import QuickProductModal from '../components/QuickProductModal';
import SupplierForm from '../components/SupplierForm';

export default function CreateGrn({ onNavigateToList }) {
  const { t, isUrdu } = useLanguage();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [paymentType, setPaymentType] = useState('credit'); // 'cash' or 'credit'
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    { product_id: '', category_id: '', quantity_ordered: 1, quantity_received: 1, unit_cost: 0 }
  ]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Quick Add modals state
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [targetRowIndex, setTargetRowIndex] = useState(null);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);

  useEffect(() => {
    loadMeta();
  }, []);

  const loadMeta = async () => {
    setLoading(true);
    try {
      const [supList, prodList, catList] = await Promise.all([
        supplierApi.getAll(),
        api.products.getAll(),
        api.products.getCategories().catch(() => ({ categories: [] }))
      ]);
      setSuppliers(supList);
      setProducts(prodList.products || prodList || []);
      setCategories(catList.categories || catList || []);
      if (supList.length > 0 && !supplierId) {
        setSupplierId(supList[0].id);
      }
    } catch (err) {
      console.error('Failed to load metadata for GRN:', err);
      setErrorMsg(t('grn_err_meta'));
    } finally {
      setLoading(false);
    }
  };

  const handleProductCreated = (newProd, _, qty = 1) => {
    // 1. Refresh products list
    setProducts(prev => [newProd, ...prev.filter(p => p.id !== newProd.id)]);

    // 2. Select into GRN row
    let targetIdx = targetRowIndex;
    if (targetIdx === null || targetIdx < 0 || targetIdx >= items.length) {
      const emptyIdx = items.findIndex(it => !it.product_id);
      targetIdx = emptyIdx !== -1 ? emptyIdx : items.length;
    }

    const newItem = {
      product_id: newProd.id,
      category_id: newProd.category_id || '',
      quantity_ordered: Number(qty) || 1,
      quantity_received: Number(qty) || 1,
      unit_cost: Number(newProd.cost_price || 0)
    };

    setItems(prev => {
      const next = [...prev];
      if (targetIdx < next.length) {
        next[targetIdx] = newItem;
      } else {
        next.push(newItem);
      }
      const valid = next.filter(it => it.product_id);
      return valid.length > 0 ? valid : [{ product_id: '', category_id: '', quantity_ordered: 1, quantity_received: 1, unit_cost: 0 }];
    });

    setSuccessMsg(isUrdu
      ? `پراڈکٹ "${newProd.name}" (${qty} عدد) GRN لسٹ میں منتخب ہو گیا۔ اسٹاک گودام میں درج کرنے کے لیے نیچے دیے گئے "رسید محفوظ کریں" کا بٹن دبائیں۔`
      : `Product "${newProd.name}" (${qty} units) selected. Click "Save GRN" below to commit stock.`
    );
    setTimeout(() => setSuccessMsg(''), 5000);
    setIsAddProductOpen(false);
  };

  const handleItemChange = (index, updatedItem) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = updatedItem;
      return next;
    });
  };

  const handleAddItemRow = () => {
    setItems(prev => [
      ...prev,
      { product_id: '', category_id: '', quantity_ordered: 1, quantity_received: 1, unit_cost: 0 }
    ]);
  };

  const handleRemoveItemRow = (index) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Calculate live Grand Total
  const calculatedGrandTotal = items.reduce((sum, it) => {
    if (!it.product_id) return sum;
    const qty = Number(it.quantity_received) || 0;
    const cost = Number(it.unit_cost) || 0;
    return sum + (qty * cost);
  }, 0);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Strict Frontend Validation
    if (!supplierId) {
      setErrorMsg(t('grn_err_supplier'));
      return;
    }

    if (!receivedDate) {
      setErrorMsg(t('grn_err_date'));
      return;
    }

    // Filter valid items (discards any empty rows)
    const validItems = items.filter(it => it.product_id && Number(it.quantity_received) > 0);
    if (validItems.length === 0) {
      setErrorMsg(isUrdu ? 'براہِ کرم کم از کم ایک پراڈکٹ اور مقدار درج کریں۔' : 'Please select at least one product with valid quantity.');
      return;
    }

    for (let i = 0; i < validItems.length; i++) {
      const it = validItems[i];
      if (Number(it.unit_cost) < 0) {
        setErrorMsg(`${t('grn_row_prefix')}${i + 1}: ${t('grn_err_row_cost')}`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        supplier_id: Number(supplierId),
        payment_type: paymentType,
        received_date: receivedDate,
        notes: notes.trim() || null,
        items: validItems.map(it => ({
          product_id: Number(it.product_id),
          quantity_ordered: Number(it.quantity_received),
          quantity_received: Number(it.quantity_received),
          unit_cost: Number(it.unit_cost)
        }))
      };

      const res = await grnApi.create(payload);
      if (res.success) {
        setSuccessMsg(isUrdu
          ? `✓ رسید #${res.grn.grn_number} کامیابی سے محفوظ ہو گئی! گودام اسٹاک اور کھاتہ اپڈیٹ ہو گیا۔`
          : `✓ GRN #${res.grn.grn_number} saved successfully! Inventory and ledger updated.`
        );
        // Reset form
        setItems([{ product_id: '', category_id: '', quantity_ordered: 1, quantity_received: 1, unit_cost: 0 }]);
        setNotes('');
        loadMeta();
        setTimeout(() => {
          if (onNavigateToList) onNavigateToList();
        }, 1500);
      }
    } catch (err) {
      console.error('Failed to create GRN:', err);
      setErrorMsg(err.message || (isUrdu ? 'GRN محفوظ کرنے میں خرابی پیش آگئی۔' : 'Failed to save GRN.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 w-full h-full overflow-y-auto p-4 space-y-4 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 font-black">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-tight">{t('grn_create_title')}</h1>
            <p className="text-xs text-slate-500 font-medium">{t('grn_create_sub')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToList && (
            <button
              type="button"
              onClick={onNavigateToList}
              className="flex items-center space-x-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              <span>{t('grn_view_list_btn')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Unsaved Items Notice */}
      {items.some(it => it.product_id) && !successMsg && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <span className="text-base">⚠️</span>
          <span>
            {isUrdu
              ? 'نوٹ: درج کردہ سامان ابھی عارضی لسٹ میں ہے۔ اسٹاک اور کھاتہ اپڈیٹ کرنے کے لیے نیچے دیے گئے "رسید محفوظ کریں" کے بٹن پر کلک فرمائیں۔'
              : 'Notice: Items listed below are temporary. Click "Save GRN" at the bottom to finalize stock and ledger!'}
          </span>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Header Details Card - Compact Single Row Grid */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Supplier Selector */}
            <div className="md:col-span-4">
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-800 text-[11px]">
                  {t('grn_supplier_label')}
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddSupplierOpen(true)}
                  className="text-[10px] font-bold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-lg border border-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{t('grn_quick_add_supplier')}</span>
                </button>
              </div>
              <select
                value={supplierId}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setIsAddSupplierOpen(true);
                  } else {
                    setSupplierId(e.target.value);
                  }
                }}
                required
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-hidden text-xs"
              >
                <option value="">{t('grn_select_supplier_option')}</option>
                <option value="__new__" className="font-bold text-amber-700 bg-amber-50">
                  {t('grn_select_or_add_sup')}
                </option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.phone ? `(${s.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Type (Cash or Credit) */}
            <div className="md:col-span-3">
              <label className="block font-bold text-slate-800 mb-1 text-[11px]">
                {t('grn_payment_type_label')}
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaymentType('credit')}
                  className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    paymentType === 'credit'
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs font-black'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {t('grn_credit_type')}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('cash')}
                  className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    paymentType === 'cash'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs font-black'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {t('grn_cash_type')}
                </button>
              </div>
            </div>

            {/* Received Date */}
            <div className="md:col-span-2">
              <label className="block font-bold text-slate-800 mb-1 text-[11px]">
                {t('grn_date_label')}
              </label>
              <input
                type="date"
                required
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-semibold focus:border-amber-500 focus:outline-hidden text-xs"
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-3">
              <label className="block font-bold text-slate-800 mb-1 text-[11px]">
                {t('grn_notes_label')}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('grn_notes_placeholder')}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-amber-500 focus:outline-hidden text-xs"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Items Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              <span>{t('grn_items_breakdown')}</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-mono font-bold">
                {items.length} {t('grn_items_badge')}
              </span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddItemRow}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isUrdu ? '+ نئی قطار شامل کریں' : '+ Add Row to GRN'}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3 text-center w-12">{t('grn_col_num')}</th>
                  <th className="py-2.5 px-3 w-48">{t('grn_col_category')}</th>
                  <th className="py-2.5 px-3">{t('grn_col_product')}</th>
                  <th className="py-2.5 px-3 text-center w-28">{t('grn_col_qty_rec')}</th>
                  <th className="py-2.5 px-3 text-right w-36">{t('grn_col_cost')}</th>
                  <th className="py-2.5 px-3 text-left w-32">{t('grn_col_total')}</th>
                  <th className="py-2.5 px-3 text-center w-12">{t('grn_col_action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => (
                  <GrnItemRow
                    key={index}
                    index={index}
                    item={item}
                    products={products}
                    categories={categories}
                    onChange={handleItemChange}
                    onRemove={handleRemoveItemRow}
                    onOpenAddProduct={(rowIndex) => {
                      setTargetRowIndex(rowIndex);
                      setIsAddProductOpen(true);
                    }}
                    canRemove={items.length > 1}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Sticky Grand Total & Submission Bar (Always visible without scrolling) */}
          <div className="sticky bottom-0 p-3.5 bg-white/95 backdrop-blur-xs border-t-2 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md z-10">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold text-slate-600">{t('grn_grand_total_label')}</span>
              <span className="font-mono text-2xl font-black text-amber-900">
                Rs. {calculatedGrandTotal.toLocaleString()}
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                {paymentType === 'credit' ? t('grn_on_credit') : t('grn_on_cash')}
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || items.every(it => !it.product_id)}
              className="px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-slate-950 font-black rounded-xl text-xs shadow-md shadow-amber-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('grn_saving_btn')}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('grn_submit_btn')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Quick Add Product Modal */}
      <QuickProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        categories={categories}
        supplierId={supplierId}
        paymentType={paymentType}
        initialCost={targetRowIndex !== null ? items[targetRowIndex]?.unit_cost : 0}
        onSuccess={handleProductCreated}
      />

      {/* Quick Add Supplier Modal */}
      <SupplierForm
        isOpen={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        supplier={null}
        onSuccess={(newSup) => {
          setSuppliers(prev => [newSup, ...prev.filter(s => s.id !== newSup.id)]);
          setSupplierId(newSup.id);
          setIsAddSupplierOpen(false);
          setSuccessMsg(isUrdu ? `نیا سپلائر "${newSup.name}" شامل کر لیا گیا ہے۔` : `Supplier "${newSup.name}" added successfully.`);
          setTimeout(() => setSuccessMsg(''), 4000);
        }}
      />
    </div>
  );
}
