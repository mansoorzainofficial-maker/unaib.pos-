import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, Eye, X, FileText, Calendar, DollarSign, Package } from 'lucide-react';
import { grnApi } from '../services/grnApi';
import { useLanguage } from '../context/LanguageContext';

export default function GrnList({ onNavigateToCreate }) {
  const { t, isUrdu } = useLanguage();
  const [grns, setGrns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedGrn, setSelectedGrn] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

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
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(g.id);
                        }}
                        title={t('grn_view_btn')}
                        className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
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

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedGrn(null)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  {t('grn_close_btn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
