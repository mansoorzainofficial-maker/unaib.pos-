const API_BASE = (typeof window !== 'undefined' && window.location.protocol.startsWith('http'))
  ? '/api/grn'
  : 'http://localhost:5001/api/grn';

function getHeaders() {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('unaib_token') : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export const grnApi = {
  getAll: async () => {
    const res = await fetch(API_BASE, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch GRNs');
    return data.grns || [];
  },

  getById: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch GRN detail');
    return data.grn;
  },

  create: async (payload) => {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create GRN');
    return data;
  }
};
