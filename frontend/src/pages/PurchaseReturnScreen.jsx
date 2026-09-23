import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import {
  Truck,
  CheckCircle2,
  AlertCircle,
  Package,
  Calendar,
  DollarSign,
  Printer,
  History,
  Trash2,
  Building2,
  ArrowDownLeft
} from 'lucide-react';
import useSubmitGuard from '../hooks/useSubmitGuard';
import ActionButton from '../components/ActionButton';

export default function PurchaseReturnScreen() {
  const { isUrdu } = useLanguage();
  const [activeTab, setActiveTab] = useState('new'); // 'new' or 'history'

  const [suppliersList, setSuppliersList] = useState([]);
  const [productsList, setProductsList] = useState([]);

  const [supplierId, setSupplierId] = useState('');
  const [refundMode, setRefundMode] = useState('deduct_balance'); // 'deduct_balance' or 'cash_received'
  const [reason, setReason] = useState('خراب مال / ڈسٹری بیوٹر کلیم (Defective component RMA)');

  const [returnItems, setReturnItems] = useState([]);
  const [successModal, setSuccessModal] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // History State
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const loadInitialData = async () => {
    try {
      const supRes = await api.purchases.getSuppliers();
      setSuppliersList(supRes.suppliers || supRes.data || []);

      const prodRes = await api.products.getAll();
      setProductsList(prodRes.products || prodRes.data || []);
    } catch (e) {
      console.error('Failed to load initial data:', e);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.returns.getPurchaseReturns();
      setHistoryList(res.returns || []);
    } catch (e) {
      console.error('Failed to load purchase returns history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAddItem = (productId) => {
    const prod = productsList.find(p => p.id === Number(productId));
    if (!prod) return;

    if (returnItems.some(i => i.product_id === prod.id)) return;

    setReturnItems([
      ...returnItems,
      {
        product_id: prod.id,
        name: prod.name,
        available_stock: prod.stock_quantity,
        quantity: 1,
        unit_cost: prod.cost_price
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

  const calculateTotalAmount = () => {
    return returnItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_cost || 0)), 0);
  };

  const [handleSubmit, submitting] = useSubmitGuard(async () => {
    if (!supplierId) {
      setErrorMsg(isUrdu ? 'براہ کرم سپلائر منتخب کریں۔' : 'Please select a supplier.');
      return;
    }
    if (returnItems.length === 0) {
      setErrorMsg(isUrdu ? 'براہ کرم واپسی کے لیے کم از کم ایک پروڈکٹ شامل کریں۔' : 'Please add at least one product to return.');
      return;
    }

    setErrorMsg('');

    const selectedSup = suppliersList.find(s => s.id === Number(supplierId));

    try {
      const payload = {
        supplier_id: Number(supplierId),
        supplier_name: selectedSup ? selectedSup.name : 'سپلائر',
        refund_mode: refundMode,
        reason: reason,
        items: returnItems.map(it => ({
          product_id: it.product_id,
          quantity: Number(it.quantity) || 1,
          unit_cost: Number(it.unit_cost) || 0
        }))
      };

      const res = await api.returns.createPurchaseReturn(payload);
      if (res.success) {
        setSuccessModal({
          returnNumber: res.data.returnNumber,
          totalAmount: res.data.totalAmount,
          supplierName: selectedSup ? selectedSup.name : 'سپلائر',
          refundMode: refundMode,
          items: returnItems
        });

        // Reset form
        setReturnItems([]);
        setSupplierId('');
        // Reload products so updated stocks reflect
        loadInitialData();
      } else {
        setErrorMsg(res.message || 'Error processing purchase return');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Purchase return failed');
    }
  }, { cooldownMs: 1200 });

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden text-slate-800">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shadow-xs">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>{isUrdu ? 'خریداری واپسی (Purchase Return)' : 'Purchase Return'}</span>
              <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full uppercase">
                {isUrdu ? 'سپلائر کو مال واپسی' : 'Vendor Return (Debit Note)'}
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {isUrdu ? 'سپلائر کو خراب یا اضافی سامان واپس بھیجیں، اسٹاک کم کریں اور واجب الادا رقم گھٹائیں۔' : 'Return goods to suppliers, deduct inventory stock and adjust payable balance.'}
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
            {isUrdu ? '🚚↩️ نئی واپسی درج کریں' : 'New Return'}
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

      {/* Main Content */}
      {activeTab === 'new' ? (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Supplier & Refund Mode Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-purple-600" />
                <span>{isUrdu ? 'سپلائر / ڈسٹری بیوٹر منتخب کریں:' : 'Select Supplier:'}</span>
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-purple-500 focus:outline-none cursor-pointer"
              >
                <option value="">{isUrdu ? '-- سپلائر چنیں --' : '-- Choose Supplier --'}</option>
                {suppliersList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.current_balance ? `(Payable: Rs. ${Number(s.current_balance).toLocaleString()})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isUrdu ? 'کھاتے کی ایڈجسٹمنٹ:' : 'Adjustment Mode:'}</span>
              </label>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRefundMode('deduct_balance')}
                  className={`p-3 rounded-xl border text-xs font-bold cursor-pointer text-center transition-all ${
                    refundMode === 'deduct_balance'
                      ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  📉 {isUrdu ? 'کھاتے سے منہا' : 'Deduct Balance'}
                  <div className="text-[10px] font-normal text-slate-400 mt-0.5">ادھار واجبات کم کیے</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRefundMode('cash_received')}
                  className={`p-3 rounded-xl border text-xs font-bold cursor-pointer text-center transition-all ${
                    refundMode === 'cash_received'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  💵 {isUrdu ? 'نقد وصولی' : 'Cash Received'}
                  <div className="text-[10px] font-normal text-slate-400 mt-0.5">سپلائر نے نقد دیے</div>
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
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-purple-500 focus:outline-none"
              >
                <option value="خراب مال / ڈسٹری بیوٹر کلیم (Defective component RMA)">خراب مال / ڈسٹری بیوٹر کلیم (Defective RMA)</option>
                <option value="غلط یا فالتو اسٹاک آیا تھا (Excess/Wrong Stock)">غلط یا فالتو اسٹاک آیا تھا (Excess Stock)</option>
                <option value="پیکنگ ڈیمج یا مینوفیکچرنگ فالٹ">پیکنگ ڈیمج یا مینوفیکچرنگ فالٹ</option>
                <option value="وارنٹی ریپلیسمنٹ کے لیے بھیجا">وارنٹی ریپلیسمنٹ کے لیے بھیجا</option>
                <option value="دیگر وجہ">دیگر وجہ (Other)</option>
              </select>
            </div>
          </div>

          {/* Section: Products to Return */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-600" />
                <span>{isUrdu ? 'سپلائر کو بھیجی جانے والی اشیاء (Items to Return):' : 'Items to Return:'}</span>
              </h2>

              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddItem(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none cursor-pointer"
              >
                <option value="">+ {isUrdu ? 'پراڈکٹ منتخب کر کے شامل کریں...' : 'Select Product to Add...'}</option>
                {productsList.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} (In Store: {p.stock_quantity}, Cost: Rs. {p.cost_price})
                  </option>
                ))}
              </select>
            </div>

            {returnItems.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                {isUrdu ? 'اوپر دائیں کونے سے پروڈکٹ منتخب کر کے واپسی لسٹ میں شامل کریں۔' : 'Select products from top right to add to return list.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-2.5">{isUrdu ? 'پراڈکٹ کا نام' : 'Product'}</th>
                      <th className="py-2.5 w-24 text-center">{isUrdu ? 'موجودہ اسٹاک' : 'In Store'}</th>
                      <th className="py-2.5 w-28">{isUrdu ? 'واپسی تعداد' : 'Return Qty'}</th>
                      <th className="py-2.5 w-32">{isUrdu ? 'خریداری قیمت' : 'Cost Price'}</th>
                      <th className="py-2.5 w-32">{isUrdu ? 'کل رقم' : 'Total'}</th>
                      <th className="py-2.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {returnItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-3 font-bold text-slate-800">{item.name}</td>
                        <td className="py-3 text-center font-bold text-slate-500">
                          {item.available_stock}
                        </td>
                        <td className="py-3">
                          <input
                            type="number"
                            min="1"
                            max={item.available_stock || 999}
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                            className="w-20 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center"
                          />
                        </td>
                        <td className="py-3">
                          <input
                            type="number"
                            value={item.unit_cost}
                            onChange={(e) => handleUpdateItem(idx, 'unit_cost', e.target.value)}
                            className="w-28 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right"
                          />
                        </td>
                        <td className="py-3 font-black text-purple-700">
                          Rs. {(Number(item.quantity || 0) * Number(item.unit_cost || 0)).toLocaleString()}
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
                  <span className="text-xs font-bold text-slate-500">{isUrdu ? 'کل واپسی مالیت:' : 'Total Return Value:'}</span>
                  <span className="text-xl font-black text-purple-700">
                    Rs. {calculateTotalAmount().toLocaleString()}
                  </span>
                </div>

                <ActionButton
                  type="button"
                  loading={submitting}
                  loadingText={isUrdu ? 'خریداری واپسی محفوظ ہو رہی ہے...' : 'Processing Return...'}
                  onClick={handleSubmit}
                  icon={Truck}
                  className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl text-xs shadow-sm shadow-purple-600/20"
                >
                  {isUrdu ? 'خریداری واپسی مکمل کریں (Confirm Purchase Return)' : 'Confirm Purchase Return'}
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
              <h2 className="text-xs font-bold text-slate-800">
                {isUrdu ? 'گزشتہ خریداری واپسی ریکارڈ (Recent Purchase Returns)' : 'Recent Purchase Returns'}
              </h2>
              <span className="text-xs text-slate-400 font-bold">{historyList.length} Returns</span>
            </div>

            {loadingHistory ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Loading Returns History...
              </div>
            ) : historyList.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                {isUrdu ? 'ابھی تک کوئی خریداری واپسی ریکارڈ نہیں ہے۔' : 'No purchase returns recorded yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 uppercase font-bold">
                    <tr>
                      <th className="px-4 py-3">Return No.</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3 text-right">Return Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyList.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-purple-700">{r.return_number}</td>
                        <td className="px-4 py-3 text-slate-500">{new Date(r.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{r.supplier_name || 'Supplier'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.refund_mode === 'cash_received' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {r.refund_mode === 'cash_received' ? 'Cash Received' : 'Deducted Balance'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{r.reason || '-'}</td>
                        <td className="px-4 py-3 font-black text-right text-purple-700">
                          Rs. {Number(r.total_amount).toLocaleString()}
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

      {/* Success Modal */}
      {successModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">
                {isUrdu ? 'خریداری واپسی مکمل ہو گئی!' : 'Purchase Return Done!'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isUrdu ? 'اسٹاک سے مال منہا کر دیا گیا اور سپلائر کا کھاتہ اپ ڈیٹ ہو گیا۔' : 'Stock deducted & supplier ledger updated.'}
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Debit Note:</span>
                <span className="font-bold text-slate-900">{successModal.returnNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Supplier:</span>
                <span className="font-bold text-slate-800">{successModal.supplierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mode:</span>
                <span className="font-bold text-purple-700">{successModal.refundMode === 'cash_received' ? 'Cash Received' : 'Balance Deducted'}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-900 font-bold">Return Value:</span>
                <span className="font-black text-purple-700">Rs. {successModal.totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isUrdu ? 'پرنٹ ڈیبٹ نوٹ' : 'Print Note'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSuccessModal(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                {isUrdu ? 'بند کریں' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
