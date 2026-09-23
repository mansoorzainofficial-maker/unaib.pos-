import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Loader2, Wallet } from 'lucide-react';
import { ledgerApi } from '../services/ledgerApi';
import { useLanguage } from '../context/LanguageContext';
import { useSubmitGuard } from '../hooks/useSubmitGuard';
import ActionButton from './ActionButton';

export default function PaymentForm({
  isOpen,
  onClose,
  partyType = 'supplier', // 'supplier' or 'client'
  party,
  onSuccess
}) {
  const { t, isUrdu, formatAccountName } = useLanguage();
  const [isGuarded, guardSubmit] = useSubmitGuard(1500);
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load available payment accounts
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      loadAccounts();
    }
  }, [isOpen]);

  const loadAccounts = async () => {
    try {
      const list = await ledgerApi.getAccounts();
      setAccounts(list);
      const defaultAcc = list.find(a => a.is_default) || list[0];
      if (defaultAcc && !accountId) {
        setAccountId(defaultAcc.id);
      }
    } catch (err) {
      console.error('Failed to load accounts:', err);
      setErrorMsg(isUrdu ? 'اکاؤنٹس لوڈ کرنے میں ناکامی: ' + err.message : 'Failed to load accounts: ' + err.message);
    }
  };

  if (!isOpen || !party) return null;

  const currentDue = Number(party.current_balance || 0);
  const numAmount = Number(amount) || 0;
  const isOverpaying = currentDue > 0 && numAmount > currentDue;
  const isSupplier = partyType === 'supplier';

  const handleSubmit = guardSubmit(async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Strict Frontend Validation
    if (!accountId) {
      setErrorMsg(t('err_select_account'));
      return;
    }

    if (!numAmount || numAmount <= 0) {
      setErrorMsg(t('err_invalid_amount'));
      return;
    }

    if (!entryDate) {
      setErrorMsg(t('err_date_required'));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        party_type: partyType,
        party_id: party.id,
        account_id: Number(accountId),
        amount: numAmount,
        entry_date: entryDate,
        notes: notes.trim() || null
      };

      const res = await ledgerApi.recordPayment(payload);
      if (res.success && res.statement) {
        // Reset form
        setAmount('');
        setNotes('');
        onSuccess(res.statement);
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.message || (isUrdu ? 'ادائیگی درج کرنے میں خرابی پیش آگئی۔' : 'Error recording payment.'));
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">
                {isSupplier ? t('pay_modal_supplier') : t('pay_modal_client')}
              </h3>
              <p className="text-[11px] text-emerald-100 font-medium">
                {party.name} {party.phone ? `(${party.phone})` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Party Balance Snapshot */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
            <span className="text-slate-600 font-semibold">{t('current_due_label')}</span>
            <span className={`font-mono text-sm font-black ${currentDue > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              Rs. {Math.abs(currentDue).toLocaleString()}{' '}
              <span className="text-[10px] font-bold">
                {currentDue > 0 ? (isSupplier ? (isUrdu ? '(واجب الادا)' : '(Payable)') : (isUrdu ? '(ادھار)' : '(Receivable)')) : (isUrdu ? '(صاف)' : '(NIL)')}
              </span>
            </span>
          </div>

          {/* Account Selection (MANDATORY) */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5 flex items-center justify-between">
              <span>{t('account_select_label')}</span>
              <span className="text-[10px] text-rose-600 font-semibold">{t('required_field')}</span>
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-semibold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-hidden text-xs"
            >
              <option value="">{t('select_account_option')}</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.type === 'cash' ? '💵 ' : '🏦 '} {formatAccountName(acc.name)} {acc.account_number ? `(${acc.account_number})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Amount Field */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5 flex items-center justify-between">
              <span>{t('pay_amount_label')}</span>
              {currentDue > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(Math.abs(currentDue)))}
                  className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer"
                >
                  {t('full_amount_quick')} (Rs. {Math.abs(currentDue).toLocaleString()})
                </button>
              )}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold font-mono">Rs.</span>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t('amount_placeholder')}
                className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono text-sm font-black focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Overpayment Warning */}
          {isOverpaying && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start space-x-2.5 text-amber-900 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-bold">{t('overpaying_notice_title')} </span>
                <span>{t('overpaying_notice_body')}</span>
              </div>
            </div>
          )}

          {/* Date Picker */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5">{t('pay_date_label')}</label>
            <div className="relative">
              <input
                type="date"
                required
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-semibold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Notes / Description */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5">{t('notes_label')}</label>
            <textarea
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notes_placeholder')}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-hidden"
            />
          </div>

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center justify-between">
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isGuarded || isSubmitting}
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
            >
              {t('cancel')}
            </button>
            <ActionButton
              type="submit"
              isSubmitting={isGuarded || isSubmitting}
              loadingText={t('saving_voucher')}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('btn_save_voucher')}</span>
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}
