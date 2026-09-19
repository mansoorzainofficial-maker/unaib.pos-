import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  UserCheck,
  LogOut,
  AlertTriangle,
  UserPlus,
  Truck,
  Sliders,
  Shield,
  Clock
} from 'lucide-react';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function ActivityLogScreen() {
  const { t, isUrdu } = useLanguage();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Filters
  const [dateRange, setDateRange] = useState('today'); // 'today' | '7days' | 'all'
  const [selectedAction, setSelectedAction] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [dateRange, selectedAction]);

  const getDateFilterParams = () => {
    const now = new Date();
    if (dateRange === 'today') {
      const todayStr = now.toISOString().slice(0, 10);
      return { startDate: `${todayStr} 00:00:00`, endDate: `${todayStr} 23:59:59` };
    } else if (dateRange === '7days') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { startDate: past.toISOString().slice(0, 19).replace('T', ' ') };
    }
    return {};
  };

  const fetchLogs = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const dateParams = getDateFilterParams();
      const params = {
        ...dateParams,
        limit: 200
      };
      if (selectedAction !== 'all') {
        params.action = selectedAction;
      }
      const res = await api.activityLogs.getAll(params);
      if (res && res.success) {
        setLogs(res.logs || []);
      } else {
        throw new Error(res?.message || 'Failed to fetch logs');
      }
    } catch (err) {
      console.error('Error loading activity logs:', err);
      setErrorMsg(err.message || (isUrdu ? 'لاگز لوڈ کرنے میں غلطی ہوئی' : 'Failed to load activity logs'));
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '-';
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return timestamp;
      return d.toLocaleString('en-PK', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (_) {
      return timestamp;
    }
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'auth_login':
        return {
          icon: UserCheck,
          label: isUrdu ? 'لاگ ان (Login)' : 'Login',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
      case 'auth_logout':
        return {
          icon: LogOut,
          label: isUrdu ? 'لاگ آؤٹ (Logout)' : 'Logout',
          bg: 'bg-slate-100 text-slate-700 border-slate-200'
        };
      case 'invoice_void':
        return {
          icon: AlertTriangle,
          label: isUrdu ? 'سیل بل منسوخ' : 'Void Invoice',
          bg: 'bg-rose-50 text-rose-700 border-rose-200'
        };
      case 'purchase_void':
        return {
          icon: AlertTriangle,
          label: isUrdu ? 'خریداری بل منسوخ' : 'Void Purchase',
          bg: 'bg-amber-50 text-amber-800 border-amber-200'
        };
      case 'customer_create':
        return {
          icon: UserPlus,
          label: isUrdu ? 'نیا گاہک' : 'New Customer',
          bg: 'bg-blue-50 text-blue-700 border-blue-200'
        };
      case 'supplier_create':
        return {
          icon: Truck,
          label: isUrdu ? 'نیا سپلائر' : 'New Supplier',
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200'
        };
      case 'settings_update':
        return {
          icon: Sliders,
          label: isUrdu ? 'سیٹنگز تبدیلی' : 'Settings Update',
          bg: 'bg-purple-50 text-purple-700 border-purple-200'
        };
      default:
        return {
          icon: Shield,
          label: action,
          bg: 'bg-slate-50 text-slate-700 border-slate-200'
        };
    }
  };

  // Client-side search filtering
  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return logs;
    const q = searchTerm.toLowerCase().trim();
    return logs.filter(item => {
      const userMatch = (item.username || '').toLowerCase().includes(q);
      const descMatch = (item.description || '').toLowerCase().includes(q);
      const actionMatch = (item.action || '').toLowerCase().includes(q);
      return userMatch || descMatch || actionMatch;
    });
  }, [logs, searchTerm]);

  // Metric stats
  const stats = useMemo(() => {
    let logins = 0;
    let voids = 0;
    let records = filteredLogs.length;

    filteredLogs.forEach(l => {
      if (l.action === 'auth_login') logins++;
      if (l.action === 'invoice_void' || l.action === 'purchase_void') voids++;
    });

    return { total: records, logins, voids };
  }, [filteredLogs]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight">
                {isUrdu ? 'سسٹم آڈٹ ٹریل و لاگز' : 'System Audit Trail & Activity Logs'}
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                Admin Security
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {isUrdu
                ? 'لاگ ان، بل منسوخی، نیا گاہک/سپلائر اور تمام اہم کارروائیوں کا خودکار ریکارڈ'
                : 'Real-time timeline of user logins, voids, registrations and critical operations'}
            </p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-slate-200 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{isUrdu ? 'ریفریش کریں' : 'Refresh'}</span>
        </button>
      </div>

      {/* KPI Stats Strip */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 grid grid-cols-3 gap-4">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500">{isUrdu ? 'کل سرگرمیاں' : 'Total Activities'}</p>
            <p className="text-lg font-black text-slate-900">{stats.total}</p>
          </div>
          <Clock className="w-5 h-5 text-slate-400" />
        </div>

        <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-emerald-700">{isUrdu ? 'کامیاب لاگ ان' : 'Total Logins'}</p>
            <p className="text-lg font-black text-emerald-800">{stats.logins}</p>
          </div>
          <UserCheck className="w-5 h-5 text-emerald-600" />
        </div>

        <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-rose-700">{isUrdu ? 'منسوخ شدہ بل' : 'Void Operations'}</p>
            <p className="text-lg font-black text-rose-800">{stats.voids}</p>
          </div>
          <AlertTriangle className="w-5 h-5 text-rose-600" />
        </div>
      </div>

      {/* Filters Strip */}
      <div className="bg-slate-100/70 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
          <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
          <button
            onClick={() => setDateRange('today')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              dateRange === 'today'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {isUrdu ? 'آج (Today)' : 'Today'}
          </button>
          <button
            onClick={() => setDateRange('7days')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              dateRange === '7days'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {isUrdu ? 'گزشتہ ۷ دن' : 'Last 7 Days'}
          </button>
          <button
            onClick={() => setDateRange('all')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              dateRange === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {isUrdu ? 'تمام ریکارڈز' : 'All Time'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Action Filter Select */}
          <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="text-xs font-medium text-slate-700 bg-transparent border-none outline-none cursor-pointer"
            >
              <option value="all">{isUrdu ? 'تمام ایکشنز (All Actions)' : 'All Actions'}</option>
              <option value="auth_login">{isUrdu ? 'لاگ ان (Login)' : 'Login'}</option>
              <option value="auth_logout">{isUrdu ? 'لاگ آؤٹ (Logout)' : 'Logout'}</option>
              <option value="invoice_void">{isUrdu ? 'سیل بل منسوخی (Invoice Void)' : 'Invoice Void'}</option>
              <option value="purchase_void">{isUrdu ? 'خریداری منسوخی (Purchase Void)' : 'Purchase Void'}</option>
              <option value="customer_create">{isUrdu ? 'نیا گاہک (New Customer)' : 'New Customer'}</option>
              <option value="supplier_create">{isUrdu ? 'نیا سپلائر (New Supplier)' : 'New Supplier'}</option>
              <option value="settings_update">{isUrdu ? 'سیٹنگز تبدیلی (Settings)' : 'Settings Update'}</option>
            </select>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={isUrdu ? 'لاگ تلاش کریں (صارف یا تفصیل)...' : 'Search logs by user or details...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 w-56 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 overflow-auto p-6">
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-48">{isUrdu ? 'وقت و تاریخ' : 'Date & Time'}</th>
                <th className="py-3 px-4 w-40">{isUrdu ? 'صارف' : 'User'}</th>
                <th className="py-3 px-4 w-44">{isUrdu ? 'سرگرمی / عمل' : 'Action Type'}</th>
                <th className="py-3 px-4">{isUrdu ? 'تفصیلات' : 'Activity Description'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                      <span className="font-semibold">{isUrdu ? 'لاگز لوڈ ہو رہے ہیں...' : 'Loading activity logs...'}</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <History className="w-8 h-8 text-slate-300" />
                      <span className="font-semibold">{isUrdu ? 'کوئی سرگرمی ریکارڈ نہیں ملی' : 'No activity records found'}</span>
                      <p className="text-[11px] text-slate-400">
                        {isUrdu ? 'منتخب کردہ فلٹر میں کوئی سرگرمی موجود نہیں ہے' : 'Try adjusting the date or action filter above'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((item) => {
                  const badge = getActionBadge(item.action);
                  const Icon = badge.icon;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3 px-4 font-mono text-[11.5px] text-slate-600 whitespace-nowrap">
                        {formatDateTime(item.created_at)}
                      </td>

                      {/* User */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700">
                            {(item.username || 'A')[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900">{item.username || 'System'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Action Type Badge */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.bg}`}>
                          <Icon className="w-3 h-3" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 font-medium text-slate-800 leading-relaxed">
                        {item.description}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
