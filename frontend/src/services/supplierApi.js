const API_BASE = (typeof window !== 'undefined' && window.location.protocol.startsWith('http'))
  ? '/api/suppliers'
  : 'http://localhost:5001/api/suppliers';

function getHeaders() {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('unaib_token') : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export const supplierApi = {
  getAll: async () => {
    const res = await fetch(API_BASE, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch suppliers');
    return data.suppliers || [];
  },

  getById: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch supplier');
    return data.supplier;
  },

  create: async (payload) => {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create supplier');
    return data.supplier;
  },

  update: async (id, payload) => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update supplier');
    return data.supplier;
  },

  delete: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete supplier');
    return data;
  }
};
