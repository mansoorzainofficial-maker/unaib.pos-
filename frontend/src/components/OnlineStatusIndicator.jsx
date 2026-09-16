import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { syncManager } from '../utils/syncManager';
import { getPendingBillsCount } from '../utils/indexedDB';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function OnlineStatusIndicator() {
  const { t, isUrdu } = useLanguage();
  const [isOnline, setIsOnline] = useState(syncManager.isOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [oversoldAlerts, setOversoldAlerts] = useState([]);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);

  useEffect(() => {
    // Initial counts
    updatePendingCount();
    loadOversoldAlerts();

    // Subscribe to SyncManager events
    const unsubscribe = syncManager.subscribe((event) => {
      if (event.type === 'STATUS_CHANGE' || event.type === 'INIT') {
        setIsOnline(event.online);
      } else if (event.type === 'SYNC_START') {
        setIsSyncing(true);
      } else if (event.type === 'SYNC_COMPLETE') {
        setIsSyncing(false);
        updatePendingCount();
        loadOversoldAlerts();

        const { synced, failed, warnings } = event.results || {};
        if (synced > 0) {
          setToastMessage({
            type: 'success',
            text: isUrdu
              ? `✓ ${synced} آف لائن بل کامیابی سے سرور پر سنک ہو گئے!`
              : `✓ ${synced} offline bill(s) successfully synced!`
          });
          setTimeout(() => setToastMessage(null), 5000);
        }

        if (warnings && warnings.length > 0) {
          setToastMessage({
            type: 'warning',
            text: isUrdu
              ? `⚠️ انتباہ: ${warnings.length} آئٹم اسٹاک سے زیادہ فروخت ہوئے، دستی طور پر چیک کریں۔`
              : `⚠️ Warning: ${warnings.length} item(s) oversold while offline, please check stock.`
          });
          setTimeout(() => setToastMessage(null), 8000);
        }
      } else if (event.type === 'SYNC_ERROR') {
        setIsSyncing(false);
        updatePendingCount();
      }
    });

    // Periodic check for pending bills & unresolved stock alerts
    const interval = setInterval(() => {
      updatePendingCount();
      loadOversoldAlerts();
    }, 15000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [isUrdu]);

  const updatePendingCount = async () => {
    const count = await getPendingBillsCount();
    setPendingCount(count);
  };

  const loadOversoldAlerts = async () => {
    try {
      const res = await api.products.getOversoldAlerts('pending');
      if (res && res.success) {
        setOversoldAlerts(res.alerts || []);
      }
    } catch (err) {
      // Ignore if offline
    }
  };

  const handleManualSync = async () => {
    if (!isOnline || isSyncing) return;
    await syncManager.syncPendingBills();
  };

  const handleResolveAlert = async (alertId) => {
    setResolvingId(alertId);
    try {
      const res = await api.products.resolveOversoldAlert(alertId, 'Checked and resolved manually');
      if (res && res.success) {
        setOversoldAlerts(prev => prev.filter(a => a.id !== alertId));
      }
    } catch (err) {
      alert(err.message || 'Failed to resolve alert');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="flex items-center space-x-2 relative text-xs">
      {/* Toast Notification Banner (Floating) */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-xl border flex items-center gap-2 animate-in fade-in slide-in-from-top-2 text-xs font-bold ${
          toastMessage.type === 'success'
            ? 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-600/30'
            : 'bg-amber-500 text-slate-950 border-amber-600 shadow-amber-500/30'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 p-0.5 hover:bg-black/10 rounded-full cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Online / Offline Status Pill */}
      <div
        className={`flex items-center space-x-1.5 px-3 py-1 rounded-full font-bold transition-colors ${
          isOnline
            ? 'bg-emerald-50 border border-emerald-300 text-emerald-700'
            : 'bg-rose-50 border border-rose-300 text-rose-700 animate-pulse'
        }`}
        title={isOnline ? 'Internet connection active' : 'No internet connection, POS operating in offline mode'}
      >
        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
        {isOnline ? (
          <Wifi className="w-3.5 h-3.5 text-emerald-600" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-rose-600" />
        )}
        <span>{isOnline ? (isUrdu ? 'آن لائن' : 'Online') : (isUrdu ? 'آف لائن' : 'Offline')}</span>
      </div>

      {/* Pending Offline Bills Badge & Sync Button */}
      {pendingCount > 0 && (
        <div className="flex items-center space-x-1">
          <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-mono font-bold text-[11px]">
            {pendingCount} {isUrdu ? 'آف لائن بل' : 'pending'}
          </span>

          {isOnline && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              title={isUrdu ? 'آف لائن بلز فوری سنک کریں' : 'Sync offline bills now'}
              className="p-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          )}
        </div>
      )}

      {/* Unresolved Oversold Stock Alerts Badge */}
      {oversoldAlerts.length > 0 && (
        <button
          onClick={() => setIsAlertsModalOpen(true)}
          className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs cursor-pointer text-[11px] animate-pulse"
          title={isUrdu ? 'منفی اسٹاک الرٹس دیکھیں' : 'View oversold stock alerts'}
        >
          <AlertTriangle className="w-3 h-3 text-rose-200" />
          <span>{oversoldAlerts.length} {isUrdu ? 'اسٹاک الرٹس' : 'Stock Alerts'}</span>
        </button>
      )}

      {/* Stock Alerts Review & Resolve Modal */}
      {isAlertsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden text-right select-text">
            <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-rose-950">{t('stock_alert_modal_title')}</h3>
                  <p className="text-[11px] text-rose-800">
                    {t('stock_alert_modal_sub')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAlertsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
              {oversoldAlerts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  {t('stock_alert_all_resolved')}
                </div>
              ) : (
                oversoldAlerts.map((alertItem) => (
                  <div
                    key={alertItem.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{alertItem.product_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                        <span>{t('stock_alert_invoice_num')} {alertItem.invoice_number || '-'}</span>
                        <span>|</span>
                        <span>{t('stock_alert_qty_sold')} {alertItem.quantity_sold}</span>
                        <span>|</span>
                        <span>{t('stock_alert_current_stock')} {alertItem.current_stock}</span>
                      </div>
                      <div className="text-rose-700 font-bold text-[11px] mt-1">
                        ⚠️ {t('stock_alert_oversold_qty')} -{alertItem.quantity_oversold} {t('stock_alert_oversold_hint')}
                      </div>
                    </div>

                    <button
                      onClick={() => handleResolveAlert(alertItem.id)}
                      disabled={resolvingId === alertItem.id}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {resolvingId === alertItem.id ? t('stock_alert_resolving') : t('stock_alert_resolve_btn')}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setIsAlertsModalOpen(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs cursor-pointer"
              >
                {t('stock_alert_close_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
