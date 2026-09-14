const API_BASE = (typeof window !== 'undefined' && window.location.protocol.startsWith('http'))
  ? '/api'
  : 'http://localhost:5001/api';

function getHeaders() {
  const token = localStorage.getItem('unaib_token');
  const headers = {
    'Content-Type': 'application/json'
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

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }

  return data;
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
    getMe: () => request('/auth/me'),
    getUsers: () => request('/auth/users'),
    createUser: (userData) => request('/auth/users', { method: 'POST', body: JSON.stringify(userData) }),
    updateUser: (id, userData) => request(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(userData) })
  },

  // Products & Inventory
  products: {
    getAll: (params = {}) => request(`/products${buildQuery(params)}`),
    getById: (id) => request(`/products/${id}`),
    getByBarcode: (barcode) => request(`/products/barcode/${encodeURIComponent(barcode)}`),
    getLowStockAlerts: () => request('/products/alerts/low-stock'),
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
    getCustomers: (params = {}) => request(`/invoices/meta/customers${buildQuery(params)}`),
    createCustomer: (data) => request('/invoices/meta/customers', { method: 'POST', body: JSON.stringify(data) }),
    void: (id, data = {}) => request(`/invoices/${id}/void`, { method: 'POST', body: JSON.stringify(data) })
  },

  // Stock Purchases (Supplier Inward)
  purchases: {
    create: (data) => request('/purchases', { method: 'POST', body: JSON.stringify(data) }),
    getAll: (params = {}) => request(`/purchases${buildQuery(params)}`),
    getDetails: (id) => request(`/purchases/${id}`),
    void: (id, data = {}) => request(`/purchases/${id}/void`, { method: 'POST', body: JSON.stringify(data) })
  },

  // Party Ledgers (Khata / Udhar)
  ledger: {
    getCustomer: (id) => request(`/ledger/customer/${id}`),
    getSupplier: (id) => request(`/ledger/supplier/${id}`),
    recordPayment: (data) => request('/ledger/payment', { method: 'POST', body: JSON.stringify(data) }),
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
  }
};
