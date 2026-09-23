import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Expose API services globally on window so 'api' is always defined everywhere
import { api } from './services/api';
import { supplierApi } from './services/supplierApi';
import { customerApi } from './services/customerApi';
import { ledgerApi } from './services/ledgerApi';
import { accountApi } from './services/accountApi';
import { grnApi } from './services/grnApi';

if (typeof window !== 'undefined') {
  window.api = api;
  window.supplierApi = supplierApi;
  window.customerApi = customerApi;
  window.ledgerApi = ledgerApi;
  window.accountApi = accountApi;
  window.grnApi = grnApi;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
