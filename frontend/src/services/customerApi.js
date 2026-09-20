import { api } from './api';

const API_BASE = (typeof window !== 'undefined' && window.location.protocol.startsWith('http'))
  ? '/api/customers'
  : 'http://localhost:5001/api/customers';

function getHeaders() {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('unaib_token') : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export const customerApi = {
  getAll: async (params = {}) => {
    return await api.invoices.getCustomers(params);
  },

  getById: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Failed to fetch customer');
    return data.customer;
  },

  create: async (payload) => {
    return await api.invoices.createCustomer(payload);
  },

  update: async (id, payload) => {
    return await api.invoices.updateCustomer(id, payload);
  },

  delete: async (id) => {
    return await api.invoices.deleteCustomer(id);
  }
};
