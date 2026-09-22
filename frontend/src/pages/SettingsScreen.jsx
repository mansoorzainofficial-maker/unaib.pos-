import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Modal from '../components/Modal';
import { Settings, Store, Users, Shield, Plus, Key, Save, CheckCircle, Database, FolderOpen, Download, ShieldCheck, Archive } from 'lucide-react';

export default function SettingsScreen() {
  const [activeTab, setActiveTab] = useState('store'); // 'store', 'users', 'backups'

  // Store Settings state
  const [settings, setSettings] = useState({
    store_name: 'Unaib Computer Accessories',
    store_tagline: 'Gaming Rigs, High-End Components & Genuine Accessories',
    store_address: 'Shop #14, Techno City Plaza, I.I. Chundrigar Rd, Karachi',
    store_phone: '+92 300 9258123 / 021-32278910',
    store_email: 'sales@unaibcomputers.com',
    currency_symbol: 'Rs.',
    receipt_size: '80mm',
    tax_ntn: '',
    tax_strn: '',
    default_sales_tax_rate: 0,
    default_purchase_tax_rate: 0,
    receipt_footer: 'Warranty Terms: 7 days check warranty for unsealed accessories. 1-2 year brand warranty for serialized components. Burn/water/physical damage voids warranty.'
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  // User Management state
  const [users, setUsers] = useState([]);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '',
    full_name: '',
    password: '',
    pin: '',
    role: 'cashier',
    phone: ''
  });

  // Automated Backups state
  const [backupsList, setBackupsList] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');

  useEffect(() => {
    loadSettings();
    loadUsers();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.settings.get();
      if (res.success && res.settings) {
        setSettings(prev => ({ ...prev, ...res.settings }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await api.auth.getUsers();
      if (res.success) {
        setUsers(res.users);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await api.settings.update(settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      alert(err.message || 'Failed to update settings');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api.auth.createUser(userForm);
      setIsAddUserOpen(false);
      setUserForm({
        username: '',
        full_name: '',
        password: '',
        pin: '',
        role: 'cashier',
        phone: ''
      });
      loadUsers();
    } catch (err) {
      alert(err.message || 'Failed to create user');
    }
  };

  const loadBackups = async () => {
    try {
      setBackupLoading(true);
      const res = await api.backups.getAll();
      if (res.success) {
        setBackupsList(res.backups || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleCreateBackupNow = async () => {
    try {
      setBackupLoading(true);
      const res = await api.backups.create({ trigger: 'manual_click' });
      if (res.success) {
        setBackupMsg(`Naya backup snapshot mehfooz ho gaya: ${res.filename} (${res.sizeFormatted})`);
        loadBackups();
        setTimeout(() => setBackupMsg(''), 5000);
      }
    } catch (err) {
      alert(err.message || 'Backup creation failed');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleOpenBackupFolder = async () => {
    try {
      if (window.electronAPI?.openPath) {
        const res = await api.backups.getAll();
        if (res.backupDir) {
          window.electronAPI.openPath(res.backupDir);
          return;
        }
      }
      await api.backups.openFolder();
    } catch (err) {
      alert('Could not open folder automatically: ' + err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 text-slate-800 p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-600" />
            Store Settings & System Protection
          </h2>
          <p className="text-xs text-slate-500">
            Configure shop profile, thermal receipt size, terminal accounts, and automated database backups
          </p>
        </div>

        <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs">
          <button
            onClick={() => setActiveTab('store')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
              activeTab === 'store' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Store & Receipt Profile
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
              activeTab === 'users' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            User Roles & Terminals ({users.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('backups');
              loadBackups();
            }}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'backups' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Database & Backups</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>Settings saved successfully!</span>
        </div>
      )}

      {/* TAB 1: STORE & RECEIPT SETTINGS */}
      {activeTab === 'store' && (
        <form onSubmit={handleSaveSettings} className="flex-1 overflow-y-auto max-w-3xl space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Store className="w-4 h-4 text-emerald-600" />
              Store Information (Thermal Receipt Header)
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Store Name</label>
                <input
                  type="text"
                  value={settings.store_name}
                  onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tagline</label>
                <input
                  type="text"
                  value={settings.store_tagline}
                  onChange={(e) => setSettings({ ...settings, store_tagline: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Shop Address</label>
                <input
                  type="text"
                  value={settings.store_address}
                  onChange={(e) => setSettings({ ...settings, store_address: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone(s)</label>
                <input
                  type="text"
                  value={settings.store_phone}
                  onChange={(e) => setSettings({ ...settings, store_phone: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={settings.store_email}
                  onChange={(e) => setSettings({ ...settings, store_email: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-600" />
              Thermal Printer & Receipt Formatting
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Default Roll / Page Size</label>
                <select
                  value={settings.receipt_size}
                  onChange={(e) => setSettings({ ...settings, receipt_size: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="a5">📄 A4 Half / A5 (Laser & DeskJet Printer)</option>
                  <option value="80mm">80mm (Standard POS Thermal Roll)</option>
                  <option value="58mm">58mm (Compact Mobile/Desk Thermal)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={settings.currency_symbol}
                  onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Receipt Footer & Warranty Terms Disclaimer
                </label>
                <textarea
                  rows="3"
                  value={settings.receipt_footer}
                  onChange={(e) => setSettings({ ...settings, receipt_footer: e.target.value })}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* TAX & FBR / STRN REGISTRATION SETTINGS */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Tax & FBR / GST Registration Profile
            </h3>
            <p className="text-xs text-slate-500">
              Set business tax credentials and standard default tax rates for automated calculation on Sales & Purchases.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NTN (National Tax Number)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1234567-8"
                  value={settings.tax_ntn || ''}
                  onChange={(e) => setSettings({ ...settings, tax_ntn: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  STRN (Sales Tax Reg. Number)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 01-23-4567-890-12"
                  value={settings.tax_strn || ''}
                  onChange={(e) => setSettings({ ...settings, tax_strn: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Sales Tax Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="e.g. 18"
                  value={settings.default_sales_tax_rate ?? ''}
                  onChange={(e) => setSettings({ ...settings, default_sales_tax_rate: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Applied automatically to POS checkout (can be modified per sale).</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Purchase Tax Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="e.g. 18"
                  value={settings.default_purchase_tax_rate ?? ''}
                  onChange={(e) => setSettings({ ...settings, default_purchase_tax_rate: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Applied automatically when recording stock purchases from suppliers.</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Store Settings</span>
          </button>
        </form>
      )}

      {/* TAB 2: USER ACCESS CONTROL */}
      {activeTab === 'users' && (
        <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Role permissions: <strong className="text-emerald-700">Admin</strong> has full system and profit visibility; <strong className="text-blue-700">Cashier</strong> is restricted to POS billing.
            </p>
            <button
              onClick={() => setIsAddUserOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Staff Account</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Full Name</th>
                  <th className="py-2.5 px-2">Username</th>
                  <th className="py-2.5 px-2">Role</th>
                  <th className="py-2.5 px-2">Quick PIN</th>
                  <th className="py-2.5 px-2">Phone</th>
                  <th className="py-2.5 pr-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{u.full_name}</td>
                    <td className="py-2.5 px-2 font-mono text-slate-600">{u.username}</td>
                    <td className="py-2.5 px-2">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        u.role === 'admin'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-mono text-slate-700">{u.pin ? '••••' : '—'}</td>
                    <td className="py-2.5 px-2 text-slate-600">{u.phone || '—'}</td>
                    <td className="py-2.5 pr-3 text-right">
                      <span className="text-emerald-700 font-bold text-xs">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DATABASE & AUTOMATED BACKUPS */}
      {activeTab === 'backups' && (
        <div className="flex-1 overflow-y-auto max-w-4xl space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  Automated Database Backups (unaib_pos.sqlite)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  App open hote waqt aur exit hote waqt SQLite WAL snapshot automatically mehfooz hota hai.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenBackupFolder}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-300 cursor-pointer"
                  title="Open backups directory in Windows Explorer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                  <span>Open Folder</span>
                </button>
                <button
                  type="button"
                  onClick={handleCreateBackupNow}
                  disabled={backupLoading}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                  title="Create an immediate backup copy of database right now"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{backupLoading ? 'Backing up...' : '⚡ Create Backup Now'}</span>
                </button>
              </div>
            </div>

            {/* Status info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
                <div>
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Auto Backup</div>
                  <div className="text-xs font-bold text-emerald-700">ACTIVE (Start & Exit)</div>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Crash Protection</div>
                  <div className="text-xs font-bold text-slate-800">SQLite WAL Enabled</div>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2.5">
                <Archive className="w-4 h-4 text-purple-600 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Total Backups</div>
                  <div className="text-xs font-bold font-mono text-purple-700">{backupsList.length} files</div>
                </div>
              </div>
            </div>

            {backupMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2 animate-fade-in">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>{backupMsg}</span>
              </div>
            )}

            {/* Backups List Table */}
            <div className="pt-2">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-bold text-slate-800">Recent Backups in Storage:</h4>
                <button
                  type="button"
                  onClick={loadBackups}
                  className="text-[11px] text-emerald-700 hover:underline font-semibold cursor-pointer"
                >
                  Refresh List
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 text-[10px] font-bold uppercase sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">File Name</th>
                      <th className="py-2 px-2">Created Date & Time</th>
                      <th className="py-2 px-3 text-right">Size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {backupsList.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="py-6 text-center text-slate-400 text-xs">
                          {backupLoading ? 'Loading backups...' : 'No backups found yet. Click "Create Backup Now".'}
                        </td>
                      </tr>
                    ) : (
                      backupsList.map((b) => (
                        <tr key={b.filename} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 font-mono font-bold text-emerald-700 text-[11px] flex items-center gap-1.5">
                            <Database className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{b.filename}</span>
                          </td>
                          <td className="py-2 px-2 text-slate-500 font-mono text-[11px]">
                            {new Date(b.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 text-[11px]">
                            {b.sizeFormatted}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      <Modal
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        title="Add Cashier or Admin Account"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateUser} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={userForm.full_name}
              onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
              placeholder="e.g. Asad Qureshi"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Username *</label>
              <input
                type="text"
                required
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value.toLowerCase().trim() })}
                placeholder="asad1"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Role *</label>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
              >
                <option value="cashier">Cashier (POS Billing Only)</option>
                <option value="admin">Administrator (Full Access)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
              <input
                type="password"
                required
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Quick PIN (4 digits)</label>
              <input
                type="password"
                maxLength="4"
                value={userForm.pin}
                onChange={(e) => setUserForm({ ...userForm, pin: e.target.value })}
                placeholder="1234"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone (Optional)</label>
            <input
              type="text"
              value={userForm.phone}
              onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
              placeholder="0300-1122334"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddUserOpen(false)}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20"
            >
              Create Staff User
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
