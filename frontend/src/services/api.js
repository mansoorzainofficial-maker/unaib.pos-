const API_BASE = (typeof window !== 'undefined' && window.location.protocol.startsWith('http'))
  ? '/api'
  : 'http://localhost:5001/api';

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
    logout: () => request('/auth/logout', { method: 'POST' }),
    getMe: () => request('/auth/me'),
    getUsers: () => request('/auth/users'),
    createUser: (userData) => request('/auth/users', { method: 'POST', body: JSON.stringify(userData) }),
    updateUser: (id, userData) => request(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(userData) })
  },

  // Products & Inventory
  products: {
    getAll: async (params = {}) => {
      let serverProducts = [];
      try {
        const res = await request(`/products${buildQuery(params)}`);
        if (res.success && Array.isArray(res.products)) serverProducts = res.products;
      } catch (err) {
        console.warn('API fetch warning:', err);
      }
      // Merge with locally added products
      let localList = [];
      try {
        localList = JSON.parse(localStorage.getItem('unaib_local_products') || '[]');
      } catch (_) {}
      const map = new Map();
      for (const p of serverProducts) map.set(p.id, p);
      for (const p of localList) {
        if (!map.has(p.id)) map.set(p.id, p);
      }
      const merged = Array.from(map.values());
      return { success: true, count: merged.length, products: merged };
    },
    getById: (id) => request(`/products/${id}`),
    getByBarcode: async (barcode) => {
      try {
        return await request(`/products/barcode/${encodeURIComponent(barcode)}`);
      } catch (err) {
        let localList = [];
        try {
          localList = JSON.parse(localStorage.getItem('unaib_local_products') || '[]');
        } catch (_) {}
        const match = localList.find(p => p.barcode && p.barcode.trim() === barcode.trim());
        if (match) return { success: true, product: match };
        throw err;
      }
    },
    getLowStockAlerts: () => request('/products/alerts/low-stock'),
    getOversoldAlerts: (status = 'pending') => request(`/products/alerts/oversold?status=${status}`),
    resolveOversoldAlert: (id, notes = '') => request(`/products/alerts/oversold/${id}/resolve`, { method: 'POST', body: JSON.stringify({ notes }) }),
    create: async (data) => {
      let res = null;
      try {
        res = await request('/products', { method: 'POST', body: JSON.stringify(data) });
      } catch (err) {
        console.warn('API create warning, caching locally:', err);
      }
      const newProd = {
        id: res?.productId || Date.now(),
        barcode: data.barcode || null,
        name: data.name,
        category_id: data.category_id || null,
        cost_price: Number(data.cost_price) || 0,
        sale_price: Number(data.sale_price) || 0,
        stock_quantity: Number(data.stock_quantity) || 0,
        low_stock_threshold: Number(data.low_stock_threshold) || 5,
        supplier_id: data.supplier_id || null,
        has_serials: data.has_serials ? 1 : 0,
        warranty_months: Number(data.warranty_months) || 12,
        description: data.description || null,
        created_at: new Date().toISOString()
      };
      try {
        const list = JSON.parse(localStorage.getItem('unaib_local_products') || '[]');
        list.unshift(newProd);
        localStorage.setItem('unaib_local_products', JSON.stringify(list));
      } catch (_) {}
      return { success: true, productId: newProd.id, product: newProd };
    },
    update: (id, data) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: async (id) => {
      try {
        await request(`/products/${id}`, { method: 'DELETE' });
      } catch (_) {}
      try {
        const list = JSON.parse(localStorage.getItem('unaib_local_products') || '[]');
        localStorage.setItem('unaib_local_products', JSON.stringify(list.filter(p => p.id !== id)));
      } catch (_) {}
      return { success: true };
    },
    syncSerials: (id) => request(`/products/${id}/sync-serials`, { method: 'POST' }),
    getCategories: () => request('/products/meta/categories'),
    createCategory: (data) => request('/products/meta/categories', { method: 'POST', body: JSON.stringify(data) }),
    getSuppliers: async () => {
      let serverSuppliers = [];
      try {
        const res = await request('/products/meta/suppliers');
        if (res.success && Array.isArray(res.suppliers)) serverSuppliers = res.suppliers;
      } catch (err) {
        console.warn('API suppliers warning:', err);
      }
      let localList = [];
      try {
        localList = JSON.parse(localStorage.getItem('unaib_local_suppliers') || '[]');
      } catch (_) {}
      const map = new Map();
      for (const s of serverSuppliers) map.set(s.id, s);
      for (const s of localList) {
        if (!map.has(s.id)) map.set(s.id, s);
      }
      return { success: true, suppliers: Array.from(map.values()) };
    },
    createSupplier: async (data) => {
      let res = null;
      try {
        res = await request('/products/meta/suppliers', { method: 'POST', body: JSON.stringify(data) });
      } catch (err) {
        console.warn('API supplier create warning, caching locally:', err);
      }
      const newSup = {
        id: res?.supplierId || Date.now(),
        name: data.name,
        contact_person: data.contact_person || '',
        phone: data.phone || '',
        address: data.address || '',
        current_balance: Number(data.opening_balance) || 0,
        created_at: new Date().toISOString()
      };
      try {
        const list = JSON.parse(localStorage.getItem('unaib_local_suppliers') || '[]');
        list.unshift(newSup);
        localStorage.setItem('unaib_local_suppliers', JSON.stringify(list));
      } catch (_) {}
      return { success: true, supplierId: newSup.id, supplier: newSup };
    }
  },

  // Invoices & POS
  invoices: {
    create: (invoiceData) => request('/invoices', { method: 'POST', body: JSON.stringify(invoiceData) }),
    getAll: (params = {}) => request(`/invoices${buildQuery(params)}`),
    getDetails: (idOrNumber) => request(`/invoices/${idOrNumber}`),
    getCustomers: async (params = {}) => {
      let serverCustomers = [];
      try {
        const res = await request(`/invoices/meta/customers${buildQuery(params)}`);
        if (res.success && Array.isArray(res.customers)) serverCustomers = res.customers;
      } catch (err) {
        console.warn('API customers warning:', err);
      }
      let localList = [];
      try {
        localList = JSON.parse(localStorage.getItem('unaib_local_customers') || '[]');
      } catch (_) {}
      const map = new Map();
      for (const c of serverCustomers) map.set(c.id, c);
      for (const c of localList) {
        if (!map.has(c.id)) map.set(c.id, c);
      }
      return { success: true, customers: Array.from(map.values()) };
    },
    createCustomer: async (data) => {
      let res = null;
      try {
        res = await request('/invoices/meta/customers', { method: 'POST', body: JSON.stringify(data) });
      } catch (err) {
        console.warn('API customer create warning, caching locally:', err);
      }
      const newCust = {
        id: res?.customerId || Date.now(),
        name: data.name,
        phone: data.phone || '',
        address: data.address || '',
        current_balance: Number(data.opening_balance) || 0,
        created_at: new Date().toISOString()
      };
      try {
        const list = JSON.parse(localStorage.getItem('unaib_local_customers') || '[]');
        list.unshift(newCust);
        localStorage.setItem('unaib_local_customers', JSON.stringify(list));
      } catch (_) {}
      return { success: true, customerId: newCust.id, customer: newCust };
    },
    void: (id, data = {}) => request(`/invoices/${id}/void`, { method: 'POST', body: JSON.stringify(data) }),
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
  }
};
