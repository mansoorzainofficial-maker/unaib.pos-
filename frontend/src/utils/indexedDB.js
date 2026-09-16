/**
 * IndexedDB Service for Unaib POS Offline Capabilities
 * Database: unaib_pos_offline_db
 * Stores:
 *   - 'products' (keyPath: 'id'): Caches product catalog for offline searching/billing
 *   - 'pending_bills' (keyPath: 'local_id'): Stores unsynced offline bills until internet returns
 */

const DB_NAME = 'unaib_pos_offline_db';
const DB_VERSION = 1;
const STORE_PRODUCTS = 'products';
const STORE_PENDING_BILLS = 'pending_bills';

let dbInstancePromise = null;

/**
 * Open or upgrade the IndexedDB database instance
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (dbInstancePromise) return dbInstancePromise;

  dbInstancePromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Products Store: Cache full product catalog
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        const prodStore = db.createObjectStore(STORE_PRODUCTS, { keyPath: 'id' });
        prodStore.createIndex('name', 'name', { unique: false });
        prodStore.createIndex('barcode', 'barcode', { unique: false });
        prodStore.createIndex('category_id', 'category_id', { unique: false });
      }

      // 2. Pending Bills Store: Store offline bills waiting to sync
      if (!db.objectStoreNames.contains(STORE_PENDING_BILLS)) {
        const billStore = db.createObjectStore(STORE_PENDING_BILLS, { keyPath: 'local_id' });
        billStore.createIndex('synced', 'synced', { unique: false });
        billStore.createIndex('created_at', 'created_at', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      db.onclose = () => {
        dbInstancePromise = null;
      };
      resolve(db);
    };

    request.onerror = (event) => {
      dbInstancePromise = null;
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };
  });

  return dbInstancePromise;
}

// -------------------------------------------------------------
// PRODUCTS CACHE LOGIC
// -------------------------------------------------------------

/**
 * Save / Update all products in IndexedDB cache
 * @param {Array} productsList
 * @returns {Promise<boolean>}
 */
export async function saveProductsCache(productsList) {
  if (!Array.isArray(productsList) || productsList.length === 0) return false;

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
    const store = tx.objectStore(STORE_PRODUCTS);

    // Clear old catalog to ensure deleted or renamed items do not linger
    store.clear();

    for (const prod of productsList) {
      store.put(prod);
    }

    tx.oncomplete = () => {
      resolve(true);
    };

    tx.onerror = (event) => {
      console.error('Failed to save products to IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Retrieve all cached products from IndexedDB
 * @returns {Promise<Array>}
 */
export async function getCachedProducts() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTS, 'readonly');
    const store = tx.objectStore(STORE_PRODUCTS);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = (event) => {
      console.error('Failed to read products from IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

// -------------------------------------------------------------
// PENDING BILLS (OFFLINE SALES) LOGIC
// -------------------------------------------------------------

/**
 * Save an offline bill in IndexedDB pending_bills store
 * @param {Object} billData - Complete bill payload (items, customer, totals, payment)
 * @returns {Promise<Object>} Returns saved bill with local_id
 */
export async function savePendingBill(billData) {
  const db = await openDB();

  const localId = Date.now();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const offlineInvoiceNumber = `OFFLINE-${dateStr}-${String(localId).slice(-4)}`;

  const billRecord = {
    local_id: localId,
    invoice_number: offlineInvoiceNumber,
    synced: false,
    created_at: new Date().toISOString(),
    payload: billData,
    attempts: 0,
    last_error: null
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING_BILLS, 'readwrite');
    const store = tx.objectStore(STORE_PENDING_BILLS);
    const request = store.add(billRecord);

    tx.oncomplete = () => {
      resolve(billRecord);
    };

    tx.onerror = (event) => {
      console.error('Failed to save pending bill in IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Get all unsynced pending bills
 * @returns {Promise<Array>}
 */
export async function getPendingBills() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING_BILLS, 'readonly');
    const store = tx.objectStore(STORE_PENDING_BILLS);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result || [];
      // Filter only unsynced bills
      const pending = all.filter(b => !b.synced);
      resolve(pending);
    };

    request.onerror = (event) => {
      console.error('Failed to read pending bills:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Get current count of unsynced offline bills
 * @returns {Promise<number>}
 */
export async function getPendingBillsCount() {
  try {
    const bills = await getPendingBills();
    return bills.length;
  } catch (err) {
    console.warn('Could not count pending bills:', err);
    return 0;
  }
}

/**
 * Remove a successfully synced bill from IndexedDB
 * @param {number|string} localId
 * @returns {Promise<boolean>}
 */
export async function removePendingBill(localId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING_BILLS, 'readwrite');
    const store = tx.objectStore(STORE_PENDING_BILLS);
    store.delete(localId);

    tx.oncomplete = () => {
      resolve(true);
    };

    tx.onerror = (event) => {
      console.error(`Failed to remove pending bill #${localId}:`, event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Mark a bill as sync attempt failed with error details without deleting it
 * @param {number|string} localId
 * @param {string} errorMsg
 * @returns {Promise<boolean>}
 */
export async function markBillSyncFailed(localId, errorMsg) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING_BILLS, 'readwrite');
    const store = tx.objectStore(STORE_PENDING_BILLS);
    const getReq = store.get(localId);

    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        record.attempts = (record.attempts || 0) + 1;
        record.last_error = errorMsg || 'Unknown sync error';
        record.last_attempt_at = new Date().toISOString();
        store.put(record);
      }
    };

    tx.oncomplete = () => {
      resolve(true);
    };

    tx.onerror = (event) => {
      reject(event.target.error);
    };
  });
}
