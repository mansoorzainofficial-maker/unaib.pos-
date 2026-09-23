import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, Eye, Edit, Trash2, X, FileText, Calendar, DollarSign, Package, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { grnApi } from '../services/grnApi';
import { useLanguage } from '../context/LanguageContext';
import useSubmitGuard from '../hooks/useSubmitGuard';
import ActionButton from '../components/ActionButton';

export default function GrnList({ onNavigateToCreate, onNavigateToEdit }) {
  const { t, isUrdu } = useLanguage();
  const [grns, setGrns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedGrn, setSelectedGrn] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Delete modal state
  const [deletingGrn, setDeletingGrn] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  // Status notifications
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadGrns();
  }, []);

  const loadGrns = async () => {
    setLoading(true);
    try {
      const list = await grnApi.getAll();
      setGrns(list);
    } catch (err) {
      console.error('Failed to load GRNs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const detail = await grnApi.getById(id);
      setSelectedGrn(detail);
    } catch (err) {
      alert(err.message || t('grn_detail_load_err'));
    } finally {
      setLoadingDetail(false);
    }
  };

  const [handleConfirmDelete, isDeletingGuard] = useSubmitGuard(async () => {
    if (!deletingGrn) return;
    setIsDeleting(true);
    setErrorMsg('');
    try {
      const res = await grnApi.delete(deletingGrn.id, {
        allow_negative_stock: allowNegativeStock,
        reason: deleteReason.trim() || 'Deleted by user from GRN List'
      });
      setSuccessMsg(isUrdu
        ? `✓ رسید #${deletingGrn.grn_number} کامیابی سے منسوخ ہو گئی! انوینٹری اسٹاک خودکار کٹ گیا۔`
        : `✓ GRN #${deletingGrn.grn_number} deleted successfully! Inventory stock automatically deducted.`
      );
      setDeletingGrn(null);
      if (selectedGrn?.id === deletingGrn.id) setSelectedGrn(null);
      await loadGrns();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Delete GRN error:', err);
      setErrorMsg(err.message || (isUrdu ? 'GRN منسوخ کرنے میں خرابی پیش آئی' : 'Failed to delete GRN'));
    } finally {
      setIsDeleting(false);
    }
  }, { cooldownMs: 1200 });

  const filtered = grns.filter(g => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (g.grn_number || '').toLowerCase().includes(q) ||
           (g.supplier_name || '').toLowerCase().includes(q) ||
           (g.received_date || '').includes(q);
  });

  return (
    <div className="flex-1 w-full h-full overflow-y-auto bg-slate-100 p-4 select-text">
      <div className="max-w-7xl mx-auto space-y-4 pb-16">
        {/* Notifications */}
        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-800 text-xs font-bold flex items-center space-x-2 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl text-rose-800 text-xs font-bold flex items-center space-x-2 shadow-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 font-black">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-tight">{t('grn_list_title')}</h1>
            <p className="text-xs text-slate-500 font-medium">{t('grn_list_sub')}</p>
          </div>
        </div>

        {onNavigateToCreate && (
          <button
            onClick={onNavigateToCreate}
            className="flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('grn_new_btn')}</span>
          </button>
        )}
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('grn_search_placeholder')}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:border-amber-500 focus:outline-hidden"
            />
          </div>
          <span className="font-bold text-slate-500 font-mono">
            {filtered.length} {t('grn_records_count')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                <th className="py-2.5 px-3 text-center w-12">#</th>
                <th className="py-2.5 px-3">{t('grn_col_number')}</th>
                <th className="py-2.5 px-3">{t('grn_col_supplier')}</th>
                <th className="py-2.5 px-3">{t('grn_col_date')}</th>
                <th className="py-2.5 px-3 text-center">{t('grn_col_items_count')}</th>
                <th className="py-2.5 px-3 text-left">{t('grn_col_total')}</th>
                <th className="py-2.5 px-3 text-center">{t('grn_col_payment_type')}</th>
                <th className="py-2.5 px-3 text-center">{t('status')}</th>
                <th className="py-2.5 px-3 text-center">{t('grn_col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">{t('grn_loading')}</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300 opacity-60" />
                    <p className="font-semibold text-sm">{t('grn_not_found')}</p>
                  </td>
                </tr>
              ) : (
                filtered.map((g, idx) => (
                  <tr
                    key={g.id}
                    onClick={() => handleOpenDetail(g.id)}
                    className="hover:bg-amber-50/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="py-3 px-3 font-mono font-bold text-amber-900">{g.grn_number}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{g.supplier_name}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{g.received_date}</td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                      {g.total_items} {t('grn_items_badge')} ({g.total_quantity_received} {isUrdu ? 'کل' : 'total'})
                    </td>
                    <td className="py-3 px-3 text-left font-mono font-black text-slate-900 text-sm whitespace-nowrap">
                      Rs. {Number(g.total_amount).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        g.payment_type === 'credit'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}>
                        {g.payment_type === 'credit' ? t('grn_credit_type') : t('grn_cash_type')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {g.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(g.id)}
                          title={t('grn_view_btn')}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {onNavigateToEdit && (
                          <button
                            type="button"
                            onClick={() => onNavigateToEdit(g.id)}
                            title={isUrdu ? 'ترمیم کریں' : 'Edit GRN'}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteReason('');
                            setAllowNegativeStock(false);
                            setDeletingGrn(g);
                          }}
                          title={isUrdu ? 'منسوخ / ڈیلیٹ کریں (اسٹاک خودکار کم ہو گا)' : 'Delete GRN (Auto deduct stock)'}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedGrn && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 flex items-center justify-between">
              <div>
                <h3 className="font-black text-base flex items-center gap-2">
                  <span>{t('grn_view_details_title')}: {selectedGrn.grn_number}</span>
                  <span className="text-xs bg-black/10 px-2 py-0.5 rounded-md font-bold">
                    {selectedGrn.payment_type === 'credit' ? t('grn_credit_type') : t('grn_cash_type')}
                  </span>
                </h3>
                <p className="text-xs font-semibold text-slate-900 mt-0.5">
                  {t('grn_col_supplier')}: {selectedGrn.supplier_name} {selectedGrn.supplier_phone ? `(${selectedGrn.supplier_phone})` : ''}
                </p>
              </div>
              <button
                onClick={() => setSelectedGrn(null)}
                className="text-slate-900 hover:text-slate-950 p-1 rounded-lg hover:bg-black/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Meta Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[10px]">{t('grn_col_date')}</span>
                  <span className="font-mono font-bold text-slate-800">{selectedGrn.received_date}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">{t('grn_detail_total')}</span>
                  <span className="font-mono font-black text-amber-900 text-sm">
                    Rs. {Number(selectedGrn.total_amount).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">{t('grn_notes_label')}</span>
                  <span className="text-slate-700 font-medium">{selectedGrn.notes || (isUrdu ? 'کوئی نہیں' : 'None')}</span>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2">{t('grn_detail_sub')}:</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <th className="py-2 px-3 text-center w-10">{t('grn_col_num')}</th>
                        <th className="py-2 px-3">{t('grn_col_product')}</th>
                        <th className="py-2 px-3 text-center">{t('grn_col_qty_rec')}</th>
                        <th className="py-2 px-3 text-right">{t('grn_col_cost')}</th>
                        <th className="py-2 px-3 text-left">{t('grn_col_total')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {(selectedGrn.items || []).map((it, i) => (
                        <tr key={it.id || i} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-center text-slate-400 font-mono">{i + 1}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">
                            {it.product_name}
                            {it.product_barcode && (
                              <span className="block text-[10px] text-slate-400 font-mono">{it.product_barcode}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">{it.quantity_received}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-700">Rs. {Number(it.unit_cost).toLocaleString()}</td>
                          <td className="py-2 px-3 text-left font-mono font-black text-amber-900">Rs. {Number(it.total_cost).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  {onNavigateToEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        const editId = selectedGrn.id;
                        setSelectedGrn(null);
                        onNavigateToEdit(editId);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition-colors cursor-pointer text-xs shadow-xs"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>{isUrdu ? 'اس رسید میں ترمیم کریں' : 'Edit This GRN'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const g = selectedGrn;
                      setSelectedGrn(null);
                      setDeleteReason('');
                      setAllowNegativeStock(false);
                      setDeletingGrn(g);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl border border-rose-200 transition-colors cursor-pointer text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isUrdu ? 'رسید منسوخ کریں (اسٹاک ریورس)' : 'Delete GRN (Reverse Stock)'}</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedGrn(null)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer text-xs"
                >
                  {t('grn_close_btn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal with Inventory Auto-Deduct Warning */}
      {deletingGrn && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-white" />
                <h3 className="font-black text-sm">
                  {isUrdu ? `رسید منسوخ / ڈیلیٹ کریں (${deletingGrn.grn_number})` : `Delete / Void GRN (${deletingGrn.grn_number})`}
                </h3>
              </div>
              <button
                onClick={() => setDeletingGrn(null)}
                disabled={isDeleting}
                className="text-white/80 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <p className="font-bold text-rose-900">
                  {isUrdu
                    ? '⚠️ انتباہ: یہ رسید منسوخ کرنے سے درج ذیل تبدیلیاں خودکار لاگو ہوں گی:'
                    : '⚠️ Warning: Deleting this GRN will automatically execute the following:'}
                </p>
                <ul className="list-disc list-inside space-y-1 text-rose-800">
                  <li>
                    {isUrdu
                      ? `گودام / شیلف کے اسٹاک سے خریدی گئی کل تعداد (${deletingGrn.total_quantity_received} آئٹمز) خودکار کٹ جائے گی۔`
                      : `Product inventory stock will be automatically deducted by received quantity (${deletingGrn.total_quantity_received} items).`}
                  </li>
                  <li>
                    {isUrdu
                      ? `سپلائر (${deletingGrn.supplier_name}) کا کھاتہ Rs. ${Number(deletingGrn.total_amount).toLocaleString()} سے ریورس ہو جائے گا۔`
                      : `Supplier ledger balance will be reversed by Rs. ${Number(deletingGrn.total_amount).toLocaleString()}.`}
                  </li>
                </ul>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  {isUrdu ? 'منسوخی کی وجہ (اختیاری):' : 'Reason for cancellation (optional):'}
                </label>
                <input
                  type="text"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder={isUrdu ? 'مثلاً: غلط اندراج، مال واپس کیا گیا، وغیرہ' : 'e.g. Returned to vendor, wrong entry'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="allowNegStock"
                  checked={allowNegativeStock}
                  onChange={(e) => setAllowNegativeStock(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                />
                <label htmlFor="allowNegStock" className="text-slate-700 font-semibold cursor-pointer">
                  {isUrdu
                    ? 'اگر مال پہلے ہی فروخت ہو چکا ہو تب بھی اسٹاک منفی (Negative) میں جانے دیں'
                    : 'Force delete even if stock goes negative (items already sold)'}
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeletingGrn(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  {isUrdu ? 'منسوخ نہ کریں' : 'Cancel'}
                </button>
                <ActionButton
                  type="button"
                  onClick={handleConfirmDelete}
                  loading={isDeleting || isDeletingGuard}
                  loadingText={isUrdu ? 'اسٹاک کٹ رہا ہے...' : 'Deducting Stock...'}
                  variant="danger"
                  icon={Trash2}
                  className="px-5 py-2 font-bold rounded-xl shadow-md shadow-rose-600/20"
                >
                  {isUrdu ? 'ہاں، رسید منسوخ اور اسٹاک کم کریں' : 'Yes, Delete & Deduct Stock'}
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
