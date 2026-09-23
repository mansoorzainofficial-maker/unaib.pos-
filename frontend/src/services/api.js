// Purge any historical sensitive keys from browser storage immediately on load
if (typeof window !== 'undefined' && window.localStorage) {
  const SENSITIVE_LEGACY_KEYS = [
    'unaib_local_products',
    'unaib_local_suppliers',
    'unaib_local_customers',
    'unaib_pos_active_draft_bill',
    'unaib_user'
  ];
  SENSITIVE_LEGACY_KEYS.forEach(k => {
    try { window.localStorage.removeItem(k); } catch (_) {}
  });
  try {
    if (window.indexedDB && window.indexedDB.deleteDatabase) {
      window.indexedDB.deleteDatabase('unaib_pos_offline_db');
    }
  } catch (_) {}
}

const CLOUD_API_FALLBACK = 'https://unaib-pos-v1.vercel.app/api';

export const PRIMARY_API_BASE = (import.meta.env?.VITE_API_URL)
  ? import.meta.env.VITE_API_URL.replace(/\/+$/, '')
  : (typeof window !== 'undefined' && window.location.protocol.startsWith('http'))
    ? '/api'
    : 'http://localhost:5001/api';

let activeApiBase = PRIMARY_API_BASE;

function getHeaders() {
  const token = localStorage.getItem('unaib_token');
  const headers = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '1'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(endpoint, options = {}) {
  const config = {
    headers: getHeaders(),
    ...options
  };

  try {
    const response = await fetch(`${activeApiBase}${endpoint}`, config);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      console.error(`Non-JSON response from ${activeApiBase}${endpoint}:`, text.slice(0, 150));
      throw new Error(`Invalid server response from ${endpoint}`);
    }

    if (!response.ok) {
      const err = new Error(data.message || data.error || `Request failed with status ${response.status}`);
      err.status = response.status;
      if (response.status === 401 && typeof window !== 'undefined') {
        localStorage.removeItem('unaib_token');
        localStorage.removeItem('unaib_user');
      }
      throw err;
    }

    return data;
  } catch (err) {
    // If local/primary failed with network error, attempt seamless failover to Cloud Vercel
    const isNetworkError = !navigator.onLine || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError');
    if (isNetworkError && activeApiBase !== CLOUD_API_FALLBACK && navigator.onLine) {
      try {
        console.warn(`[API Failover] Primary API (${activeApiBase}) unreachable. Trying cloud fallback (${CLOUD_API_FALLBACK}${endpoint})...`);
        const fallbackRes = await fetch(`${CLOUD_API_FALLBACK}${endpoint}`, config);
        const fbText = await fallbackRes.text();
        const fbData = JSON.parse(fbText);
        if (fallbackRes.ok) {
          activeApiBase = CLOUD_API_FALLBACK;
          return fbData;
        }
      } catch (_) {}
    }
    throw err;
  }
}

function buildQuery(params = {}) {
  if (!params || typeof params !== 'object') return '';
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '' && value !== 'undefined' && value !== 'null') {
      searchParams.append(key, value);
    }
  }
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}

export const api = {
  // Authentication
  auth: {
    login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    getMe: () => request('/auth/me'),
    getUsers: () => request('/auth/users'),
    createUser: (userData) => request('/auth/users', { method: 'POST', body: JSON.stringify(userData) }),
    updateUser: (id, userData) => request(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(userData) })
  },

  // Products & Inventory (Pure cloud React state, zero localStorage persistence)
  products: {
    getAll: (params = {}) => request(`/products${buildQuery(params)}`),
    getById: (id) => request(`/products/${id}`),
    getByBarcode: (barcode) => request(`/products/barcode/${encodeURIComponent(barcode)}`),
    getLowStockAlerts: () => request('/products/alerts/low-stock'),
    getOversoldAlerts: (status = 'pending') => request(`/products/alerts/oversold?status=${status}`),
    resolveOversoldAlert: (id, notes = '') => request(`/products/alerts/oversold/${id}/resolve`, { method: 'POST', body: JSON.stringify({ notes }) }),
    create: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/products/${id}`, { method: 'DELETE' }),
    syncSerials: (id) => request(`/products/${id}/sync-serials`, { method: 'POST' }),
    getCategories: () => request('/products/meta/categories'),
    createCategory: (data) => request('/products/meta/categories', { method: 'POST', body: JSON.stringify(data) }),
    getSuppliers: () => request('/products/meta/suppliers'),
    createSupplier: (data) => request('/products/meta/suppliers', { method: 'POST', body: JSON.stringify(data) })
  },

  // Invoices & POS
  invoices: {
    create: (invoiceData) => request('/invoices', { method: 'POST', body: JSON.stringify(invoiceData) }),
    getAll: (params = {}) => request(`/invoices${buildQuery(params)}`),
    getDetails: (idOrNumber) => request(`/invoices/${idOrNumber}`),
    getById: (idOrNumber) => request(`/invoices/${idOrNumber}`),
    getCustomers: (params = {}) => request(`/invoices/meta/customers${buildQuery(params)}`),
    createCustomer: (data) => request('/invoices/meta/customers', { method: 'POST', body: JSON.stringify(data) }),
    updateCustomer: (id, data) => request(`/invoices/meta/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    deleteCustomer: (id) => request(`/invoices/meta/customers/${id}`, {
      method: 'DELETE'
    }),
    void: (id, data = {}) => request(`/invoices/${id}/void`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/invoices/${id}`, { method: 'DELETE' })
  },

  // Stock Purchases (Supplier Inward)
  purchases: {
    create: async (data) => {
      const res = await request('/purchases', { method: 'POST', body: JSON.stringify(data) });
      return res;
    },
    getAll: (params = {}) => request(`/purchases${buildQuery(params)}`),
    getDetails: (id) => request(`/purchases/${id}`),
    void: (id, data = {}) => request(`/purchases/${id}/void`, { method: 'POST', body: JSON.stringify(data) })
  },

  // Party Ledgers (Khata / Udhar)
  ledger: {
    getCustomer: (id) => request(`/ledger/customer/${id}`),
    getSupplier: (id) => request(`/ledger/supplier/${id}`),
    recordPayment: (data) => request('/ledger/payment', { method: 'POST', body: JSON.stringify(data) }),
    deletePayment: (id, data = {}) => request(`/ledger/payment/${id}`, { method: 'DELETE', body: JSON.stringify(data) }),
    getSummary: () => request('/ledger/summary')
  },

  // Warranty & Serial Numbers
  warranty: {
    lookupSerial: (serial) => request(`/warranty/lookup/${encodeURIComponent(serial)}`),
    getSerials: (params = {}) => request(`/warranty/serials${buildQuery(params)}`),
    addSerials: (data) => request('/warranty/serials', { method: 'POST', body: JSON.stringify(data) }),
    getClaims: (params = {}) => request(`/warranty/claims${buildQuery(params)}`),
    createClaim: (claimData) => request('/warranty/claims', { method: 'POST', body: JSON.stringify(claimData) }),
    updateClaim: (id, data) => request(`/warranty/claims/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  },

  // Financial Reports
  reports: {
    getSummary: (params = {}) => request(`/reports/summary${buildQuery(params)}`),
    getTaxReport: (params = {}) => request(`/reports/tax${buildQuery(params)}`),
  },

  // Operational Expenses
  expenses: {
    getAll: (params = {}) => request(`/expenses${buildQuery(params)}`),
    create: (data) => request('/expenses', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => request(`/expenses/${id}`, { method: 'DELETE' })
  },

  // Cash Drawer Reconciliation
  drawer: {
    getCurrentShift: () => request('/drawer/current'),
    openShift: (data) => request('/drawer/open', { method: 'POST', body: JSON.stringify(data) }),
    closeShift: (data) => request('/drawer/close', { method: 'POST', body: JSON.stringify(data) }),
    getHistory: () => request('/drawer/history')
  },

  // Settings
  settings: {
    get: () => request('/settings'),
    update: (data) => request('/settings', { method: 'PUT', body: JSON.stringify(data) })
  },

  // Database Backups
  backups: {
    getAll: () => request('/backups'),
    create: (data = {}) => request('/backups', { method: 'POST', body: JSON.stringify(data) }),
    openFolder: () => request('/backups/open-folder', { method: 'POST' })
  },

  // Thermal Printer
  printer: {
    printReceipt: (data) => request('/printer/print-receipt', { method: 'POST', body: JSON.stringify(data) }),
    testConnection: (config = {}) => request('/printer/test-connection', { method: 'POST', body: JSON.stringify(config) })
  },

  // Returns (Sale & Purchase Returns)
  returns: {
    getSaleReturns: () => request('/returns/sale'),
    createSaleReturn: (data) => request('/returns/sale', { method: 'POST', body: JSON.stringify(data) }),
    getPurchaseReturns: () => request('/returns/purchase'),
    createPurchaseReturn: (data) => request('/returns/purchase', { method: 'POST', body: JSON.stringify(data) })
  },

  // Activity Logs / Audit Trail
  activityLogs: {
    getAll: (params = {}) => request(`/activity-logs${buildQuery(params)}`)
  },

  // Dashboard Landing
  dashboard: {
    getOverview: () => request('/dashboard')
  },

  // Suppliers
  suppliers: {
    getAll: async () => {
      try {
        const res = await request('/suppliers');
        if (res.success && Array.isArray(res.suppliers)) return res.suppliers;
      } catch (err) {
        console.warn('API suppliers getAll warning:', err);
      }
      const supRes = await api.products.getSuppliers();
      return supRes.suppliers || [];
    },
    getById: (id) => request(`/suppliers/${id}`),
    create: (data) => request('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/suppliers/${id}`, { method: 'DELETE' })
  },

  // GRN (Goods Received Note)
  grn: {
    getAll: async () => {
      const res = await request('/grn');
      return res.grns || res.data || (Array.isArray(res) ? res : []);
    },
    getById: async (id) => {
      const res = await request(`/grn/${id}`);
      return res.grn || res;
    },
    create: (payload) => request('/grn', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/grn/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    delete: (id, options = {}) => request(`/grn/${id}`, { method: 'DELETE', body: JSON.stringify(options) })
  },

  // Customers
  customers: {
    getAll: (params = {}) => api.invoices.getCustomers(params),
    getById: (id) => request(`/customers/${id}`),
    create: (data) => api.invoices.createCustomer(data),
    update: (id, data) => api.invoices.updateCustomer(id, data),
    delete: (id) => api.invoices.deleteCustomer(id)
  },

  // Accounts
  accounts: {
    getAll: () => request('/accounts'),
    getById: (id) => request(`/accounts/${id}`),
    getStatement: (id) => request(`/accounts/${id}/statement`),
    create: (data) => request('/accounts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/accounts/${id}`, { method: 'DELETE' })
  },

  // Local-First Cloud Sync Queue
  sync: {
    getStatus: () => request('/sync/status'),
    trigger: () => request('/sync/trigger', { method: 'POST' })
  }
};
