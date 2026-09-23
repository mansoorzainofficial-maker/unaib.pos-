import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { CreditCard, Plus, Trash2, Calendar, DollarSign, Tag } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useSubmitGuard } from '../hooks/useSubmitGuard';
import ActionButton from '../components/ActionButton';

export default function ExpensesScreen() {
  const { isAdmin } = useAuth();
  const { isUrdu } = useLanguage();
  const [isSubmittingExpense, guardExpenseSubmit] = useSubmitGuard(1200);
  const [expenses, setExpenses] = useState([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: 'refreshments',
    amount: '',
    payment_method: 'cash',
    description: '',
    expense_date: new Date().toISOString().slice(0, 10)
  });

  useEffect(() => {
    loadExpenses();
  }, [categoryFilter]);

  const loadExpenses = async () => {
    try {
      const res = await api.expenses.getAll({ category: categoryFilter || undefined });
      if (res.success) {
        setExpenses(res.expenses);
        setTotalExpenses(res.total);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddExpense = guardExpenseSubmit(async (e) => {
    e.preventDefault();
    if (!formData.amount) return;

    try {
      await api.expenses.create(formData);
      setIsAddOpen(false);
      setFormData({
        category: 'refreshments',
        amount: '',
        payment_method: 'cash',
        description: '',
        expense_date: new Date().toISOString().slice(0, 10)
      });
      loadExpenses();
    } catch (err) {
      alert(err.message || (isUrdu ? 'خرچہ درج کرنے میں مسئلہ پیش آیا' : 'Failed to record expense'));
    }
  });

  const handleDeleteExpense = async (id) => {
    if (!window.confirm(isUrdu ? 'کیا آپ واقعی اس خرچے کا ریکارڈ ختم کرنا چاہتے ہیں؟' : 'Delete this expense record?')) return;
    try {
      await api.expenses.delete(id);
      loadExpenses();
    } catch (err) {
      alert(err.message || (isUrdu ? 'خرچہ ڈیلیٹ نہ ہو سکا' : 'Failed to delete'));
    }
  };

  const categories = [
    { id: 'rent', label: isUrdu ? 'دکان کا کرایہ' : 'Shop Rent' },
    { id: 'electricity', label: isUrdu ? 'بجلی کا بل / UPS / جنریٹر' : 'Electricity / UPS / Generator' },
    { id: 'refreshments', label: isUrdu ? 'چائے و مہمان نوازی (ریفریشمنٹ)' : 'Tea & Refreshments' },
    { id: 'salaries', label: isUrdu ? 'ملازمین کی تنخواہیں' : 'Staff Salaries' },
    { id: 'stationery', label: isUrdu ? 'پیکنگ سامان و پرنٹر رولز' : 'Packaging & Thermal Rolls' },
    { id: 'internet', label: isUrdu ? 'انٹرنیٹ و موبائل بیلنس' : 'Internet / Phone' },
    { id: 'maintenance', label: isUrdu ? 'مرمت و دکان کی دیکھ بھال' : 'Maintenance & Repairs' },
    { id: 'other', label: isUrdu ? 'دیگر متفرق اخراجات' : 'Other Operational Expenses' }
  ];

  const getCategoryLabel = (catId) => {
    const found = categories.find((c) => c.id === catId);
    return found ? found.label : catId;
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-slate-100 text-slate-800 p-4 space-y-4 select-text">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            {isUrdu ? 'دکان کے روزمرہ اخراجات (خرچہ رجسٹر)' : 'Operational Expense Tracking'}
          </h2>
          <p className="text-xs text-slate-500">
            {isUrdu
              ? 'دکان کے تمام چھوٹے بڑے اخراجات کا اندراج کریں جو موجودہ شفٹ کے گلے سے منہا ہوں گے'
              : 'Log shop expenses and monitor operating costs deducting from shift cash drawers'}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg text-right">
            <span className="text-[10px] uppercase text-rose-800 font-bold">
              {isUrdu ? 'کل اخراجات' : 'Total Expenses'}
            </span>
            <div className="text-lg font-black font-mono text-rose-700">Rs. {totalExpenses.toLocaleString()}</div>
          </div>
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isUrdu ? 'نیا خرچہ درج کریں' : 'Record Expense'}</span>
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center space-x-2 text-xs">
        <span className="text-slate-600 font-medium">{isUrdu ? 'کیٹیگری فِلٹر:' : 'Category:'}</span>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-emerald-500"
        >
          <option value="">{isUrdu ? 'تمام کیٹیگریز' : 'All Categories'}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Expenses Table */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] sticky top-0 border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">{isUrdu ? 'تاریخ' : 'Date'}</th>
              <th className="py-2.5 px-2">{isUrdu ? 'کیٹیگری' : 'Category'}</th>
              <th className="py-2.5 px-2">{isUrdu ? 'تفصیل و مد' : 'Description'}</th>
              <th className="py-2.5 px-2">{isUrdu ? 'ادائیگی کا طریقہ' : 'Payment Method'}</th>
              <th className="py-2.5 px-2">{isUrdu ? 'اندراج کنندہ' : 'Logged By'}</th>
              <th className="py-2.5 px-2 text-right">{isUrdu ? 'رقم' : 'Amount'}</th>
              {isAdmin && <th className="py-2.5 pr-3 text-right"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-slate-400">
                  {isUrdu ? 'کوئی خرچہ درج نہیں ملا۔' : 'No expense records found.'}
                </td>
              </tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-slate-600">{e.expense_date}</td>
                  <td className="py-2.5 px-2">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 border border-slate-200">
                      {getCategoryLabel(e.category)}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-slate-800 max-w-xs truncate">{e.description || '—'}</td>
                  <td className="py-2.5 px-2 text-[11px] text-slate-600 font-semibold">
                    {e.payment_method === 'cash'
                      ? isUrdu ? '💵 نقد گلہ' : 'Cash Drawer'
                      : e.payment_method === 'bank'
                      ? isUrdu ? '🏦 بینک اکاؤنٹ' : 'Bank'
                      : isUrdu ? '💼 پیٹی کیش' : e.payment_method}
                  </td>
                  <td className="py-2.5 px-2 text-slate-600">{e.recorded_by || 'Staff'}</td>
                  <td className="py-2.5 px-2 text-right font-mono font-bold text-rose-700">
                    Rs. {e.amount.toLocaleString()}
                  </td>
                  {isAdmin && (
                    <td className="py-2.5 pr-3 text-right">
                      <button
                        onClick={() => handleDeleteExpense(e.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                        title={isUrdu ? 'ڈیلیٹ کریں' : 'Delete record'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* RECORD EXPENSE MODAL */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title={isUrdu ? 'دکان کا نیا خرچہ درج کریں' : 'Record Shop Expense'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAddExpense} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isUrdu ? 'اخراجات کی قسم / کیٹیگری' : 'Expense Category'}
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isUrdu ? 'رقم (روپے) *' : 'Amount (Rs.) *'}
            </label>
            <input
              type="number"
              min="1"
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder={isUrdu ? 'مثلاً 1500' : 'e.g. 1500'}
              className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isUrdu ? 'رقم کہاں سے ادا کی گئی؟' : 'Paid From'}
            </label>
            <select
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
              className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
            >
              <option value="cash">
                {isUrdu ? '💵 کاؤنٹر گلہ (موجودہ شفٹ کے کیش سے کٹے گا)' : 'Cash Drawer (Deducts from current shift cash)'}
              </option>
              <option value="bank">
                {isUrdu ? '🏦 بینک اکاؤنٹ / آن لائن' : 'Bank / Online Account'}
              </option>
              <option value="petty_cash">
                {isUrdu ? '💼 پیٹی کیش / الگ محفوظ رقم' : 'Separate Petty Cash'}
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isUrdu ? 'تفصیل و کیفیات (کس مد میں خرچ ہوا)' : 'Description / Notes'}
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={
                isUrdu
                  ? 'مثلاً گاہکوں اور عملے کے لیے چائے بسکٹ'
                  : 'e.g. Tea for customers and repair bench supplies'
              }
              className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold"
            >
              {isUrdu ? 'منسوخ' : 'Cancel'}
            </button>
            <ActionButton
              type="submit"
              isSubmitting={isSubmittingExpense}
              loadingText={isUrdu ? 'محفوظ ہو رہا ہے...' : 'Saving...'}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20"
            >
              {isUrdu ? '✓ خرچہ محفوظ کریں' : 'Save Expense'}
            </ActionButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}

