import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('unaib_user');
    const storedToken = localStorage.getItem('unaib_token');

    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
        // Verify token with backend ONLY if online
        if (navigator.onLine) {
          api.auth.getMe()
            .then(res => {
              if (res.success && res.user) {
                setUser(res.user);
                localStorage.setItem('unaib_user', JSON.stringify(res.user));
              }
            })
            .catch((err) => {
              // ONLY if server explicitly responded with 401 Unauthorized do we logout
              if (err?.status === 401) {
                logout();
              }
            })
            .finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      } catch (err) {
        logout();
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (credentials) => {
    try {
      const res = await api.auth.login(credentials);
      if (res.success) {
        localStorage.setItem('unaib_token', res.token);
        localStorage.setItem('unaib_user', JSON.stringify(res.user));
        setUser(res.user);
        return res.user;
      }
      throw new Error(res.message || 'Login failed');
    } catch (err) {
      // Offline fallback: if network error or disconnected, allow PIN authentication
      const isNetworkFail = !navigator.onLine || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError');
      if (isNetworkFail) {
        const storedUser = localStorage.getItem('unaib_user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            setUser(parsed);
            return parsed;
          } catch (_) {}
        }
        // Terminal Quick PIN fallbacks when completely offline
        if (credentials.pin === '1234' || (credentials.username === 'admin' && credentials.password === 'admin123')) {
          const offlineAdmin = { id: 1, username: 'admin', role: 'admin', full_name: 'Administrator (Offline)' };
          localStorage.setItem('unaib_token', 'offline-token');
          localStorage.setItem('unaib_user', JSON.stringify(offlineAdmin));
          setUser(offlineAdmin);
          return offlineAdmin;
        }
        if (credentials.pin === '1111' || (credentials.username === 'cashier1' && credentials.password === 'cashier123')) {
          const offlineCashier = { id: 2, username: 'cashier1', role: 'cashier', full_name: 'Cashier (Offline)' };
          localStorage.setItem('unaib_token', 'offline-token');
          localStorage.setItem('unaib_user', JSON.stringify(offlineCashier));
          setUser(offlineCashier);
          return offlineCashier;
        }
      }
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('unaib_token');
    localStorage.removeItem('unaib_user');
    setUser(null);
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
