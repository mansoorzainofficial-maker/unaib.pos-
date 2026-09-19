import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Loader2, Users, User, Phone, MapPin, Wallet } from 'lucide-react';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function CustomerForm({
  isOpen,
  onClose,
  customer = null, // If editing, existing customer object
  onSuccess
}) {
  const { t, isUrdu } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    opening_balance: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        address: customer.address || '',
        opening_balance: customer.current_balance || customer.opening_balance || 0
      });
    } else {
      setFormData({
        name: '',
        phone: '',
        address: '',
        opening_balance: 0
      });
    }
    setErrorMsg('');
  }, [customer, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.name.trim()) {
      setErrorMsg(t('customer_err_name_required'));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.invoices.createCustomer({
        name: formData.name.trim(),
        phone: formData.phone ? formData.phone.trim() : '',
        address: formData.address ? formData.address.trim() : '',
        opening_balance: Number(formData.opening_balance) || 0
      });

      if (res && res.success) {
        const savedCustomer = res.customer || {
          id: res.customerId || Date.now(),
          name: formData.name.trim(),
          phone: formData.phone ? formData.phone.trim() : '',
          address: formData.address ? formData.address.trim() : '',
          current_balance: Number(formData.opening_balance) || 0
        };
        if (onSuccess) {
          onSuccess(savedCustomer, customer ? 'updated' : 'created');
        }
        onClose();
      } else {
        throw new Error(res?.message || 'Failed to save customer');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header matching SupplierForm */}
        <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">
                {customer ? t('customer_modal_title_edit') : t('customer_modal_title_new')}
              </h3>
              <p className="text-[11px] text-blue-100 font-medium">{t('customer_modal_sub')}</p>
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

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          {/* Customer / Party Name */}
          <div>
            <label className="block font-bold text-slate-800 mb-1 flex items-center justify-between">
              <span>{t('customer_field_name')}</span>
              <span className="text-[10px] text-rose-600 font-bold">* لازمی</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                required
                autoFocus
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('customer_ph_name')}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Mobile Phone */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">{t('customer_field_phone')}</label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder={t('customer_ph_phone')}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Opening Balance / Previous Udhar */}
          <div>
            <label className="block font-bold text-slate-800 mb-1 flex items-center justify-between">
              <span>{t('customer_field_opening_balance')}</span>
              <span className="text-[10px] text-slate-400">اگر پہلے سے کوئی ادھار ہو</span>
            </label>
            <div className="relative">
              <Wallet className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="number"
                min="0"
                step="any"
                value={formData.opening_balance}
                onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                placeholder={t('customer_ph_opening_balance')}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Address / Market */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">{t('customer_field_address')}</label>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <textarea
                rows="2"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder={t('customer_ph_address')}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
            >
              {t('customer_btn_cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl shadow-md shadow-blue-600/20 flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('customer_saving')}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('customer_btn_save_new')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
