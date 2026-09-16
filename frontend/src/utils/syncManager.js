import {
  getPendingBills,
  removePendingBill,
  markBillSyncFailed,
  getPendingBillsCount
} from './indexedDB';
import { api } from '../services/api';

class SyncManager {
  constructor() {
    this.isSyncing = false;
    this.online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.subscribers = new Set();
    this.initListeners();
  }

  initListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.online = true;
      this.notifySubscribers({ type: 'STATUS_CHANGE', online: true });
      // Auto-trigger sync on reconnection
      setTimeout(() => {
        this.syncPendingBills();
      }, 1000);
    });

    window.addEventListener('offline', () => {
      this.online = false;
      this.notifySubscribers({ type: 'STATUS_CHANGE', online: false });
    });
  }

  /**
   * Subscribe to online/offline state changes and sync events
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    // Send immediate initial state
    callback({
      type: 'INIT',
      online: this.online,
      isSyncing: this.isSyncing
    });
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers(payload) {
    for (const callback of this.subscribers) {
      try {
        callback(payload);
      } catch (err) {
        console.error('Error in sync subscriber:', err);
      }
    }
  }

  /**
   * Check if client is currently online
   * @returns {boolean}
   */
  isOnline() {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  /**
   * Sync all pending offline bills to the backend server
   * @returns {Promise<Object>} { total, synced, failed, warnings }
   */
  async syncPendingBills() {
    if (this.isSyncing) {
      return { in_progress: true };
    }

    if (!this.isOnline()) {
      return { error: 'Offline', synced: 0 };
    }

    this.isSyncing = true;
    this.notifySubscribers({ type: 'SYNC_START' });

    const results = {
      total: 0,
      synced: 0,
      failed: 0,
      warnings: [],
      errors: []
    };

    try {
      const pendingBills = await getPendingBills();
      results.total = pendingBills.length;

      if (pendingBills.length === 0) {
        this.isSyncing = false;
        this.notifySubscribers({ type: 'SYNC_COMPLETE', results, pendingCount: 0 });
        return results;
      }

      for (const bill of pendingBills) {
        try {
          // Prepare invoice payload with offline sync markers
          const payload = {
            ...bill.payload,
            is_offline_sync: true,
            offline_created_at: bill.created_at,
            offline_local_id: bill.local_id
          };

          const res = await api.invoices.create(payload);

          if (res && res.success) {
            // Remove successfully synced bill from IndexedDB
            await removePendingBill(bill.local_id);
            results.synced++;

            // Collect any stock overselling warnings returned by backend
            const warnings = res.stock_warnings || res.invoice?.stock_warnings || [];
            if (warnings.length > 0) {
              results.warnings.push(...warnings);
            }
          } else {
            const errText = res?.message || 'Server rejected offline bill';
            await markBillSyncFailed(bill.local_id, errText);
            results.failed++;
            results.errors.push({ local_id: bill.local_id, error: errText });
          }
        } catch (err) {
          console.error(`Failed to sync bill #${bill.local_id}:`, err);
          await markBillSyncFailed(bill.local_id, err.message);
          results.failed++;
          results.errors.push({ local_id: bill.local_id, error: err.message });
          // Note: DO NOT stop loop on single failure; proceed to next bill
        }
      }

      const remainingCount = await getPendingBillsCount();

      this.notifySubscribers({
        type: 'SYNC_COMPLETE',
        results,
        pendingCount: remainingCount
      });

      return results;
    } catch (fatalErr) {
      console.error('Fatal error during pending bills sync:', fatalErr);
      this.notifySubscribers({ type: 'SYNC_ERROR', error: fatalErr.message });
      return results;
    } finally {
      this.isSyncing = false;
    }
  }
}

// Global Singleton Instance
export const syncManager = new SyncManager();
