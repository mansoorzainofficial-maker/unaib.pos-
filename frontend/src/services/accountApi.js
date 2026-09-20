const API_BASE = (typeof window !== 'undefined' && window.location.protocol.startsWith('http'))
  ? '/api/accounts'
  : 'http://localhost:5001/api/accounts';

function getHeaders() {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('unaib_token') : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export const accountApi = {
  getAll: async () => {
    const res = await fetch(API_BASE, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch accounts');
    return data.accounts || [];
  },

  getById: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch account');
    return data.account;
  },

  getStatement: async (id) => {
    const res = await fetch(`${API_BASE}/${id}/statement`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch statement');
    return data.statement;
  },

  create: async (payload) => {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create account');
    return data.account;
  },

  update: async (id, payload) => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update account');
    return data.account;
  },

  delete: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete account');
    return data;
  }
};
