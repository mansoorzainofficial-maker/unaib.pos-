import React, { useState, useEffect } from 'react';
import {
  Landmark,
  Plus,
  Search,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  Wallet,
  Building2,
  Smartphone,
  ShieldCheck,
  X,
  CreditCard,
  BookOpen,
  Printer,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  User,
  Truck,
  RefreshCw
} from 'lucide-react';
import { accountApi } from '../services/accountApi';
import { useLanguage } from '../context/LanguageContext';

export default function AccountsScreen() {
  const { t, isUrdu } = useLanguage();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Account Statement modal state
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [statementAccount, setStatementAccount] = useState(null);
  const [statementData, setStatementData] = useState(null);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [statementError, setStatementError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'bank',
    account_number: '',
    branch_name: '',
    current_balance: ''
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const list = await accountApi.getAll();
      setAccounts(list);
    } catch (err) {
      console.error('Failed to load accounts:', err);
      setErrorMsg(err.message || (isUrdu ? 'اکاؤنٹس لوڈ کرنے میں ناکامی ہوئی' : 'Failed to load accounts'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingAccount(null);
    setFormData({
      name: '',
      type: 'bank',
      account_number: '',
      branch_name: '',
      current_balance: ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (acc) => {
    setEditingAccount(acc);
    setFormData({
      name: acc.name || '',
      type: acc.type || 'bank',
      account_number: acc.account_number || '',
      branch_name: acc.branch_name || '',
      current_balance: acc.current_balance !== undefined && acc.current_balance !== null ? String(acc.current_balance) : ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setEditingAccount(null);
    setFormError('');
  };

  const handleOpenStatement = async (acc) => {
    setStatementAccount(acc);
    setStatementData(null);
    setStatementError('');
    setIsStatementOpen(true);
    setLoadingStatement(true);
    try {
      const data = await accountApi.getStatement(acc.id);
      setStatementData(data);
    } catch (err) {
      console.error('Failed to load statement:', err);
      setStatementError(err.message || (isUrdu ? 'اسٹیٹمنٹ لوڈ کرنے میں خرابی پیش آئی' : 'Failed to load statement'));
    } finally {
      setLoadingStatement(false);
    }
  };

  const handleCloseStatement = () => {
    setIsStatementOpen(false);
    setStatementAccount(null);
    setStatementData(null);
    setStatementError('');
  };

  const handlePrintStatement = () => {
    window.print();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError(isUrdu ? 'اکاؤنٹ کا نام درج کرنا لازمی ہے۔' : 'Account name is required.');
      return;
    }

    setSaving(true);
    try {
      if (editingAccount) {
        await accountApi.update(editingAccount.id, {
          name: formData.name.trim(),
          type: formData.type,
          account_number: formData.account_number.trim() || null,
          branch_name: formData.branch_name.trim() || null,
          current_balance: formData.current_balance !== '' ? Number(formData.current_balance) : undefined
        });
        setSuccessMsg(t('accounts_updated_success'));
      } else {
        await accountApi.create({
          name: formData.name.trim(),
          type: formData.type,
          account_number: formData.account_number.trim() || null,
          branch_name: formData.branch_name.trim() || null,
          current_balance: formData.current_balance !== '' ? Number(formData.current_balance) : 0
        });
        setSuccessMsg(t('accounts_created_success'));
      }
      setTimeout(() => setSuccessMsg(''), 4000);
      setIsModalOpen(false);
      loadAccounts();
    } catch (err) {
      console.error('Save account error:', err);
      let msg = err.message || (isUrdu ? 'خرابی پیش آ گئی' : 'An error occurred');
      if (msg.includes('already exists')) {
        msg = isUrdu ? 'اس نام سے اکاؤنٹ پہلے سے موجود ہے۔' : 'An account with this name already exists.';
      }
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (acc) => {
    if (acc.is_default === 1) {
      alert(t('accounts_default_cant_delete'));
      return;
    }

    const confirmPrompt = isUrdu
      ? `کیا آپ واقعی اکاؤنٹ "${acc.name}" کو ڈیلیٹ کرنا چاہتے ہیں؟`
      : `Are you sure you want to delete account "${acc.name}"?`;

    if (!window.confirm(confirmPrompt)) {
      return;
    }

    try {
      await accountApi.delete(acc.id);
      setSuccessMsg(t('accounts_delete_success'));
      setTimeout(() => setSuccessMsg(''), 4000);
      loadAccounts();
    } catch (err) {
      console.error('Delete account error:', err);
      let msg = err.message || (isUrdu ? 'ڈیلیٹ کرنے میں خرابی پیش آئی' : 'Failed to delete account');
      if (msg.includes('transaction history') || msg.includes('HAS_TRANSACTIONS')) {
        msg = t('accounts_err_has_tx');
      }
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 6000);
    }
  };

  // Metric counts
  const totalAccounts = accounts.length;
  const cashAccounts = accounts.filter(a => a.type === 'cash').length;
  const bankAccounts = accounts.filter(a => a.type === 'bank').length;
  const walletAccounts = accounts.filter(a => a.type === 'wallet').length;

  const filtered = accounts.filter(acc => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (acc.name || '').toLowerCase().includes(q) ||
      (acc.account_number || '').toLowerCase().includes(q) ||
      (acc.branch_name || '').toLowerCase().includes(q)
    );
  });

  const getTypeBadge = (type) => {
    switch (type) {
      case 'cash':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Wallet className="w-3 h-3 text-emerald-600" />
            {t('accounts_type_cash')}
          </span>
        );
      case 'bank':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <Building2 className="w-3 h-3 text-blue-600" />
            {t('accounts_type_bank')}
          </span>
        );
      case 'wallet':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
            <Smartphone className="w-3 h-3 text-purple-600" />
            {t('accounts_type_wallet')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-50 text-slate-700 border border-slate-200">
            <CreditCard className="w-3 h-3 text-slate-500" />
            {type}
          </span>
        );
    }
  };

  return (
    <div className="flex-1 p-4 md:p-6 space-y-5 overflow-y-auto max-w-7xl mx-auto w-full">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-black text-slate-900 tracking-tight">
              {t('accounts_title')}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {t('accounts_sub')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t('accounts_add_btn')}</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {t('accounts_total_cards')}
            </p>
            <p className="text-xl font-black text-slate-800 mt-0.5 font-mono">
              {totalAccounts}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Landmark className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
              {t('accounts_cash_cards')}
            </p>
            <p className="text-xl font-black text-emerald-800 mt-0.5 font-mono">
              {cashAccounts}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
              {t('accounts_bank_cards')}
            </p>
            <p className="text-xl font-black text-blue-800 mt-0.5 font-mono">
              {bankAccounts}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
              {t('accounts_wallet_cards')}
            </p>
            <p className="text-xl font-black text-purple-800 mt-0.5 font-mono">
              {walletAccounts}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Smartphone className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
              {t('accounts_total_balance_card')}
            </p>
            <p className="text-xl font-black text-amber-800 mt-0.5 font-mono">
              Rs. {accounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Accounts List & Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Search Bar & Counter */}
        <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('accounts_search_ph')}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
            />
          </div>
          <span className="text-xs text-slate-500 font-semibold font-mono">
            {filtered.length} / {totalAccounts}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                <th className="py-3 px-3 text-center w-12 font-mono">#</th>
                <th className="py-3 px-4">{t('accounts_col_name')}</th>
                <th className="py-3 px-3 text-center">{t('accounts_col_type')}</th>
                <th className="py-3 px-4 text-left font-mono">{t('accounts_col_acc_no')}</th>
                <th className="py-3 px-4">{t('accounts_col_branch')}</th>
                <th className="py-3 px-4 text-left font-mono">{t('accounts_col_balance')}</th>
                <th className="py-3 px-3 text-center">{t('accounts_col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <p className="font-bold text-slate-600 text-sm">{t('accounts_no_accounts')}</p>
                    <p className="text-xs mt-1 text-slate-400">{t('accounts_no_accounts_sub')}</p>
                  </td>
                </tr>
              ) : (
                filtered.map((acc, idx) => (
                  <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{acc.name}</span>
                        {acc.is_default === 1 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                            <ShieldCheck className="w-3 h-3 text-amber-600" />
                            {t('accounts_default_badge')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {getTypeBadge(acc.type)}
                    </td>
                    <td className="py-3 px-4 text-left font-mono font-medium text-slate-600">
                      {acc.account_number || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {acc.branch_name || '-'}
                    </td>
                    <td className="py-3 px-4 text-left whitespace-nowrap font-mono font-bold">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs ${
                        Number(acc.current_balance || 0) > 0 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : Number(acc.current_balance || 0) < 0
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        Rs. {Number(acc.current_balance || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenStatement(acc)}
                          title={isUrdu ? 'بینک لیجر و پاس بک دیکھیں' : 'View Account Ledger / Statement'}
                          className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(acc)}
                          title={t('accounts_edit_btn')}
                          className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {acc.is_default === 1 ? (
                          <button
                            type="button"
                            disabled
                            title={t('accounts_default_cant_delete')}
                            className="p-1.5 text-slate-300 bg-slate-50 rounded-lg cursor-not-allowed opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDelete(acc)}
                            title={t('accounts_delete_btn')}
                            className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                  <Landmark className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  {editingAccount ? t('accounts_modal_edit_title') : t('accounts_modal_add_title')}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={saving}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Account Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {t('accounts_modal_name_label')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('accounts_modal_name_ph')}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Account Type */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {t('accounts_modal_type_label')}
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                >
                  <option value="bank">{t('accounts_type_bank')}</option>
                  <option value="cash">{t('accounts_type_cash')}</option>
                  <option value="wallet">{t('accounts_type_wallet')}</option>
                </select>
              </div>

              {/* Account Number */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {t('accounts_modal_acc_no_label')}
                </label>
                <input
                  type="text"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  placeholder={t('accounts_modal_acc_no_ph')}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden font-mono"
                />
              </div>

              {/* Branch / Institution Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {t('accounts_modal_branch_label')}
                </label>
                <input
                  type="text"
                  value={formData.branch_name}
                  onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                  placeholder={t('accounts_modal_branch_ph')}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Initial / Current Balance */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {t('accounts_modal_balance_label')}
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.current_balance}
                  onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
                  placeholder={t('accounts_modal_balance_ph')}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden font-mono"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                  <span>{saving ? t('accounts_saving') : t('save')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Statement / Passbook Modal */}
      {isStatementOpen && statementAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-sm">
                  {statementAccount.type === 'cash' ? <Wallet className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black tracking-tight">{statementAccount.name}</h3>
                    {getTypeBadge(statementAccount.type)}
                  </div>
                  <p className="text-xs text-blue-100 font-medium">
                    {statementAccount.account_number ? `${isUrdu ? 'کھاتہ نمبر: ' : 'A/C: '}${statementAccount.account_number}` : ''}
                    {statementAccount.branch_name ? ` • ${statementAccount.branch_name}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handlePrintStatement}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title={isUrdu ? 'اسٹیٹمنٹ پرنٹ کریں' : 'Print Statement'}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isUrdu ? 'پرنٹ' : 'Print'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseStatement}
                  className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {loadingStatement ? (
                <div className="py-20 text-center text-slate-400">
                  <div className="inline-block w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-2 text-xs font-medium text-slate-500">{isUrdu ? 'بینک اسٹیٹمنٹ لوڈ ہو رہی ہے...' : 'Loading account statement...'}</p>
                </div>
              ) : statementError ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{statementError}</span>
                </div>
              ) : statementData ? (
                <>
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Opening Balance */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-500 block">{isUrdu ? 'ابتدائی بیلنس' : 'Opening Balance'}</span>
                      <span className="text-sm font-mono font-bold text-slate-700 mt-1 block">
                        Rs. {Number(statementData.summary?.opening_balance || 0).toLocaleString('en-PK')}
                      </span>
                    </div>

                    {/* Total Inflow */}
                    <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-800">{isUrdu ? 'کل جمع / موصول' : 'Total Inflow'}</span>
                        <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <span className="text-sm font-mono font-black text-emerald-700 mt-1 block">
                        +Rs. {Number(statementData.summary?.total_inflow || 0).toLocaleString('en-PK')}
                      </span>
                    </div>

                    {/* Total Outflow */}
                    <div className="bg-rose-50/70 p-3.5 rounded-xl border border-rose-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-rose-800">{isUrdu ? 'کل ادا / نکلوائی' : 'Total Outflow'}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                      </div>
                      <span className="text-sm font-mono font-black text-rose-700 mt-1 block">
                        -Rs. {Number(statementData.summary?.total_outflow || 0).toLocaleString('en-PK')}
                      </span>
                    </div>

                    {/* Current Balance */}
                    <div className={`p-3.5 rounded-xl border ${
                      Number(statementData.summary?.current_balance || 0) >= 0
                        ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                        : 'bg-rose-100/70 border-rose-300 text-rose-900'
                    }`}>
                      <span className="text-[11px] font-bold block">{isUrdu ? 'موجودہ خالص بیلنس' : 'Current Balance'}</span>
                      <span className="text-base font-mono font-black mt-1 block">
                        Rs. {Number(statementData.summary?.current_balance || 0).toLocaleString('en-PK')}
                      </span>
                    </div>
                  </div>

                  {/* Statement Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <div className="px-4 py-2.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span>{isUrdu ? 'تمام ٹرانزیکشنز و کھاتہ جات (Reconciled Transactions)' : 'Transaction History & Reconciled Entries'}</span>
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono font-semibold">
                        {statementData.entries?.length || 0} {isUrdu ? 'انٹریز' : 'Entries'}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                            <th className="py-2.5 px-3 text-center w-10 font-mono">#</th>
                            <th className="py-2.5 px-3">{isUrdu ? 'تاریخ و وقت' : 'Date & Time'}</th>
                            <th className="py-2.5 px-3 font-mono">{isUrdu ? 'واؤچر نمبر' : 'Voucher #'}</th>
                            <th className="py-2.5 px-3">{isUrdu ? 'پارٹی / کسٹمر و تفصیل' : 'Party & Description'}</th>
                            <th className="py-2.5 px-3 text-left font-mono text-emerald-700">{isUrdu ? 'آمدن / جمع (+)' : 'Inflow (+)'}</th>
                            <th className="py-2.5 px-3 text-left font-mono text-rose-700">{isUrdu ? 'ادائیگی / منہا (-)' : 'Outflow (-)'}</th>
                            <th className="py-2.5 px-3 text-left font-mono">{isUrdu ? 'باقی بیلنس' : 'Balance'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                          {/* Opening Balance Row if non-zero */}
                          {Number(statementData.summary?.opening_balance || 0) !== 0 && (
                            <tr className="bg-slate-50/50 font-semibold text-slate-600">
                              <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">•</td>
                              <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                                {statementData.account?.created_at ? new Date(statementData.account.created_at).toLocaleDateString('en-PK') : '-'}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">OPENING</td>
                              <td className="py-2.5 px-3 text-slate-700 font-bold">
                                {isUrdu ? 'ابتدائی اوپننگ بیلنس (Initial Opening Balance)' : 'Initial Opening Balance'}
                              </td>
                              <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-600">
                                {Number(statementData.summary?.opening_balance) > 0 ? `Rs. ${Number(statementData.summary?.opening_balance).toLocaleString('en-PK')}` : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-600">
                                {Number(statementData.summary?.opening_balance) < 0 ? `Rs. ${Math.abs(Number(statementData.summary?.opening_balance)).toLocaleString('en-PK')}` : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-900">
                                Rs. {Number(statementData.summary?.opening_balance).toLocaleString('en-PK')}
                              </td>
                            </tr>
                          )}

                          {(!statementData.entries || statementData.entries.length === 0) ? (
                            <tr>
                              <td colSpan="7" className="py-8 text-center text-slate-400">
                                <p className="font-semibold text-xs">{isUrdu ? 'اس اکاؤنٹ میں ابھی تک کوئی ٹرانزیکشن درج نہیں ہے۔' : 'No transactions recorded for this account yet.'}</p>
                              </td>
                            </tr>
                          ) : (
                            statementData.entries.map((entry, idx) => (
                              <tr key={entry.id || idx} className="hover:bg-blue-50/40 transition-colors">
                                <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                                  {entry.created_at ? new Date(entry.created_at).toLocaleString('en-PK', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                  }) : '-'}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-blue-700">
                                  <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200">
                                    {entry.reference_no || '-'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="space-y-0.5">
                                    {entry.party_name ? (
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                                          entry.party_type === 'supplier'
                                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        }`}>
                                          {entry.party_type === 'supplier' ? <Truck className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                                          <span>{entry.party_type === 'supplier' ? (isUrdu ? 'سپلائر' : 'Supplier') : (isUrdu ? 'گاہک' : 'Customer')}</span>
                                        </span>
                                        <span className="font-bold text-slate-900">{entry.party_name}</span>
                                        {entry.party_phone && (
                                          <span className="text-[11px] text-slate-400 font-mono">({entry.party_phone})</span>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="font-semibold text-slate-800">{entry.description}</div>
                                    )}
                                    {entry.party_notes && (
                                      <div className="text-[11px] text-slate-500 font-medium italic">
                                        "{entry.party_notes}"
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-left whitespace-nowrap font-mono font-bold text-emerald-700">
                                  {Number(entry.debit) > 0 ? (
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200">
                                      +Rs. {Number(entry.debit).toLocaleString('en-PK')}
                                    </span>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-left whitespace-nowrap font-mono font-bold text-rose-700">
                                  {Number(entry.credit) > 0 ? (
                                    <span className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200">
                                      -Rs. {Number(entry.credit).toLocaleString('en-PK')}
                                    </span>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-left whitespace-nowrap font-mono font-black text-slate-900">
                                  <span className={`px-2 py-0.5 rounded-md ${
                                    Number(entry.balance_after) >= 0 ? 'bg-slate-100' : 'bg-rose-50 text-rose-800 border border-rose-200'
                                  }`}>
                                    Rs. {Number(entry.balance_after).toLocaleString('en-PK')}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 font-medium">
                {isUrdu ? 'یہ اسٹیٹمنٹ خودبخود گاہک و سپلائر کے لیجر سے ٹیلی ہے' : 'Reconciled automatically with Customer & Supplier Ledgers'}
              </span>
              <button
                type="button"
                onClick={handleCloseStatement}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
