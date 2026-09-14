import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { useLanguage } from '../context/LanguageContext';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Search,
  Filter,
  ShieldCheck,
  Barcode,
  Layers,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowUpDown,
  Zap,
  DollarSign,
  TrendingUp
} from 'lucide-react';

export default function InventoryScreen({ onLowStockChange }) {
  const { isAdmin } = useAuth();
  const { isUrdu } = useLanguage();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all', 'low_stock', 'out_of_stock', 'has_serials'
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'name_asc', 'stock_asc', 'stock_desc', 'margin_desc'
  const [loading, setLoading] = useState(true);

  // Add / Edit Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    category_id: '',
    cost_price: 0,
    sale_price: 0,
    stock_quantity: 0,
    low_stock_threshold: 5,
    supplier_id: '',
    has_serials: 0,
    warranty_months: 12,
    description: '',
    initial_serials: ''
  });

  // Add Serials Modal state
  const [isAddSerialsOpen, setIsAddSerialsOpen] = useState(false);
  const [targetProductForSerials, setTargetProductForSerials] = useState(null);
  const [serialsText, setSerialsText] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [prodRes, catRes, supRes, lowRes] = await Promise.all([
        api.products.getAll(),
        api.products.getCategories(),
        api.products.getSuppliers(),
        api.products.getLowStockAlerts()
      ]);

      if (prodRes.success) setProducts(prodRes.products || []);
      if (catRes.success) setCategories(catRes.categories || []);
      if (supRes.success) setSuppliers(supRes.suppliers || []);
      if (lowRes.success && onLowStockChange) {
        onLowStockChange(lowRes.count);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      barcode: '',
      category_id: categories[0]?.id || '',
      cost_price: 0,
      sale_price: 0,
      stock_quantity: 1,
      low_stock_threshold: 5,
      supplier_id: suppliers[0]?.id || '',
      has_serials: 0,
      warranty_months: 12,
      description: '',
      initial_serials: ''
    });
    setErrorMsg('');
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      barcode: p.barcode || '',
      category_id: p.category_id || '',
      cost_price: p.cost_price || 0,
      sale_price: p.sale_price,
      stock_quantity: p.stock_quantity,
      low_stock_threshold: p.low_stock_threshold,
      supplier_id: p.supplier_id || '',
      has_serials: p.has_serials ? 1 : 0,
      warranty_months: p.warranty_months || 0,
      description: p.description || '',
      initial_serials: ''
    });
    setErrorMsg('');
    setIsEditModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      const payload = {
        ...formData,
        initial_serials: formData.initial_serials
          ? formData.initial_serials.split('\n').map(s => s.trim()).filter(Boolean)
          : []
      };

      if (editingProduct) {
        await api.products.update(editingProduct.id, payload);
        setSuccessMsg('Product updated successfully');
      } else {
        await api.products.create(payload);
        setSuccessMsg('Product created successfully');
      }

      setIsEditModalOpen(false);
      loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Operation failed');
    }
  };

  const handleDeleteProduct = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.products.delete(id);
      setSuccessMsg('Product deleted successfully');
      loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete product');
    }
  };

  const handleAddSerialsSubmit = async (e) => {
    e.preventDefault();
    if (!targetProductForSerials) return;

    const list = serialsText.split('\n').map(s => s.trim()).filter(Boolean);
    if (list.length === 0) {
      setErrorMsg('Please enter at least one serial number');
      return;
    }

    try {
      const res = await api.warranty.addSerials({
        product_id: targetProductForSerials.id,
        serial_numbers: list
      });
      if (res.success) {
        setSuccessMsg(res.message);
        setIsAddSerialsOpen(false);
        setSerialsText('');
        loadData();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to add serial numbers');
    }
  };

  const handleSyncSerials = async (productId) => {
    try {
      const res = await api.products.syncSerials(productId);
      if (res.success) {
        setSuccessMsg(res.message);
        loadData();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to sync serial numbers');
    }
  };

  const handleGenerateBarcode = () => {
    const randomCode = '200' + Math.floor(100000000 + Math.random() * 900000000);
    setFormData(prev => ({ ...prev, barcode: randomCode }));
  };

  // Summary metrics (reflects total catalog accurately at all times)
  const totalProductsCount = products.length;
  const totalStockUnits = products.reduce((acc, p) => acc + (Number(p.stock_quantity) || 0), 0);
  const totalCostValue = products.reduce((acc, p) => acc + ((Number(p.cost_price) || 0) * (Number(p.stock_quantity) || 0)), 0);
  const totalRetailValue = products.reduce((acc, p) => acc + ((Number(p.sale_price) || 0) * (Number(p.stock_quantity) || 0)), 0);
  const lowStockCount = products.filter(p => p.stock_quantity <= p.low_stock_threshold && p.stock_quantity > 0).length;
  const outOfStockCount = products.filter(p => p.stock_quantity <= 0).length;
  const serialsCount = products.filter(p => p.has_serials === 1).length;

  // Filtered and Sorted products list (0ms instant real-time search & filtering)
  const displayedProducts = useMemo(() => {
    const q = (search || '').trim().toLowerCase();

    return products
      .filter(p => {
        // Tab filter
        if (filterTab === 'low_stock' && !(p.stock_quantity <= p.low_stock_threshold && p.stock_quantity > 0)) return false;
        if (filterTab === 'out_of_stock' && !(p.stock_quantity <= 0)) return false;
        if (filterTab === 'has_serials' && p.has_serials !== 1) return false;

        // Category filter
        if (selectedCategory && String(p.category_id) !== String(selectedCategory)) return false;

        // Search filter: Item name, Barcode, Category, Supplier, Description, ID, and Serial Numbers
        if (q) {
          const matchName = p.name && p.name.toLowerCase().includes(q);
          const matchBarcode = p.barcode && p.barcode.toLowerCase().includes(q);
          const matchCat = p.category_name && p.category_name.toLowerCase().includes(q);
          const matchSup = p.supplier_name && p.supplier_name.toLowerCase().includes(q);
          const matchDesc = p.description && p.description.toLowerCase().includes(q);
          const matchId = String(p.id) === q;
          const matchSerials = Array.isArray(p.availableSerials) && p.availableSerials.some(s => (s || '').toLowerCase().includes(q));

          if (!matchName && !matchBarcode && !matchCat && !matchSup && !matchDesc && !matchId && !matchSerials) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'recent') {
          const dateA = a.updated_at || a.created_at || '';
          const dateB = b.updated_at || b.created_at || '';
          return dateB.localeCompare(dateA);
        }
        if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
        if (sortBy === 'stock_asc') return (Number(a.stock_quantity) || 0) - (Number(b.stock_quantity) || 0);
        if (sortBy === 'stock_desc') return (Number(b.stock_quantity) || 0) - (Number(a.stock_quantity) || 0);
        if (sortBy === 'margin_desc') {
          const profA = (Number(a.sale_price) || 0) - (Number(a.cost_price) || 0);
          const profB = (Number(b.sale_price) || 0) - (Number(b.cost_price) || 0);
          return profB - profA;
        }
        return 0;
      });
  }, [products, search, selectedCategory, filterTab, sortBy]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 text-slate-800 p-4 space-y-4">
      {/* Top Banner & Quick Action Cards (Matching Uizard Reference Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch shrink-0">
        {/* Left Greeting & Action Card */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 mb-1">
              <Package className="w-4 h-4" />
              <span>{isUrdu ? 'اسٹاک و انوینٹری کیٹلاگ' : 'Inventory & Stock Catalog'}</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {isUrdu ? 'عنائب کمپیوٹر ایکسیسریز' : 'Unaib Computer Accessories'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {isUrdu
                ? 'سامان کا اندراج، بار کوڈ اسکیننگ، خریداری رسیدیں اور سیریل نمبر اسٹاک سنکرونائزیشن'
                : 'Real-time catalog CRUD, barcode scanning, GRN purchase inwards, and serial stock synchronization.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 pt-4 mt-2 border-t border-slate-100">
            {isAdmin && (
              <button
                onClick={handleOpenCreate}
                className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isUrdu ? '+ نیا سامان شامل کریں' : '+ Add Accessory'}</span>
              </button>
            )}

            <button
              onClick={() => loadData(false)}
              title={isUrdu ? "انوینٹری تازہ کریں" : "Refresh Inventory"}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{isUrdu ? 'تازہ کریں' : 'Refresh'}</span>
            </button>

            {lowStockCount > 0 && (
              <button
                onClick={() => setFilterTab(filterTab === 'low_stock' ? 'all' : 'low_stock')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  filterTab === 'low_stock'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{lowStockCount} {isUrdu ? 'کم اسٹاک' : 'Low Stock'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Right 3 Tall Uizard Quick Action Cards */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. Ocean Blue Card - Total Products */}
          <div className="bg-blue-600 p-4 rounded-2xl text-white flex flex-col justify-between min-h-[140px] shadow-sm shadow-blue-500/20">
            <div>
              <span className="text-[11px] font-bold text-blue-100 uppercase tracking-wider block">
                {isUrdu ? 'کل سامان (کیٹلاگ)' : 'Total Catalog'}
              </span>
              <div className="text-2xl lg:text-3xl font-black font-mono tracking-tight text-white mt-1">
                {totalProductsCount}
              </div>
              <div className="text-xs text-blue-100 font-medium mt-0.5">
                {isUrdu ? 'فعال پروڈکٹس' : 'Active Products'}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
                <Package className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* 2. Fresh Teal Card - Total Stock Qty */}
          <div className="bg-teal-500 p-4 rounded-2xl text-white flex flex-col justify-between min-h-[140px] shadow-sm shadow-teal-500/20">
            <div>
              <span className="text-[11px] font-bold text-teal-100 uppercase tracking-wider block">
                {isUrdu ? 'موجود فزیکل اسٹاک' : 'Physical Stock'}
              </span>
              <div className="text-2xl lg:text-3xl font-black font-mono tracking-tight text-white mt-1">
                {totalStockUnits.toLocaleString()}
              </div>
              <div className="text-xs text-teal-100 font-medium mt-0.5">
                {isUrdu ? 'دستیاب یونٹس' : 'Available Units'}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
                <Layers className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* 3. Soft Indigo Card - Valuation Worth */}
          <div className="bg-indigo-500 p-4 rounded-2xl text-white flex flex-col justify-between min-h-[140px] shadow-sm shadow-indigo-500/20">
            <div>
              <span className="text-[11px] font-bold text-indigo-100 uppercase tracking-wider block">
                {isUrdu ? 'اسٹاک کی کل مالیت' : 'Stock Valuation'}
              </span>
              <div className="text-xl lg:text-2xl font-black font-mono tracking-tight text-white mt-1 truncate" title={`Rs. ${totalCostValue.toLocaleString()}`}>
                Rs. {totalCostValue > 1000000 ? `${(totalCostValue / 1000000).toFixed(2)}M` : totalCostValue.toLocaleString()}
              </div>
              <div className="text-xs text-indigo-100 font-medium mt-0.5">
                {isAdmin ? (isUrdu ? 'مال کی خریداری لاگت' : 'Maal Ki Lagat Cost') : (isUrdu ? 'مارکیٹ ریٹیل مالیت' : 'Market Retail Worth')}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unified White Card Container for Search, Filters & Catalog Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex-1 flex flex-col min-h-0 space-y-3">
        {/* Filter, Search, and Sort Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center shrink-0">
          {/* Search */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={isUrdu ? "نام، بار کوڈ، سیریل نمبر یا سپلائر تلاش کریں..." : "Search name, barcode, serial number, supplier..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden shadow-xs font-semibold transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer transition-colors"
                title={isUrdu ? "تلاش صاف کریں" : "Clear search"}
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category filter */}
          <div className="md:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 hover:bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm text-slate-800 focus:outline-hidden shadow-xs font-medium cursor-pointer transition-all"
            >
              <option value="">{isUrdu ? 'تمام کیٹیگریز' : 'All Categories'} ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Sort by */}
          <div className="md:col-span-4 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 shrink-0 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span>{isUrdu ? 'ترتیب:' : 'Sort:'}</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 hover:bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm text-slate-800 focus:outline-hidden shadow-xs font-medium cursor-pointer transition-all"
            >
              <option value="recent">{isUrdu ? '⚡ تازہ ترین شامل شدہ' : '⚡ Recently Updated / GRN First'}</option>
              <option value="name_asc">{isUrdu ? 'نام (الف تا ے)' : 'Name (A to Z)'}</option>
              <option value="stock_desc">{isUrdu ? 'اسٹاک: زیادہ سے کم' : 'Stock: High to Low'}</option>
              <option value="stock_asc">{isUrdu ? 'اسٹاک: کم سے زیادہ' : 'Stock: Low to High'}</option>
              {isAdmin && <option value="margin_desc">{isUrdu ? 'منافع: زیادہ سے کم' : 'Profit Margin: High to Low'}</option>}
            </select>
          </div>
        </div>

        {/* Quick Filter Tabs & Search Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {isUrdu ? 'تمام سامان' : 'All Items'} ({products.length})
            </button>

            <button
              onClick={() => setFilterTab('low_stock')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                filterTab === 'low_stock'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>{isUrdu ? 'کم اسٹاک' : 'Low Stock'} ({lowStockCount})</span>
            </button>

            <button
              onClick={() => setFilterTab('out_of_stock')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                filterTab === 'out_of_stock'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{isUrdu ? 'ختم اسٹاک' : 'Out of Stock'} ({outOfStockCount})</span>
            </button>

            <button
              onClick={() => setFilterTab('has_serials')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                filterTab === 'has_serials'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>{isUrdu ? 'سیریل ٹریکڈ' : 'Serial Tracked'} ({serialsCount})</span>
            </button>
          </div>

          {/* Live Filter Result Count & Reset */}
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <span>
              {isUrdu
                ? <span>دکھائے جا رہے ہیں <span className="text-blue-600 font-black">{displayedProducts.length}</span> کل {products.length} میں سے</span>
                : <span>Showing <span className="text-blue-600 font-black">{displayedProducts.length}</span> of {products.length} items</span>}
            </span>
            {(search || selectedCategory || filterTab !== 'all') && (
              <button
                onClick={() => { setSearch(''); setSelectedCategory(''); setFilterTab('all'); }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {isUrdu ? 'فلٹر ختم کریں' : 'Reset Filters'}
              </button>
            )}
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center justify-between font-semibold shrink-0">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')}><XCircle className="w-4 h-4" /></button>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center justify-between font-semibold shrink-0">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')}><CheckCircle2 className="w-4 h-4" /></button>
          </div>
        )}

        {/* Inventory Products Table */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200/80">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-800 uppercase tracking-wider text-xs font-black sticky top-0 z-10 border-b border-slate-200">
            <tr>
              <th className="py-3.5 px-3.5">{isUrdu ? 'سامان / آئٹم کا نام' : 'Accessory / Item'}</th>
              <th className="py-3.5 px-3">{isUrdu ? 'کیٹیگری' : 'Category'}</th>
              <th className="py-3.5 px-3">{isUrdu ? 'بار کوڈ' : 'Barcode'}</th>
              {isAdmin && <th className="py-3.5 px-3 text-right">{isUrdu ? 'لاگتِ خریداری' : 'Cost (GRN)'}</th>}
              <th className="py-3.5 px-3 text-right">{isUrdu ? 'قیمتِ فروخت' : 'Sale Price'}</th>
              {isAdmin && <th className="py-3.5 px-3 text-right">{isUrdu ? 'منافع (مارجن)' : 'Margin (Profit)'}</th>}
              <th className="py-3.5 px-3 text-center">{isUrdu ? 'اسٹاک و سیریلز' : 'Stock Qty & Serials'}</th>
              <th className="py-3.5 px-3 text-center">{isUrdu ? 'وارنٹی' : 'Warranty'}</th>
              <th className="py-3.5 px-3">{isUrdu ? 'سپلائر' : 'Supplier'}</th>
              <th className="py-3.5 pr-3 text-right">{isUrdu ? 'کارروائی' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={isAdmin ? 10 : 8} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-semibold">{isUrdu ? 'انوینٹری کا سامان لوڈ ہو رہا ہے...' : 'Loading Inventory Items...'}</span>
                  </div>
                </td>
              </tr>
            ) : displayedProducts.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 10 : 8} className="py-6 text-center text-slate-500 font-medium">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <Search className="w-7 h-7 text-slate-300" />
                    <span className="text-sm font-bold text-slate-700">
                      {search
                        ? (isUrdu ? `"${search}" سے ملتا جلتا کوئی سامان نہیں ملا` : `"${search}" se milta julta koi item nahi mila`)
                        : (isUrdu ? 'موجودہ فلٹر کے مطابق کوئی سامان موجود نہیں ہے۔' : 'No products found matching your current filter.')}
                    </span>
                    <span className="text-xs text-slate-400">
                      {isUrdu ? 'سامان کا نام، بار کوڈ، سیریل نمبر یا سپلائر چیک کریں' : 'Product ka naam, barcode, serial number ya supplier check karein'}
                    </span>
                    {(search || selectedCategory || filterTab !== 'all') && (
                      <button
                        onClick={() => { setSearch(''); setSelectedCategory(''); setFilterTab('all'); }}
                        className="mt-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                      >
                        {isUrdu ? 'فلٹر ختم کر کے تمام سامان دیکھیں' : 'Reset Filter & Show All Items'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              displayedProducts.map((p) => {
                const stockQty = Number(p.stock_quantity) || 0;
                const costPrice = Number(p.cost_price) || 0;
                const salePrice = Number(p.sale_price) || 0;
                const isLow = stockQty <= (p.low_stock_threshold || 5) && stockQty > 0;
                const isOut = stockQty <= 0;

                const profit = salePrice - costPrice;
                const marginPct = salePrice > 0 ? Math.round((profit / salePrice) * 100) : 0;

                const inStockSerialsCount = p.inStockSerialsCount !== undefined
                  ? p.inStockSerialsCount
                  : (p.availableSerials || []).length;
                const serialsMismatch = p.has_serials === 1 && inStockSerialsCount < stockQty;

                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-3.5">
                      <div className="font-bold text-sm text-slate-900">{p.name}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {p.has_serials === 1 && (
                          <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-bold px-2 py-0.5 rounded inline-block">
                            {isUrdu ? 'سیریل ٹریکڈ' : 'Serial Tracked'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-slate-700 font-medium">{p.category_name || (isUrdu ? 'عام' : 'General')}</td>
                    <td className="py-3.5 px-3 font-mono text-slate-600 font-semibold">{p.barcode || '—'}</td>

                    {/* Cost Price: Admin Only */}
                    {isAdmin && (
                      <td className="py-3.5 px-3 text-right font-mono text-slate-700 font-semibold">
                        Rs. {costPrice.toLocaleString()}
                      </td>
                    )}

                    <td className="py-3.5 px-3 text-right font-mono font-black text-emerald-700 text-sm">
                      Rs. {salePrice.toLocaleString()}
                    </td>

                    {/* Margin / Profit Column: Admin Only */}
                    {isAdmin && (
                      <td className="py-3.5 px-3 text-right font-mono">
                        <span className={profit >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                          Rs. {profit.toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-500 block font-medium">
                          {marginPct}% {isUrdu ? 'منافع' : 'margin'}
                        </span>
                      </td>
                    )}

                    {/* Stock Quantity with Alert Warning and Serials Status */}
                    <td className="py-2.5 px-2 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded text-xs ${
                          isOut
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : isLow
                            ? 'bg-amber-50 text-amber-800 border border-amber-300'
                            : 'bg-slate-100 text-slate-800 border border-slate-200'
                        }`}>
                          {isLow && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                          {stockQty} {isUrdu ? 'یونٹ' : 'Units'}
                        </span>

                        {p.has_serials === 1 && (
                          serialsMismatch ? (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] font-mono text-amber-800 bg-amber-50 px-1 rounded border border-amber-200">
                                {inStockSerialsCount}/{stockQty} {isUrdu ? 'سیریل' : 'Serials'}
                              </span>
                              {isAdmin && (
                                <button
                                  onClick={() => handleSyncSerials(p.id)}
                                  title={isUrdu ? "لاپتہ سیریل نمبرز خودکار بنائیں" : "Auto-generate missing serial numbers"}
                                  className="text-[9px] bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                                >
                                  {isUrdu ? 'آٹو فکس' : 'Auto-Fix'}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] font-mono text-blue-700 bg-blue-50 border border-blue-200 px-1 rounded">
                              ✓ {inStockSerialsCount} {isUrdu ? 'تیار' : 'Ready'}
                            </span>
                          )
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-2 text-center text-slate-600 font-mono">
                      {p.warranty_months > 0 ? `${p.warranty_months} ${isUrdu ? 'ماہ' : 'M'}` : (isUrdu ? 'وارنٹی نہیں' : 'No Warranty')}
                    </td>

                    <td className="py-2.5 px-2 text-slate-600">{p.supplier_name || '—'}</td>

                    {/* Actions */}
                    <td className="py-2.5 pr-3 text-right space-x-1.5 whitespace-nowrap">
                      {p.has_serials === 1 && isAdmin && (
                        <button
                          onClick={() => {
                            setTargetProductForSerials(p);
                            setSerialsText('');
                            setIsAddSerialsOpen(true);
                          }}
                          title={isUrdu ? "سیریل نمبرز شامل کریں" : "Add Serial Numbers"}
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-semibold border border-blue-200 transition-colors cursor-pointer"
                        >
                          + S/N
                        </button>
                      )}

                      {isAdmin && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(p)}
                            title={isUrdu ? "سامان میں ترمیم کریں" : "Edit Product"}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            title={isUrdu ? "سامان حذف کریں" : "Delete Product"}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>

      {/* CREATE / EDIT PRODUCT MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={editingProduct
          ? (isUrdu ? `سامان میں ترمیم: ${editingProduct.name}` : `Edit ${editingProduct.name}`)
          : (isUrdu ? 'نیا کمپیوٹر سامان / پارٹ شامل کریں' : 'Add New Computer Accessory')}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveProduct} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {isUrdu ? 'سامان یا کمپیوٹر پرزے کا نام *' : 'Item / Component Name *'}
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={isUrdu ? "مثلاً سام سنگ 980 پرو 1TB NVMe SSD" : "e.g. Samsung 980 Pro 1TB NVMe SSD"}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-700">
                  {isUrdu ? 'بار کوڈ / SKU' : 'Barcode / SKU'}
                </label>
                <button
                  type="button"
                  onClick={handleGenerateBarcode}
                  className="text-[10px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Zap className="w-3 h-3" />
                  <span>{isUrdu ? 'خودکار بار کوڈ' : 'Auto Barcode'}</span>
                </button>
              </div>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder={isUrdu ? "اسکین کریں یا بار کوڈ لکھیں" : "Scan or enter barcode"}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {isUrdu ? 'کیٹیگری' : 'Category'}
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden cursor-pointer"
              >
                <option value="">{isUrdu ? 'کیٹیگری منتخب کریں' : 'Select Category'}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {isUrdu ? 'لاگتِ خریداری (سپلائر ریٹ)' : 'Cost Price (Supplier Purchase)'}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {isUrdu ? 'قیمتِ فروخت (ریٹیل ریٹ) *' : 'Sale Price (Retail) *'}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={formData.sale_price}
                onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {isUrdu ? 'دکان میں موجود تعداد (اسٹاک)' : 'Stock Quantity On Hand'}
              </label>
              <input
                type="number"
                min="0"
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {isUrdu ? 'کم اسٹاک الرٹ کی حد' : 'Low Stock Alert Threshold'}
              </label>
              <input
                type="number"
                min="1"
                value={formData.low_stock_threshold}
                onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {isUrdu ? 'سپلائر / ڈسٹری بیوٹر' : 'Supplier'}
              </label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden cursor-pointer"
              >
                <option value="">{isUrdu ? 'سپلائر منتخب کریں' : 'Select Supplier'}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {isUrdu ? 'دکان کی وارنٹی (مہینوں میں)' : 'Shop Warranty (Months)'}
              </label>
              <input
                type="number"
                min="0"
                value={formData.warranty_months}
                onChange={(e) => setFormData({ ...formData, warranty_months: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Serial Number Tracking Toggle */}
            <div className="col-span-2 flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="has_serials"
                checked={formData.has_serials === 1}
                onChange={(e) => setFormData({ ...formData, has_serials: e.target.checked ? 1 : 0 })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="has_serials" className="text-xs font-semibold text-slate-800 cursor-pointer">
                {isUrdu
                  ? 'سیریل نمبرز کی ٹریکنگ فعال کریں (گرافکس کارڈ، ایس ایس ڈی، ریم، بورڈ وغیرہ کے لیے ضروری)'
                  : 'Track Component Serial Numbers (Recommended for GPUs, SSDs, Motherboards, RAM)'}
              </label>
            </div>

            {/* Initial Serial Numbers if creating new serialized product */}
            {!editingProduct && formData.has_serials === 1 && (
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {isUrdu ? 'موجودہ اسٹاک کے سیریل نمبر (ہر لائن پر ایک)' : 'Initial Serial Numbers in Stock (one per line)'}
                </label>
                <textarea
                  rows="3"
                  value={formData.initial_serials}
                  onChange={(e) => setFormData({ ...formData, initial_serials: e.target.value })}
                  placeholder="SN-SAM-980P-001&#10;SN-SAM-980P-002"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 cursor-pointer transition-colors"
            >
              {isUrdu ? 'منسوخ' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer transition-colors"
            >
              {editingProduct ? (isUrdu ? 'تبدیلیاں محفوظ کریں' : 'Save Changes') : (isUrdu ? 'سامان محفوظ کریں' : 'Create Product')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ADD SERIAL NUMBERS MODAL */}
      <Modal
        isOpen={isAddSerialsOpen}
        onClose={() => setIsAddSerialsOpen(false)}
        title={isUrdu ? `${targetProductForSerials?.name} کے لیے سیریل نمبر شامل کریں` : `Add In-Stock Serial Numbers for ${targetProductForSerials?.name}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAddSerialsSubmit} className="space-y-3">
          <p className="text-xs text-slate-600">
            {isUrdu
              ? 'نئے سیریل نمبرز اسکین یا درج کریں (ہر لائن پر ایک)۔ اس سے پروڈکٹ کا اسٹاک خودکار بڑھ جائے گا۔'
              : 'Enter or scan serial numbers to register in stock (one per line). Product stock quantity will automatically increase.'}
          </p>

          <textarea
            rows="6"
            required
            value={serialsText}
            onChange={(e) => setSerialsText(e.target.value)}
            placeholder="SN-10293847&#10;SN-10293848&#10;SN-10293849"
            className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden"
          />

          <div className="flex items-center space-x-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddSerialsOpen(false)}
              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 cursor-pointer transition-colors"
            >
              {isUrdu ? 'منسوخ' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer transition-colors"
            >
              {isUrdu ? 'سیریل نمبرز رجسٹر کریں' : 'Register Serial Numbers'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
