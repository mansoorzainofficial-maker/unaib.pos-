import React, { useState, useEffect } from 'react';
import { Building, Plus, Search, Phone, Mail, MapPin, Edit, Trash2, BookOpen, AlertCircle } from 'lucide-react';
import { supplierApi } from '../services/supplierApi';
import { ledgerApi } from '../services/ledgerApi';
import { useLanguage } from '../context/LanguageContext';
import SupplierForm from '../components/SupplierForm';

export default function Suppliers({ onNavigateToLedger }) {
  const { t, isUrdu } = useLanguage();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // Use ledgerApi to get suppliers with real-time calculated balances
      const list = await ledgerApi.getParties('supplier');
      setSuppliers(list);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
      setErrorMsg(err.message || t('suppliers_load_err'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingSupplier(null);
    setIsModalOpen(true);
  };

  const handleEdit = (sup) => {
    setEditingSupplier(sup);
    setIsModalOpen(true);
  };

  const handleDelete = async (sup) => {
    const confirmPrompt = isUrdu 
      ? `کیا آپ واقعی سپلائر "${sup.name}" کو ڈیلیٹ کرنا چاہتے ہیں؟`
      : `Are you sure you want to delete supplier "${sup.name}"?`;

    if (!window.confirm(confirmPrompt)) {
      return;
    }

    try {
      await supplierApi.delete(sup.id);
      setSuccessMsg(isUrdu 
        ? `سپلائر "${sup.name}" کامیابی سے ڈیلیٹ ہو گیا۔`
        : `Supplier "${sup.name}" deleted successfully.`
      );
      setTimeout(() => setSuccessMsg(''), 4000);
      loadSuppliers();
    } catch (err) {
      alert(err.message || t('suppliers_delete_err'));
    }
  };

  const handleFormSuccess = (savedSup, action) => {
    setSuccessMsg(action === 'created' ? t('suppliers_created_success') : t('suppliers_updated_success'));
    setTimeout(() => setSuccessMsg(''), 4000);
    loadSuppliers();
  };

  const filtered = suppliers.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (s.name || '').toLowerCase().includes(q) || (s.phone || '').includes(q) || (s.contact_person || '').toLowerCase().includes(q);
  });

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-tight">{t('suppliers_page_title')}</h1>
            <p className="text-xs text-slate-500 font-medium">{t('suppliers_page_sub')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCreate}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('suppliers_add_btn')}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold animate-in fade-in">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Search and Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('suppliers_search_placeholder')}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
            />
          </div>
          <span className="text-xs text-slate-500 font-semibold font-mono">
            {filtered.length} {t('suppliers_count_badge')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                <th className="py-2.5 px-3 text-center w-12">#</th>
                <th className="py-2.5 px-3">{t('suppliers_col_name')}</th>
                <th className="py-2.5 px-3">{t('suppliers_col_contact')}</th>
                <th className="py-2.5 px-3">{t('suppliers_col_phone')}</th>
                <th className="py-2.5 px-4 text-left">{t('suppliers_col_address')}</th>
                <th className="py-2.5 px-4 text-left font-black">{t('suppliers_col_due_balance')}</th>
                <th className="py-2.5 px-3 text-center">{t('suppliers_col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-10 text-center text-slate-400">{t('suppliers_loading')}</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-10 text-center text-slate-400">{t('suppliers_not_found')}</td>
                </tr>
              ) : (
                filtered.map((sup, idx) => {
                  const due = Number(sup.current_balance || 0);

                  return (
                    <tr key={sup.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{sup.name}</td>
                      <td className="py-3 px-3 text-slate-600">{sup.contact_person || '-'}</td>
                      <td className="py-3 px-3 font-mono text-slate-700">{sup.phone || '-'}</td>
                      <td className="py-3 px-4 text-left text-slate-500 max-w-[200px] truncate">{sup.address || '-'}</td>
                      <td className="py-3 px-4 text-left font-mono font-black text-sm whitespace-nowrap">
                        <span className={due > 0 ? 'text-amber-700 font-black' : due < 0 ? 'text-emerald-700 font-black' : 'text-slate-400'}>
                          Rs. {Math.abs(due).toLocaleString()}{' '}
                          <span className="text-[10px] font-bold">
                            {due > 0 ? t('suppliers_badge_due') : due < 0 ? t('suppliers_badge_advance') : t('suppliers_badge_settled')}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1.5">
                          {onNavigateToLedger && (
                            <button
                              onClick={() => onNavigateToLedger(sup.id)}
                              title={t('suppliers_btn_ledger')}
                              className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(sup)}
                            title={t('suppliers_btn_edit')}
                            className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(sup)}
                            title={t('suppliers_btn_delete')}
                            className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      </div>

      <SupplierForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        supplier={editingSupplier}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
