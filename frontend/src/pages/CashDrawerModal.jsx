import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Modal from '../components/Modal';
import { Landmark, DollarSign, ArrowUpRight, ArrowDownRight, AlertCircle, CheckCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function CashDrawerModal({ isOpen, onClose }) {
  const { isUrdu } = useLanguage();
  const [shiftData, setShiftData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Open shift state
  const [openingFloat, setOpeningFloat] = useState(5000);
  const [openNotes, setOpenNotes] = useState('');

  // Close shift state
  const [actualCash, setActualCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [reconciledResult, setReconciledResult] = useState(null);

  // Shift history
  const [history, setHistory] = useState([]);
  const [viewHistory, setViewHistory] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCurrentShift();
    }
  }, [isOpen]);

  const loadCurrentShift = async () => {
    setLoading(true);
    setReconciledResult(null);
    try {
      const res = await api.drawer.getCurrentShift();
      if (res.success) {
        setShiftData(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShift = async (e) => {
    e.preventDefault();
    try {
      await api.drawer.openShift({
        opening_cash: Number(openingFloat),
        notes: openNotes
      });
      loadCurrentShift();
    } catch (err) {
      alert(err.message || (isUrdu ? 'شفٹ شروع کرنے میں مسئلہ پیش آیا' : 'Failed to open shift'));
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (actualCash === '' || isNaN(actualCash)) {
      alert(isUrdu ? 'براہ کرم گلے میں گنی گئی اصل رقم درج کریں' : 'Please enter actual physical cash counted');
      return;
    }

    try {
      const res = await api.drawer.closeShift({
        actual_closing_cash: Number(actualCash),
        notes: closeNotes
      });
      if (res.success) {
        setReconciledResult(res.reconciliation);
        loadCurrentShift();
      }
    } catch (err) {
      alert(err.message || (isUrdu ? 'شفٹ بند کرنے میں مسئلہ پیش آیا' : 'Failed to close shift'));
    }
  };

  const loadHistory = async () => {
    try {
      const res = await api.drawer.getHistory();
      if (res.success) {
        setHistory(res.shifts);
        setViewHistory(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const drawer = shiftData?.drawer;
  const isOpenShift = shiftData?.isOpen;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isUrdu ? 'دکان کا گلہ (کیش ڈراور) و شفٹ کا حساب' : 'Cash Drawer Shift & Reconciliation'}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        {/* VIEW: RECONCILIATION RESULT (Just closed shift) */}
        {reconciledResult && (
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-300 space-y-3">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span>{isUrdu ? 'شفٹ بند اور کیش کا حساب مکمل' : 'Shift Closed and Reconciled'}</span>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>{isUrdu ? 'شروع کا کیش (فلوٹ):' : 'Opening Cash Float:'}</span>
                <span className="font-mono font-bold text-slate-900">Rs. {reconciledResult.opening_cash.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{isUrdu ? 'نقد کاؤنٹر فروخت:' : 'Cash Sales:'}</span>
                <span className="font-mono font-bold text-emerald-700">+ Rs. {reconciledResult.cash_sales.toLocaleString()}</span>
              </div>
              {(reconciledResult.customer_recoveries > 0) && (
                <div className="flex justify-between text-slate-600">
                  <span>{isUrdu ? 'گاہکوں سے کھاتہ وصولی نقد:' : 'Customer Khata Recovery:'}</span>
                  <span className="font-mono font-bold text-emerald-700">+ Rs. {reconciledResult.customer_recoveries.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>{isUrdu ? 'دکان کے نقد اخراجات:' : 'Cash Expenses Paid:'}</span>
                <span className="font-mono font-bold text-rose-700">- Rs. {reconciledResult.cash_expenses.toLocaleString()}</span>
              </div>
              {((reconciledResult.cash_purchases || 0) + (reconciledResult.supplier_payments || 0) > 0) && (
                <div className="flex justify-between text-slate-600">
                  <span>{isUrdu ? 'سپلائر خریداری و نقد ادائیگیاں:' : 'Supplier Cash Purchases & Paid:'}</span>
                  <span className="font-mono font-bold text-rose-700">- Rs. {((reconciledResult.cash_purchases || 0) + (reconciledResult.supplier_payments || 0)).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-800 font-bold pt-1 border-t border-emerald-200">
                <span>{isUrdu ? 'گلے میں متوقع کیش:' : 'Expected Drawer Total:'}</span>
                <span className="font-mono text-slate-900">Rs. {reconciledResult.expected_closing.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-800 font-bold">
                <span>{isUrdu ? 'گلے میں گنی گئی رقم:' : 'Actual Counted Cash:'}</span>
                <span className="font-mono text-slate-900">Rs. {reconciledResult.actual_closing.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-black text-sm pt-2 border-t border-emerald-200">
                <span>{isUrdu ? 'حساب کا فرق:' : 'Discrepancy:'}</span>
                <span className={`font-mono ${
                  reconciledResult.discrepancy === 0
                    ? 'text-emerald-700'
                    : reconciledResult.discrepancy > 0
                    ? 'text-blue-700'
                    : 'text-rose-700'
                }`}>
                  {isUrdu
                    ? reconciledResult.discrepancy === 0
                      ? 'حساب بالکل برابر ہے (کوئی فرق نہیں)'
                      : reconciledResult.discrepancy > 0
                      ? `اضافی کیش: +Rs. ${reconciledResult.discrepancy.toLocaleString()}`
                      : `کیش کی کمی: -Rs. ${Math.abs(reconciledResult.discrepancy).toLocaleString()}`
                    : reconciledResult.status}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: CURRENT SHIFT IS ACTIVE */}
        {isOpenShift && !reconciledResult && (
          <div className="space-y-4">
            {/* Shift Metrics */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>{isUrdu ? 'کاؤنٹر کیشئر:' : 'Cashier Shift:'}</span>
                <span className="text-slate-900 font-bold">{drawer.cashier_name}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{isUrdu ? 'شفٹ شروع ہونے کا وقت:' : 'Shift Started:'}</span>
                <span className="font-mono text-slate-700">{new Date(drawer.opened_at).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{isUrdu ? 'شروع کی رقم (ریزگاری/بقایا کے لیے):' : 'Starting Float:'}</span>
                <span className="font-mono font-bold text-slate-900">Rs. {drawer.opening_cash.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{isUrdu ? 'نقد کاؤنٹر فروخت:' : 'Cash Sales:'}</span>
                <span className="font-mono font-bold text-emerald-700">+ Rs. {drawer.cash_sales.toLocaleString()}</span>
              </div>
              {(drawer.customer_recoveries > 0) && (
                <div className="flex justify-between text-slate-600">
                  <span>{isUrdu ? 'گاہکوں سے کھاتہ وصولی نقد:' : 'Customer Khata Recovery:'}</span>
                  <span className="font-mono font-bold text-emerald-700">+ Rs. {drawer.customer_recoveries.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>{isUrdu ? 'دکان کے نقد اخراجات:' : 'Cash Expenses Paid:'}</span>
                <span className="font-mono font-bold text-rose-700">- Rs. {drawer.cash_expenses.toLocaleString()}</span>
              </div>
              {((drawer.cash_purchases || 0) + (drawer.supplier_payments || 0) > 0) && (
                <div className="flex justify-between text-slate-600">
                  <span>{isUrdu ? 'سپلائر خریداری و نقد ادائیگیاں:' : 'Supplier Cash Purchases & Paid:'}</span>
                  <span className="font-mono font-bold text-rose-700">- Rs. {((drawer.cash_purchases || 0) + (drawer.supplier_payments || 0)).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>{isUrdu ? 'گلے میں متوقع نقد رقم:' : 'Expected Cash In Drawer:'}</span>
                <span className="font-mono text-emerald-700 font-extrabold">
                  Rs. {drawer.expected_closing_cash.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Close Shift Form */}
            <form onSubmit={handleCloseShift} className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <h4 className="text-xs font-bold text-slate-800">
                {isUrdu ? 'شفٹ بند کریں اور گلے کا کیش ملائیں' : 'Close Shift & Reconcile Physical Cash'}
              </h4>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  {isUrdu ? 'گلے میں موجود اصل گنی گئی نقد رقم (روپے) *' : 'Actual Physical Cash Counted (Rs.) *'}
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  placeholder={isUrdu ? 'گلے کے نوٹ گن کر کل رقم لکھیں...' : 'Count notes in drawer and enter total...'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono text-slate-900 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder={isUrdu ? 'شفٹ بند کرنے کے نوٹس یا تفصیل...' : 'Closing notes / handover comments'}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors"
              >
                {isUrdu ? 'حساب ملا کر شفٹ بند کریں' : 'Reconcile & End Shift'}
              </button>
            </form>
          </div>
        )}

        {/* VIEW: NO ACTIVE SHIFT -> OPEN SHIFT */}
        {!isOpenShift && !reconciledResult && (
          <form onSubmit={handleOpenShift} className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2 text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 font-bold text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{isUrdu ? 'اس وقت کوئی شفٹ شروع نہیں ہے۔' : 'No active drawer shift session for your account.'}</span>
            </div>

            <p className="text-xs text-slate-600">
              {isUrdu
                ? 'دکان کھولنے پر گلے میں موجود بقایا/ریزگاری کی رقم لکھ کر شفٹ شروع کریں۔'
                : 'Start your shift by entering the opening cash float placed in the register for change return.'}
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                {isUrdu ? 'شروع کی نقد رقم / فلوٹ (روپے)' : 'Opening Cash Float (Rs.)'}
              </label>
              <input
                type="number"
                min="0"
                required
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono text-slate-900 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div>
              <input
                type="text"
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                placeholder={isUrdu ? 'شفٹ کی تفصیل (مثلاً صبح کی شفٹ)' : 'Shift notes (e.g. Morning counter shift)'}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors"
            >
              {isUrdu ? 'شفٹ شروع کریں اور گلہ کھولیں' : 'Start Shift / Open Drawer'}
            </button>
          </form>
        )}

        {/* Past Shift Audits */}
        <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
          <button
            type="button"
            onClick={loadHistory}
            className="text-slate-600 hover:text-slate-900 font-semibold transition-colors"
          >
            {isUrdu
              ? viewHistory ? 'شفٹ ہسٹری تازہ کریں' : 'شفٹ آڈٹ لاگ دیکھیں'
              : viewHistory ? 'Refresh Shift Logs' : 'View Shift Audit Logs'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium"
          >
            {isUrdu ? 'بند کریں' : 'Close'}
          </button>
        </div>

        {/* Shift History Table */}
        {viewHistory && (
          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg bg-white p-2 text-[11px] shadow-inner">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-600 border-b border-slate-200 font-bold">
                  <th className="py-1">{isUrdu ? 'کیشئر' : 'Cashier'}</th>
                  <th className="py-1">{isUrdu ? 'تاریخ' : 'Opened'}</th>
                  <th className="py-1 text-right">{isUrdu ? 'متوقع کیش' : 'Expected'}</th>
                  <th className="py-1 text-right">{isUrdu ? 'اصل کیش' : 'Actual'}</th>
                  <th className="py-1 text-right">{isUrdu ? 'فرق' : 'Discrepancy'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="py-1 font-sans text-slate-800 font-medium">{h.cashier_name}</td>
                    <td className="py-1 text-slate-500">{new Date(h.opened_at).toLocaleDateString()}</td>
                    <td className="py-1 text-right text-slate-700">Rs. {h.expected_closing_cash}</td>
                    <td className="py-1 text-right text-slate-900 font-semibold">Rs. {h.actual_closing_cash ?? '—'}</td>
                    <td className={`py-1 text-right font-bold ${
                      h.discrepancy === 0 ? 'text-emerald-600' : h.discrepancy > 0 ? 'text-blue-600' : 'text-rose-600'
                    }`}>
                      {h.discrepancy != null ? `Rs. ${h.discrepancy}` : (isUrdu ? 'جاری' : 'Open')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

