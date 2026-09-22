const API_BASE = (typeof window !== 'undefined' && window.location.protocol.startsWith('http'))
  ? '/api/ledger'
  : 'http://localhost:5001/api/ledger';

function getHeaders() {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('unaib_token') : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export const ledgerApi = {
  getAccounts: async () => {
    const res = await fetch(`${API_BASE}/accounts`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch accounts');
    return data.accounts || [];
  },

  getParties: async (type = 'supplier') => {
    const res = await fetch(`${API_BASE}/parties?type=${type}`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch party list');
    return data.parties || [];
  },

  getStatement: async (partyType, partyId) => {
    const res = await fetch(`${API_BASE}/statement?party_type=${partyType}&party_id=${partyId}`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch statement');
    return data.statement;
  },

  recordPayment: async (payload) => {
    const res = await fetch(`${API_BASE}/payment`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to record payment');
    return data;
  },

  deletePayment: async (entryId, reason = 'User deleted payment') => {
    const res = await fetch(`${API_BASE}/payment/${entryId}`, {
      method: 'DELETE',
      headers: getHeaders(),
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'Failed to delete payment');
    return data;
  }
};
