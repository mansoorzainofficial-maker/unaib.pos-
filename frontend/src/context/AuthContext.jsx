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
        // Verify token with backend
        api.auth.getMe()
          .then(res => {
            if (res.success && res.user) {
              setUser(res.user);
              localStorage.setItem('unaib_user', JSON.stringify(res.user));
            }
          })
          .catch(() => {
            // If token invalid, clear
            logout();
          })
          .finally(() => setLoading(false));
      } catch (err) {
        logout();
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (credentials) => {
    const res = await api.auth.login(credentials);
    if (res.success) {
      localStorage.setItem('unaib_token', res.token);
      localStorage.setItem('unaib_user', JSON.stringify(res.user));
      setUser(res.user);
      return res.user;
    }
    throw new Error(res.message || 'Login failed');
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
