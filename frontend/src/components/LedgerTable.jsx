import React, { useState } from 'react';
import { Search, FileText, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function LedgerTable({
  entries = [],
  partyType = 'supplier', // 'supplier' or 'client'
  partyName = '',
  onDeletePayment
}) {
  const { t, isUrdu, getEntryTypeBadge, formatAccountName } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEntries = entries.filter(en => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const ref = (en.reference_no || '').toLowerCase();
    const desc = (en.description || '').toLowerCase();
    const acc = (en.account_name || '').toLowerCase();
    const date = (en.entry_date || '').toLowerCase();
    return ref.includes(q) || desc.includes(q) || acc.includes(q) || date.includes(q);
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Table Controls Header */}
      <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-slate-800">
            {t('statement_of')} <span className="text-emerald-800 font-extrabold">{partyName || '-'}</span>
          </span>
          <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md font-mono font-semibold">
            {filteredEntries.length} {t('records_count')}
          </span>
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('search_entries_placeholder')}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Simplified, Clean Table Layout: Date | Type | Description & Ref | Account | Debit | Credit | Balance | Action */}
      <div className="overflow-x-auto">
        <table className={`w-full text-xs ${isUrdu ? 'text-right' : 'text-left'}`}>
          <thead className="sticky top-0 z-10 bg-slate-100 shadow-xs">
            <tr className="bg-slate-100/95 backdrop-blur-xs text-slate-700 font-bold border-b border-slate-200">
              <th className="py-2.5 px-3 whitespace-nowrap">{t('col_date')}</th>
              <th className="py-2.5 px-3 whitespace-nowrap">{t('col_type')}</th>
              <th className="py-2.5 px-4">{isUrdu ? 'تفصیل و ریفرنس' : 'Description & Reference'}</th>
              <th className="py-2.5 px-3 whitespace-nowrap">{t('col_account')}</th>
              <th className="py-2.5 px-3 whitespace-nowrap">{t('col_debit')}</th>
              <th className="py-2.5 px-3 whitespace-nowrap">{t('col_credit')}</th>
              <th className="py-2.5 px-4 whitespace-nowrap font-black">{t('col_balance')}</th>
              <th className="py-2.5 px-3 text-center whitespace-nowrap">{isUrdu ? 'کارروائی' : 'Action'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-12 text-center text-slate-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300 opacity-60" />
                  <p className="font-semibold text-sm text-slate-600">{t('no_entries_title')}</p>
                  <p className="text-[11px] mt-1 text-slate-400">{t('no_entries_hint')}</p>
                </td>
              </tr>
            ) : (
              filteredEntries.map((en, idx) => {
                const badge = getEntryTypeBadge(en.entry_type);
                const runningBal = Number(en.running_balance || 0);
                const accountDisplay = formatAccountName(en.account_name);

                return (
                  <tr key={en.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    {/* 1. Date */}
                    <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                      {en.entry_date}
                    </td>

                    {/* 2. Type (Consistent Colored Badge) */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.bg}`}>
                        {badge.label}
                      </span>
                    </td>

                    {/* 3. Description & Clean Reference (No REF-- placeholder) */}
                    <td className="py-2.5 px-4 max-w-[280px]">
                      <div className="font-medium text-slate-800 truncate" title={en.description}>
                        {en.description || '-'}
                      </div>
                      {en.reference_no && (
                        <div className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">
                          #{en.reference_no}
                        </div>
                      )}
                    </td>

                    {/* 4. Account (Clean without ugly bilingual parentheses) */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {en.account_name ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {en.account_type === 'bank' ? '🏦' : '💵'} {accountDisplay}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>

                    {/* 5. Debit */}
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {Number(en.debit) > 0 ? (
                        <span className="text-rose-600">Rs. {Number(en.debit).toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* 6. Credit */}
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {Number(en.credit) > 0 ? (
                        <span className="text-emerald-600">Rs. {Number(en.credit).toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* 7. Running Balance */}
                    <td className="py-2.5 px-4 font-mono font-black whitespace-nowrap text-sm">
                      <span className={runningBal > 0 ? 'text-amber-700' : runningBal < 0 ? 'text-emerald-700' : 'text-slate-600'}>
                        Rs. {Math.abs(runningBal).toLocaleString()}{' '}
                        <span className="text-[10px] font-bold">
                          {runningBal > 0
                            ? (partyType === 'supplier' ? (isUrdu ? 'واجب الادا' : 'Cr') : (isUrdu ? 'ادھار' : 'Dr'))
                            : runningBal < 0
                            ? (isUrdu ? 'ایڈوانس' : 'Adv')
                            : (isUrdu ? 'صاف' : 'NIL')}
                        </span>
                      </span>
                    </td>

                    {/* 8. Action (Void / Delete for payment vouchers) */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {['payment', 'payment_received', 'payment_made'].includes(en.entry_type) && onDeletePayment ? (
                        <button
                          type="button"
                          onClick={() => onDeletePayment(en)}
                          title={isUrdu ? "یہ پیمنٹ واؤچر منسوخ / ڈیلیٹ کریں" : "Void / Delete this payment voucher"}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>{isUrdu ? 'منسوخ' : 'Void'}</span>
                        </button>
                      ) : (
                        <span className="text-slate-300 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
