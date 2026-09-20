import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Modal from '../components/Modal';
import { useLanguage } from '../context/LanguageContext';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  CheckCircle,
  Clock,
  User,
  Phone,
  FileText,
  AlertCircle,
  Truck,
  RotateCcw,
  Plus
} from 'lucide-react';

export default function WarrantyScreen() {
  const { isUrdu } = useLanguage();
  const [activeTab, setActiveTab] = useState('lookup'); // 'lookup', 'claims', 'serials'

  // Serial Lookup state
  const [lookupQuery, setLookupQuery] = useState('');
  const [searchedSerial, setSearchedSerial] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // RMA Claims state
  const [claims, setClaims] = useState([]);
  const [claimStatusFilter, setClaimStatusFilter] = useState('');
  const [isNewClaimOpen, setIsNewClaimOpen] = useState(false);
  const [claimIssue, setClaimIssue] = useState('');
  const [claimNotes, setClaimNotes] = useState('');

  // Update claim modal
  const [editingClaim, setEditingClaim] = useState(null);
  const [updatedStatus, setUpdatedStatus] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // All Serials list state
  const [serials, setSerials] = useState([]);
  const [serialFilterStatus, setSerialFilterStatus] = useState('');

  useEffect(() => {
    if (activeTab === 'claims') {
      loadClaims();
    } else if (activeTab === 'serials') {
      loadSerials();
    }
  }, [activeTab, claimStatusFilter, serialFilterStatus]);

  const handleLookup = async (e) => {
    if (e) e.preventDefault();
    const sn = lookupQuery.trim();
    if (!sn) return;

    setLookupLoading(true);
    setLookupError('');
    setSearchedSerial(null);

    try {
      const res = await api.warranty.lookupSerial(sn);
      if (res.success && res.serial) {
        setSearchedSerial(res.serial);
      }
    } catch (err) {
      setLookupError(err.message || `No record found for Serial Number "${sn}"`);
    } finally {
      setLookupLoading(false);
    }
  };

  const loadClaims = async () => {
    try {
      const res = await api.warranty.getClaims({ status: claimStatusFilter || undefined });
      if (res.success) setClaims(res.claims);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSerials = async () => {
    try {
      const res = await api.warranty.getSerials({ status: serialFilterStatus || undefined });
      if (res.success) setSerials(res.serials);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateClaim = async (e) => {
    e.preventDefault();
    if (!searchedSerial || !claimIssue) return;

    try {
      const res = await api.warranty.createClaim({
        serial_number_id: searchedSerial.id,
        issue_description: claimIssue,
        notes: claimNotes
      });

      if (res.success) {
        setIsNewClaimOpen(false);
        setClaimIssue('');
        setClaimNotes('');
        // Refresh lookup
        handleLookup();
      }
    } catch (err) {
      alert(err.message || 'Failed to create claim');
    }
  };

  const handleUpdateClaimStatus = async (e) => {
    e.preventDefault();
    if (!editingClaim) return;

    try {
      const res = await api.warranty.updateClaim(editingClaim.id, {
        status: updatedStatus,
        resolution_notes: resolutionNotes
      });
      if (res.success) {
        setEditingClaim(null);
        loadClaims();
      }
    } catch (err) {
      alert(err.message || 'Failed to update claim');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-slate-100 text-slate-800 p-4 space-y-4 select-text">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            {isUrdu ? 'وارنٹی اور سیریل نمبر ٹریکنگ سسٹم' : 'Warranty & Serial Number Tracking'}
          </h2>
          <p className="text-xs text-slate-500">
            {isUrdu
              ? 'کمپیوٹر پرزوں کے سیریل نمبر، بل کی تصدیق، وارنٹی کی مدت اور کلیمز (RMA) کا انتظام'
              : 'Verify component serial numbers, customer invoice linkage, warranty expiration, and manage RMA claims'}
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs">
          <button
            onClick={() => setActiveTab('lookup')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
              activeTab === 'lookup' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isUrdu ? 'سیریل نمبر تصدیق' : 'Serial Lookup'}
          </button>
          <button
            onClick={() => setActiveTab('claims')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
              activeTab === 'claims' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isUrdu ? 'وارنٹی کلیمز' : 'RMA Claims'} ({claims.length})
          </button>
          <button
            onClick={() => setActiveTab('serials')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
              activeTab === 'serials' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isUrdu ? 'تمام رجسٹرڈ سیریلز' : 'All Registered Serials'}
          </button>
        </div>
      </div>

      {/* TAB 1: SERIAL NUMBER LOOKUP */}
      {activeTab === 'lookup' && (
        <div className="flex-1 flex flex-col space-y-4 overflow-y-auto">
          {/* Search Box */}
          <form onSubmit={handleLookup} className="flex gap-2 max-w-xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                placeholder={isUrdu ? "بار کوڈ اسکین کریں یا سیریل نمبر لکھیں (مثلاً SN-SAM-980P-00101)..." : "Scan component barcode or type Serial Number (e.g. SN-SAM-980P-00101)..."}
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={lookupLoading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              {lookupLoading ? (isUrdu ? 'چیکنگ جاری...' : 'Checking...') : (isUrdu ? 'سیریل تصدیق کریں' : 'Verify S/N')}
            </button>
          </form>

          {lookupError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2 max-w-xl">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{lookupError}</span>
            </div>
          )}

          {/* Searched Serial Result Card */}
          {searchedSerial && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 max-w-2xl shadow-xs">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    {isUrdu ? 'پرزے کا سیریل نمبر' : 'Component Serial'}
                  </span>
                  <h3 className="text-lg font-mono font-bold text-emerald-700">{searchedSerial.serial_number}</h3>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{searchedSerial.product_name}</p>
                </div>

                {/* Status Badge */}
                <div className="text-right">
                  {searchedSerial.status === 'in_stock' ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      {isUrdu ? 'اسٹاک میں موجود (غیر فروخت شدہ)' : 'In Stock (Unsold)'}
                    </span>
                  ) : searchedSerial.isWarrantyValid ? (
                    <div className="flex flex-col items-end">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> {isUrdu ? 'وارنٹی فعال ہے' : 'Warranty Active'}
                      </span>
                      <span className="text-[10px] text-emerald-700 mt-1 font-mono font-bold">
                        {searchedSerial.daysRemaining} {isUrdu ? 'دن باقی ہیں' : 'days remaining'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {isUrdu ? 'وارنٹی ختم ہو چکی ہے' : 'Warranty Expired'}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1">
                        {isUrdu ? `${Math.abs(searchedSerial.daysRemaining)} دن پہلے ختم ہوئی` : `Expired ${Math.abs(searchedSerial.daysRemaining)} days ago`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-500 font-medium">{isUrdu ? 'انوائس / بل نمبر:' : 'Invoice Number:'}</span>
                  <div className="font-mono font-bold text-slate-900">
                    {searchedSerial.invoice_number || (isUrdu ? '— (اسٹاک میں ہے)' : '— (In Stock)')}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 font-medium">{isUrdu ? 'فروخت کی تاریخ:' : 'Sale Date:'}</span>
                  <div className="text-slate-800 font-mono">
                    {searchedSerial.sold_date ? new Date(searchedSerial.sold_date).toLocaleDateString() : '—'}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 font-medium">{isUrdu ? 'گاہک / خریدار:' : 'Customer:'}</span>
                  <div className="text-slate-900 font-semibold flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {(searchedSerial.customer_name === 'Walk-in Customer' || !searchedSerial.customer_name) ? (isUrdu ? 'عام واک ان گاہک' : 'Walk-in Customer') : searchedSerial.customer_name}
                  </div>
                  {searchedSerial.customer_phone && (
                    <div className="text-slate-500 font-mono flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {searchedSerial.customer_phone}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 font-medium">{isUrdu ? 'وارنٹی کے اختتام کی تاریخ:' : 'Warranty Expiration Date:'}</span>
                  <div className="font-mono font-bold text-slate-900">
                    {searchedSerial.warranty_expiry_date ? new Date(searchedSerial.warranty_expiry_date).toLocaleDateString() : '—'}
                  </div>
                </div>
              </div>

              {/* Action: Open RMA Claim */}
              {searchedSerial.status === 'sold' && (
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs text-slate-600">
                    {isUrdu ? 'گاہک نے کسی خرابی یا مسئلے کی شکایت کی ہے؟' : 'Customer reported hardware defect?'}
                  </span>
                  <button
                    onClick={() => setIsNewClaimOpen(true)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isUrdu ? 'وارنٹی کلیم درج کریں' : 'Create Warranty RMA Claim'}</span>
                  </button>
                </div>
              )}

              {/* Past Claim History for this Serial */}
              {searchedSerial.claims && searchedSerial.claims.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-800 mb-2">
                    {isUrdu ? 'وارنٹی کلیمز کی سابقہ تاریخچہ:' : 'Claim / RMA History:'}
                  </h4>
                  <div className="space-y-2">
                    {searchedSerial.claims.map((c) => (
                      <div key={c.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                        <div className="flex justify-between items-center font-mono">
                          <span className="font-bold text-amber-700">{c.claim_number}</span>
                          <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                            {c.status === 'pending' ? (isUrdu ? 'زیرِ جائزہ' : 'pending') :
                             c.status === 'sent_to_vendor' ? (isUrdu ? 'وینڈر کو ارسال' : 'sent to vendor') :
                             c.status === 'repaired' ? (isUrdu ? 'مرمت شدہ' : 'repaired') :
                             c.status === 'replaced' ? (isUrdu ? 'تبدیل شدہ' : 'replaced') :
                             c.status === 'rejected' ? (isUrdu ? 'مسترد' : 'rejected') : c.status}
                          </span>
                        </div>
                        <p className="text-slate-800 mt-1 text-[11px] font-medium">{c.issue_description}</p>
                        {c.resolution_notes && (
                          <p className="text-slate-600 text-[10px] mt-0.5">
                            {isUrdu ? 'فیصلہ / حل:' : 'Resolution:'} {c.resolution_notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RMA WARRANTY CLAIMS */}
      {activeTab === 'claims' && (
        <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-600 font-medium">{isUrdu ? 'حیثیت منتخب کریں:' : 'Filter Status:'}</span>
            {[
              { id: '', label: isUrdu ? 'تمام' : 'ALL' },
              { id: 'pending', label: isUrdu ? 'زیرِ جائزہ' : 'PENDING' },
              { id: 'sent_to_vendor', label: isUrdu ? 'وینڈر کو ارسال' : 'SENT TO VENDOR' },
              { id: 'repaired', label: isUrdu ? 'مرمت شدہ' : 'REPAIRED' },
              { id: 'replaced', label: isUrdu ? 'تبدیل شدہ' : 'REPLACED' },
              { id: 'rejected', label: isUrdu ? 'مسترد' : 'REJECTED' }
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setClaimStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  claimStatusFilter === st.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Claims List Table */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">{isUrdu ? 'کلیم #' : 'RMA #'}</th>
                  <th className="py-2.5 px-2">{isUrdu ? 'سیریل نمبر' : 'Serial Number'}</th>
                  <th className="py-2.5 px-2">{isUrdu ? 'سامان / پرزہ' : 'Component'}</th>
                  <th className="py-2.5 px-2">{isUrdu ? 'گاہک' : 'Customer'}</th>
                  <th className="py-2.5 px-2">{isUrdu ? 'خرابی کی تفصیل' : 'Reported Defect'}</th>
                  <th className="py-2.5 px-2 text-center">{isUrdu ? 'حیثیت' : 'Status'}</th>
                  <th className="py-2.5 pr-3 text-right">{isUrdu ? 'کارروائی' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {claims.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400">
                      {isUrdu ? 'کوئی وارنٹی کلیم موجود نہیں ہے۔' : 'No warranty claims found.'}
                    </td>
                  </tr>
                ) : (
                  claims.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-700">{c.claim_number}</td>
                      <td className="py-2.5 px-2 font-mono text-slate-900 font-semibold">{c.serial_number}</td>
                      <td className="py-2.5 px-2 text-slate-800 font-semibold">{c.product_name}</td>
                      <td className="py-2.5 px-2 text-slate-600">
                        {c.customer_name} {c.customer_phone ? `(${c.customer_phone})` : ''}
                      </td>
                      <td className="py-2.5 px-2 text-slate-700 max-w-xs truncate">{c.issue_description}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          c.status === 'pending'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : c.status === 'sent_to_vendor'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : c.status === 'repaired' || c.status === 'replaced'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {c.status === 'pending' ? (isUrdu ? 'زیرِ جائزہ' : 'pending') :
                           c.status === 'sent_to_vendor' ? (isUrdu ? 'وینڈر کو ارسال' : 'sent to vendor') :
                           c.status === 'repaired' ? (isUrdu ? 'مرمت شدہ' : 'repaired') :
                           c.status === 'replaced' ? (isUrdu ? 'تبدیل شدہ' : 'replaced') :
                           c.status === 'rejected' ? (isUrdu ? 'مسترد' : 'rejected') : c.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <button
                          onClick={() => {
                            setEditingClaim(c);
                            setUpdatedStatus(c.status);
                            setResolutionNotes(c.resolution_notes || '');
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-semibold cursor-pointer"
                        >
                          {isUrdu ? 'اپڈیٹ کریں' : 'Update'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ALL SERIALS */}
      {activeTab === 'serials' && (
        <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-600 font-medium">{isUrdu ? 'حیثیت:' : 'Status:'}</span>
            {[
              { id: '', label: isUrdu ? 'تمام' : 'ALL' },
              { id: 'in_stock', label: isUrdu ? 'اسٹاک میں' : 'IN STOCK' },
              { id: 'sold', label: isUrdu ? 'فروخت شدہ' : 'SOLD' },
              { id: 'rma_claimed', label: isUrdu ? 'کلیم شدہ' : 'RMA CLAIMED' },
              { id: 'returned', label: isUrdu ? 'واپس شدہ' : 'RETURNED' }
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setSerialFilterStatus(st.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  serialFilterStatus === st.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">{isUrdu ? 'سیریل نمبر' : 'Serial Number'}</th>
                  <th className="py-2.5 px-2">{isUrdu ? 'سامان / پرزے کا نام' : 'Component Name'}</th>
                  <th className="py-2.5 px-2">{isUrdu ? 'حیثیت' : 'Status'}</th>
                  <th className="py-2.5 px-2">{isUrdu ? 'انوائس #' : 'Invoice #'}</th>
                  <th className="py-2.5 px-2">{isUrdu ? 'گاہک' : 'Customer'}</th>
                  <th className="py-2.5 pr-3">{isUrdu ? 'وارنٹی میعاد' : 'Warranty Expiry'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {serials.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-mono font-bold text-slate-900">{s.serial_number}</td>
                    <td className="py-2 px-2 text-slate-800 font-semibold">{s.product_name}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        s.status === 'in_stock' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {s.status === 'in_stock' ? (isUrdu ? 'اسٹاک میں' : 'in stock') :
                         s.status === 'sold' ? (isUrdu ? 'فروخت شدہ' : 'sold') :
                         s.status === 'rma_claimed' ? (isUrdu ? 'کلیم شدہ' : 'rma claimed') :
                         s.status === 'returned' ? (isUrdu ? 'واپس شدہ' : 'returned') : s.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-mono text-slate-600">{s.invoice_number || '—'}</td>
                    <td className="py-2 px-2 text-slate-700 font-medium">{s.customer_name || '—'}</td>
                    <td className="py-2 pr-3 font-mono text-slate-600">
                      {s.warranty_expiry_date ? new Date(s.warranty_expiry_date).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE RMA CLAIM MODAL */}
      <Modal
        isOpen={isNewClaimOpen}
        onClose={() => setIsNewClaimOpen(false)}
        title={isUrdu ? `وارنٹی کلیم برائے سیریل: ${searchedSerial?.serial_number}` : `New Warranty Claim for S/N: ${searchedSerial?.serial_number}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateClaim} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isUrdu ? 'خرابی یا نقص کی تفصیل *' : 'Issue / Defect Description *'}
            </label>
            <textarea
              rows="3"
              required
              value={claimIssue}
              onChange={(e) => setClaimIssue(e.target.value)}
              placeholder={isUrdu ? "مثلاً ایس ایس ڈی بائیوس میں ظاہر ہو رہی ہے مگر ونڈوز میں کریش کرتی ہے..." : "e.g. SSD detected in BIOS but crashes Windows under write load. No physical damage."}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isUrdu ? 'اندرونی دکان نوٹس' : 'Internal Notes'}
            </label>
            <input
              type="text"
              value={claimNotes}
              onChange={(e) => setClaimNotes(e.target.value)}
              placeholder={isUrdu ? "گاہک کا ڈبہ اور رسید پاس رکھ لی ہے" : "Customer box and accessories retained"}
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsNewClaimOpen(false)}
              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold"
            >
              {isUrdu ? 'منسوخ' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-md shadow-amber-600/20 cursor-pointer"
            >
              {isUrdu ? 'کلیم درج کریں' : 'Submit RMA Claim'}
            </button>
          </div>
        </form>
      </Modal>

      {/* UPDATE CLAIM STATUS MODAL */}
      <Modal
        isOpen={!!editingClaim}
        onClose={() => setEditingClaim(null)}
        title={isUrdu ? `کلیم کی صورتحال اپڈیٹ کریں: ${editingClaim?.claim_number}` : `Update Claim: ${editingClaim?.claim_number}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUpdateClaimStatus} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isUrdu ? 'کلیم کی تازہ ترین صورتحال' : 'Claim Status'}
            </label>
            <select
              value={updatedStatus}
              onChange={(e) => setUpdatedStatus(e.target.value)}
              className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              <option value="pending">{isUrdu ? 'زیرِ جائزہ / دکان میں موجود' : 'Pending Review'}</option>
              <option value="sent_to_vendor">{isUrdu ? 'ڈسٹری بیوٹر / وینڈر کو بھیج دیا گیا' : 'Sent to Vendor / Distributor'}</option>
              <option value="repaired">{isUrdu ? 'مرمت مکمل و درست ٹیسٹ شدہ' : 'Repaired & Tested OK'}</option>
              <option value="replaced">{isUrdu ? 'نئے پیس سے تبدیل کر دیا گیا' : 'Unit Replaced with New'}</option>
              <option value="rejected">{isUrdu ? 'وارنٹی کلیم مسترد (جلنے یا فزیکل نقصان کی وجہ سے)' : 'Warranty Claim Rejected (Physical/Burn Damage)'}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isUrdu ? 'حل یا فیصلے کی تفصیل' : 'Resolution Notes'}
            </label>
            <textarea
              rows="3"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder={isUrdu ? "مثلاً وینڈر نے نیا پیس فراہم کر دیا جس کا نیا سیریل نمبر یہ ہے..." : "e.g. Vendor provided replacement unit with new S/N."}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingClaim(null)}
              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold"
            >
              {isUrdu ? 'منسوخ' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              {isUrdu ? 'محفوظ کریں' : 'Save Status'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
