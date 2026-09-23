import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('unaib_token');
    localStorage.removeItem('unaib_user');

    if (storedToken && storedToken !== 'offline-token') {
      api.auth.getMe()
        .then(res => {
          if (res.success && res.user) {
            setUser(res.user);
          } else {
            logout();
          }
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (credentials) => {
    const res = await api.auth.login(credentials);
    if (res.success) {
      localStorage.setItem('unaib_token', res.token);
      localStorage.removeItem('unaib_user');
      setUser(res.user);
      return res.user;
    }
    throw new Error(res.message || 'Login failed');
  };

  const logout = () => {
    try {
      if (localStorage.getItem('unaib_token') && localStorage.getItem('unaib_token') !== 'offline-token') {
        api.auth.logout().catch(() => {});
      }
    } catch (_) {}
    localStorage.removeItem('unaib_token');
    localStorage.removeItem('unaib_user');
    localStorage.removeItem('unaib_local_products');
    localStorage.removeItem('unaib_local_suppliers');
    localStorage.removeItem('unaib_local_customers');
    localStorage.removeItem('unaib_pos_active_draft_bill');
    try {
      sessionStorage.clear();
    } catch (_) {}
    setUser(null);
    try {
      window.history.replaceState(null, '', window.location.pathname);
    } catch (_) {}
  };

  const isAdmin = user?.role === 'admin';
  const isCashier = user?.role === 'cashier';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isCashier }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
