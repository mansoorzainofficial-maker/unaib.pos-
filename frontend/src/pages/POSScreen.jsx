import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import BarcodeScannerInput from '../components/BarcodeScannerInput';
import ThermalReceipt from '../components/ThermalReceipt';
import Modal from '../components/Modal';
import {
  Trash2,
  Plus,
  Minus,
  CheckCircle,
  AlertCircle,
  CreditCard,
  Banknote,
  Smartphone,
  Tag,
  UserCheck,
  User,
  Building2,
  Search,
  Printer,
  Package,
  ShieldCheck,
  Zap,
  RefreshCw
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { saveProductsCache, getCachedProducts, savePendingBill } from '../utils/indexedDB';
import { syncManager } from '../utils/syncManager';

export default function POSScreen({ onLowStockChange }) {
  const { t, isUrdu } = useLanguage();
  // Products catalog for quick lookup
  const [products, setProducts] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState([]);

  const DRAFT_STORAGE_KEY = 'unaib_pos_active_draft_bill';

  // Active Sale Cart with power-outage auto-recovery
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.cart) && parsed.cart.length > 0) return parsed.cart;
      }
    } catch (_) {}
    return [];
  });
  const [customerMode, setCustomerMode] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || '{}');
      return saved.customerMode || 'walkin';
    } catch (_) { return 'walkin'; }
  });
  const [customerName, setCustomerName] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || '{}');
      return saved.customerName || '';
    } catch (_) { return ''; }
  });
  const [customerPhone, setCustomerPhone] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || '{}');
      return saved.customerPhone || '';
    } catch (_) { return ''; }
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || '{}');
      return saved.selectedCustomerId || null;
    } catch (_) { return null; }
  });
  const [customers, setCustomers] = useState([]);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [showWalkinDetails, setShowWalkinDetails] = useState(false);
  const [partySearchQuery, setPartySearchQuery] = useState('');
  const [isPartyDropdownOpen, setIsPartyDropdownOpen] = useState(false);

  // Discount & Payment
  const [discountType, setDiscountType] = useState('amount'); // 'amount' or 'percentage'
  const [discountValue, setDiscountValue] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || '{}');
      return saved.discountValue || 0;
    } catch (_) { return 0; }
  });
  const [taxRate, setTaxRate] = useState(0); // e.g. 0% or custom
  const [defaultTaxRate, setDefaultTaxRate] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash', 'card', 'online'
  const [tenderedCash, setTenderedCash] = useState('');
  const [notes, setNotes] = useState('');
  const [recoveredNotice, setRecoveredNotice] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed.cart) && parsed.cart.length > 0;
      }
    } catch (_) {}
    return false;
  });

  // Modals & States
  const [serialModalItem, setSerialModalItem] = useState(null); // Item currently configuring serial numbers
  const [serialInputs, setSerialInputs] = useState([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fastSearch, setFastSearch] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load products & categories on mount + on window focus
  useEffect(() => {
    loadCatalog();
    const handleFocus = () => {
      loadCatalog();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const loadCatalog = async () => {
    try {
      const [prodRes, catRes, lowRes, custRes, setRes] = await Promise.all([
        api.products.getAll(),
        api.products.getCategories().catch(() => ({ success: false, categories: [] })),
        api.products.getLowStockAlerts().catch(() => ({ success: false, count: 0 })),
        api.invoices.getCustomers().catch(() => ({ success: false, customers: [] })),
        api.settings.get().catch(() => ({ success: false }))
      ]);

      if (prodRes?.success && Array.isArray(prodRes.products)) {
        setProducts(prodRes.products);
        // Requirement 1: Products ko IndexedDB mein cache karo
        saveProductsCache(prodRes.products).catch(err => {
          console.warn('Could not update products in IndexedDB cache:', err);
        });
      }
      if (catRes?.success) setCategories(catRes.categories);
      if (custRes?.success) setCustomers(custRes.customers || []);
      if (lowRes?.success && onLowStockChange) {
        onLowStockChange(lowRes.count);
      }
      if (setRes?.success && setRes?.settings?.default_sales_tax_rate) {
        const defTax = Number(setRes.settings.default_sales_tax_rate);
        if (!isNaN(defTax)) {
          setDefaultTaxRate(defTax);
          setTaxRate(defTax);
        }
      }
    } catch (err) {
      console.warn('Network issue fetching catalog. Loading from IndexedDB offline cache:', err);
      try {
        const cached = await getCachedProducts();
        if (cached && cached.length > 0) {
          setProducts(cached);
          console.log(`Loaded ${cached.length} products from offline IndexedDB cache.`);
        }
      } catch (cacheErr) {
        console.error('Failed to load products from IndexedDB:', cacheErr);
      }
    }
  };

  // Real-time Auto-Save active bill draft to localStorage (Safe from sudden power cuts / crash)
  useEffect(() => {
    try {
      if (cart.length > 0) {
        const draft = {
          cart,
          customerMode,
          customerName,
          customerPhone,
          selectedCustomerId,
          discountValue,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } else {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Could not auto-save draft bill to localStorage:', e);
    }
  }, [cart, customerMode, customerName, customerPhone, selectedCustomerId, discountValue]);

  // Barcode / Manual Input Handler (Scanner or Manual Typing)
  const handleBarcodeScan = async (barcode) => {
    setErrorMsg('');
    const cleanInput = (barcode || '').trim();
    if (!cleanInput) return;

    // 1. Direct match with locally loaded catalog by barcode
    const exactBarcodeMatch = products.find(p => p.barcode && p.barcode.toLowerCase() === cleanInput.toLowerCase());
    if (exactBarcodeMatch) {
      addToCart(exactBarcodeMatch);
      return;
    }

    // 2. Try exact barcode lookup from server database
    try {
      const res = await api.products.getByBarcode(cleanInput);
      if (res.success && res.product) {
        addToCart(res.product);
        return;
      }
    } catch (err) {
      // Not found by exact barcode, proceed to manual name/model/code search
    }

    // 3. Fallback: Search loaded products by name, model, code snippet, or ID
    const query = cleanInput.toLowerCase();
    const match = products.find(p =>
      p.name.toLowerCase().includes(query) ||
      (p.barcode && p.barcode.toLowerCase().includes(query)) ||
      String(p.id) === query
    );

    if (match) {
      addToCart(match);
      return;
    }

    setErrorMsg(`"${cleanInput}" na barcode me mila na catalog me. Sahi barcode ya product name darj karein.`);
  };

  // Helper to autofill serial numbers for an item matching its quantity without prompting
  const getAutoSerials = (item, targetQty, existingSerials = []) => {
    const serials = [...existingSerials];
    const available = item.availableSerials || [];
    const prefix = (item.name || 'ACC').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
    const timeCode = Date.now().toString().slice(-4);

    while (serials.length < targetQty) {
      const nextAvail = available.find(s => !serials.includes(s));
      if (nextAvail) {
        serials.push(nextAvail);
      } else {
        serials.push(`${prefix}-${timeCode}-${String(serials.length + 1).padStart(2, '0')}`);
      }
    }
    return serials.slice(0, targetQty);
  };

  // Add product to cart (100% Automatic serial assignment without blocking modal)
  const addToCart = (product) => {
    setErrorMsg('');
    const existingIndex = cart.findIndex(item => item.product_id === product.id);

    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty + 1 > product.stock_quantity) {
        setErrorMsg(`Stock limit reached for ${product.name}. Available: ${product.stock_quantity}`);
        return;
      }

      const updated = [...cart];
      const newQty = currentQty + 1;
      updated[existingIndex].quantity = newQty;
      if (product.has_serials) {
        updated[existingIndex].serial_numbers = getAutoSerials(product, newQty, updated[existingIndex].serial_numbers);
      }
      setCart(updated);
    } else {
      if (product.stock_quantity < 1) {
        setErrorMsg(`"${product.name}" is out of stock!`);
        return;
      }

      const autoSerials = product.has_serials ? getAutoSerials(product, 1, []) : [];
      const newItem = {
        product_id: product.id,
        name: product.name,
        barcode: product.barcode,
        sale_price: product.sale_price,
        stock_quantity: product.stock_quantity,
        has_serials: product.has_serials,
        warranty_months: product.warranty_months,
        quantity: 1,
        serial_numbers: autoSerials,
        availableSerials: product.availableSerials || []
      };

      setCart([...cart, newItem]);
    }
  };

  // Optional manual serial edit modal (only if user explicitly clicks Edit)
  const promptSerialConfig = (cartItem) => {
    setSerialModalItem(cartItem);
    const existing = cartItem.serial_numbers || [];
    const available = cartItem.availableSerials || [];
    const inputs = [];
    for (let i = 0; i < cartItem.quantity; i++) {
      inputs.push(existing[i] || available[i] || '');
    }
    setSerialInputs(inputs);
  };

  const handleSaveSerials = () => {
    if (!serialModalItem) return;

    let filled = serialInputs.map(s => s.trim()).filter(Boolean);
    if (filled.length < serialModalItem.quantity) {
      const prefix = (serialModalItem.name || 'ACC').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
      const timeCode = Date.now().toString().slice(-4);
      while (filled.length < serialModalItem.quantity) {
        filled.push(`${prefix}-${timeCode}-${filled.length + 1}`);
      }
    }

    const updated = cart.map(item => {
      if (item.product_id === serialModalItem.product_id) {
        return { ...item, serial_numbers: filled };
      }
      return item;
    });

    setCart(updated);
    setSerialModalItem(null);
    setSerialInputs([]);
    setErrorMsg('');
  };

  // Adjust quantity
  const updateQuantity = (productId, delta) => {
    const updated = cart.map(item => {
      if (item.product_id === productId) {
        const newQty = item.quantity + delta;
        if (newQty > item.stock_quantity) {
          setErrorMsg(`Stock limit reached! Available: ${item.stock_quantity}`);
          return item;
        }
        if (newQty <= 0) return null;

        // If serialized component, automatically adjust serials length
        if (item.has_serials) {
          const serials = getAutoSerials(item, newQty, item.serial_numbers);
          return { ...item, quantity: newQty, serial_numbers: serials };
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean);

    setCart(updated);
  };

  // Remove item
  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  // Clear entire cart & reset to default Walk-in Customer
  const clearCart = () => {
    setCart([]);
    setCustomerMode('walkin');
    setCustomerName('');
    setCustomerPhone('');
    setSelectedCustomerId(null);
    setShowCustomerList(false);
    setShowWalkinDetails(false);
    setDiscountValue(0);
    setTaxRate(defaultTaxRate);
    setTenderedCash('');
    setNotes('');
    setErrorMsg('');
    setRecoveredNotice(false);
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (_) {}
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.sale_price * item.quantity), 0);

  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = (subtotal * (Number(discountValue) || 0)) / 100;
  } else {
    discountAmount = Number(discountValue) || 0;
  }
  discountAmount = Math.min(discountAmount, subtotal);

  const taxableAmount = subtotal - discountAmount;
  const taxAmount = (taxableAmount * (Number(taxRate) || 0)) / 100;
  const grandTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

  // In Cash mode, paidAmount defaults to grandTotal; In Udhar mode, defaults to 0 (full Udhar)
  const paidAmount = customerMode === 'walkin'
    ? (tenderedCash !== '' ? Number(tenderedCash) : grandTotal)
    : (tenderedCash !== '' ? Number(tenderedCash) : 0);
  const balanceDue = Math.max(0, Math.round((grandTotal - paidAmount) * 100) / 100);
  const changeDue = customerMode === 'walkin' ? Math.max(0, Math.round((paidAmount - grandTotal) * 100) / 100) : 0;
  const selectedParty = customers.find(c => c.id === selectedCustomerId);
  const partiesList = customers;

  // Keyboard Shortcuts (F1, F4, Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        clearCart();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) setIsCheckoutOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart]);

  // Complete Sale and Checkout
  const handleProcessSale = async () => {
    if (cart.length === 0) {
      setErrorMsg('Cart is empty');
      return;
    }

    // Auto-verify / auto-fill serial numbers on serialized items with zero blocking
    const processedCart = cart.map(item => {
      if (item.has_serials) {
        const serials = (item.serial_numbers && item.serial_numbers.length === item.quantity)
          ? item.serial_numbers
          : getAutoSerials(item, item.quantity, item.serial_numbers);
        return { ...item, serial_numbers: serials };
      }
      return item;
    });

    // Resolve Customer Details based on selected mode
    let finalCustomerName = '';
    let finalCustomerId = null;

    if (customerMode === 'walkin') {
      finalCustomerName = customerName.trim() || (balanceDue > 0 ? (isUrdu ? `واک ان ادھار گاہک (${new Date().toLocaleDateString('en-GB')})` : `Walk-in Credit (${new Date().toLocaleDateString('en-GB')})`) : (isUrdu ? 'عام واک ان گاہک' : 'Walk-in Customer'));
      finalCustomerId = null;
    } else {
      // Registered Wholesale Party
      if (!selectedCustomerId) {
        if (customerName.trim()) {
          finalCustomerName = customerName.trim();
          finalCustomerId = null;
        } else {
          setErrorMsg(t('select_party_err'));
          return;
        }
      } else {
        finalCustomerId = selectedCustomerId;
        const foundParty = customers.find(c => c.id === selectedCustomerId);
        finalCustomerName = foundParty ? foundParty.name : (customerName.trim() || (isUrdu ? 'ہول سیل پارٹی' : 'Wholesale Party'));
      }
    }

    setIsSubmitting(true);
    setErrorMsg('');

    // -------------------------------------------------------------
    // DUAL LOGIC: SAVE ONLINE / SAVE OFFLINE
    // -------------------------------------------------------------

    const saveOnline = async (payload) => {
      const res = await api.invoices.create(payload);
      if (res && res.success && res.invoice) {
        setCompletedInvoice(res.invoice);
        setIsCheckoutOpen(false);
        clearCart();
        loadCatalog(); // Refresh stocks & customer balances
        return res.invoice;
      } else {
        throw new Error(res?.message || 'Transaction failed');
      }
    };

    const saveOffline = async (payload, cartItems, custName) => {
      // 1. Save bill in IndexedDB pending_bills store
      const savedRecord = await savePendingBill(payload);

      // 2. Format invoice matching ThermalReceipt structure for instant offline print
      const offlineInvoice = {
        id: savedRecord.local_id,
        local_id: savedRecord.local_id,
        invoice_number: savedRecord.invoice_number,
        customer_id: payload.customer_id,
        customer_name: custName,
        customer_phone: payload.customer_phone,
        items: cartItems.map(item => ({
          product_id: item.product_id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.sale_price,
          total_price: (Number(item.sale_price) || 0) * (Number(item.quantity) || 1),
          warranty_months: item.warranty_months || 0,
          serial_numbers: item.serial_numbers || []
        })),
        subtotal,
        discount_type: discountType,
        discount_value: Number(discountValue) || 0,
        discount_amount: discountAmount,
        tax_rate: Number(taxRate) || 0,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        paid_amount: paidAmount,
        change_amount: changeDue,
        balance_due: balanceDue,
        payment_method: paymentMethod,
        notes: notes || '',
        created_at: savedRecord.created_at,
        is_offline: true
      };

      // 3. Decrement local product stock in UI so subsequent offline sales reflect reduced inventory
      setProducts(prevProducts => {
        const productQtyMap = new Map();
        for (const it of cartItems) {
          productQtyMap.set(it.product_id, (productQtyMap.get(it.product_id) || 0) + it.quantity);
        }
        return prevProducts.map(p => {
          if (productQtyMap.has(p.id)) {
            return {
              ...p,
              stock_quantity: (Number(p.stock_quantity) || 0) - productQtyMap.get(p.id)
            };
          }
          return p;
        });
      });

      // 4. Open Thermal Receipt Preview for printing
      setCompletedInvoice(offlineInvoice);
      setIsCheckoutOpen(false);
      clearCart();

      // 5. User Notification
      setSuccessMsg(isUrdu
        ? 'بل آف لائن محفوظ ہو گیا - انٹرنیٹ آنے پر خودکار سنک ہو جائے گا'
        : 'Bill saved offline - will sync automatically when online'
      );
      setTimeout(() => setSuccessMsg(''), 6000);

      return offlineInvoice;
    };

    try {
      const payload = {
        customer_mode: customerMode,
        customer_id: finalCustomerId,
        customer_name: finalCustomerName,
        customer_phone: customerPhone.trim() || null,
        items: processedCart.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.sale_price,
          serial_numbers: item.serial_numbers || []
        })),
        discount_type: discountType,
        discount_value: Number(discountValue) || 0,
        tax_rate: Number(taxRate) || 0,
        payment_method: paymentMethod,
        paid_amount: paidAmount,
        notes: notes
      };

      const isNetworkOnline = syncManager.isOnline();

      if (isNetworkOnline) {
        try {
          await saveOnline(payload);
        } catch (onlineErr) {
          // If network failed mid-request or server unreachable, fallback to offline save
          if (!navigator.onLine || onlineErr.message?.includes('Failed to fetch') || onlineErr.message?.includes('NetworkError')) {
            console.warn('Network failed during sale submission. Falling back to offline save:', onlineErr);
            await saveOffline(payload, processedCart, finalCustomerName);
          } else {
            throw onlineErr;
          }
        }
      } else {
        // Offline: save to IndexedDB directly
        await saveOffline(payload, processedCart, finalCustomerName);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Transaction failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter products in catalog pane
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'all' || String(p.category_id) === String(selectedCategory);
    const matchesSearch = !catalogSearch ||
      p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      (p.barcode && p.barcode.includes(catalogSearch));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-100 text-slate-800">
      {/* Full-width POS Terminal Core */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden shadow-xs">
        {/* Top Scanner, Fast Item Search & Customer Bar */}
        <div className="p-3 border-b border-slate-200 bg-white space-y-2.5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
            {/* 1. Barcode Scanner with subtle F2 badge */}
            <div className="md:col-span-6 relative">
              <BarcodeScannerInput
                onScan={handleBarcodeScan}
                placeholder={t('scan_placeholder')}
              />
              <div className="absolute right-3 top-2.5 pointer-events-none">
                <kbd className="text-[10px] font-mono font-semibold text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">
                  F2
                </kbd>
              </div>
            </div>

            {/* 2. Fast Product Name Search with Live Dropdown */}
            <div className="md:col-span-6 relative">
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t('search_placeholder')}
                    value={fastSearch}
                    onFocus={() => setShowSearchDropdown(true)}
                    onChange={(e) => {
                      setFastSearch(e.target.value);
                      setShowSearchDropdown(true);
                    }}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsRefreshing(true);
                    loadCatalog().finally(() => setTimeout(() => setIsRefreshing(false), 500));
                  }}
                  title={isUrdu ? 'اسٹاک اور پراڈکٹس ری فریش کریں' : 'Refresh products & stock'}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
                </button>
              </div>

              {/* Fast Search Autocomplete Dropdown */}
              {showSearchDropdown && fastSearch.trim().length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {products
                    .filter(p =>
                      p.name.toLowerCase().includes(fastSearch.toLowerCase()) ||
                      (p.barcode && p.barcode.includes(fastSearch))
                    )
                    .slice(0, 10)
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          addToCart(item);
                          setFastSearch('');
                          setShowSearchDropdown(false);
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-emerald-50 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex-1 pr-2">
                          <div className="font-semibold text-xs text-slate-900">{item.name}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-2">
                            {item.barcode && <span className="font-mono bg-slate-100 px-1 rounded">[{item.barcode}]</span>}
                            <span>{t('stock_avail')} {item.stock_quantity}</span>
                          </div>
                        </div>
                        <div className="font-mono font-bold text-xs text-emerald-700">
                          Rs. {Number(item.sale_price).toLocaleString()}
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Power Outage / Crash Recovery Notice Banner */}
        {recoveredNotice && cart.length > 0 && (
          <div className="mx-3 mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-950 animate-fade-in shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">⚡</span>
              <div>
                <span className="font-bold">{t('recovered_bill_title')}</span>
                <span className="text-slate-700 ml-1.5">
                  {t('recovered_bill_sub')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRecoveredNotice(false)}
              className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 rounded-lg text-amber-950 font-bold text-[11px] cursor-pointer transition-colors"
            >
              {t('btn_ok')}
            </button>
          </div>
        )}

        {/* Alerts / Error Banner */}
        {errorMsg && (
          <div className="mx-3 mt-2 p-2 bg-rose-500/10 border border-rose-500/30 text-rose-600 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Cart Line Items Header Strip with Clear Cart */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-xs">
          <div className="font-bold text-slate-700 flex items-center gap-2">
            <span>{isUrdu ? `بل کا سامان (${cart.reduce((s, i) => s + i.quantity, 0)})` : `Bill Items (${cart.reduce((s, i) => s + i.quantity, 0)})`}</span>
            {customerMode === 'walkin' ? (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold border border-emerald-300">
                {t('cash_deal')}
              </span>
            ) : (
              <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold border border-blue-300">
                {t('udhar_deal')}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-[11px] text-slate-500 hover:text-rose-600 font-semibold flex items-center gap-1 cursor-pointer transition-colors px-2 py-0.5 rounded hover:bg-rose-50"
              title={t('clear_cart')}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('clear_cart_btn')}</span>
            </button>
          )}
        </div>

        {/* Cart Line Items Table */}
        <div className="flex-1 overflow-y-auto p-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Package className="w-12 h-12 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">{t('cart_empty_title')}</p>
              <p className="text-xs text-slate-400">{t('cart_empty_sub')}</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 pl-3">{t('col_item')}</th>
                  <th className="py-2.5 text-center w-28">{t('col_qty')}</th>
                  <th className="py-2.5 text-right w-24">{t('col_price')}</th>
                  <th className="py-2.5 text-right w-24">{t('col_total')}</th>
                  <th className="py-2.5 pr-3 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cart.map((item) => (
                  <tr key={item.product_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 pl-3">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2">
                        {item.barcode && <span className="font-mono bg-slate-100 px-1 py-0.2 rounded border border-slate-200">[{item.barcode}]</span>}
                        {item.warranty_months > 0 && (
                          <span className="text-emerald-700 font-medium flex items-center gap-0.5">
                            <ShieldCheck className="w-3 h-3" /> {item.warranty_months}M Warranty
                          </span>
                        )}
                      </div>

                      {/* Serial Numbers Warning / Display */}
                      {item.has_serials && (
                        <div className="mt-1">
                          {item.serial_numbers && item.serial_numbers.length === item.quantity ? (
                            <div className="text-[10px] text-slate-700 font-mono flex flex-wrap gap-1 items-center">
                              <span className="text-emerald-700 font-bold">Serials:</span>
                              {item.serial_numbers.map((sn, idx) => (
                                <span key={idx} className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 font-mono">
                                  {sn}
                                </span>
                              ))}
                              <button
                                onClick={() => promptSerialConfig(item)}
                                className="text-[10px] text-blue-600 hover:underline ml-1 font-semibold"
                              >
                                Edit
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => promptSerialConfig(item)}
                              className="text-[10px] font-bold text-amber-800 hover:text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse"
                            >
                              <AlertCircle className="w-3 h-3" /> Add {item.quantity} Serial Number(s) Required
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Quantity Controls */}
                    <td className="py-2.5 text-center">
                      <div className="inline-flex items-center space-x-1 bg-slate-100 border border-slate-300 rounded-lg p-1">
                        <button
                          onClick={() => updateQuantity(item.product_id, -1)}
                          className="p-1 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center font-mono font-bold text-slate-900">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product_id, 1)}
                          className="p-1 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    <td className="py-2.5 text-right font-mono text-slate-700">
                      Rs. {item.sale_price.toLocaleString()}
                    </td>

                    <td className="py-2.5 text-right font-mono font-bold text-emerald-600">
                      Rs. {(item.sale_price * item.quantity).toLocaleString()}
                    </td>

                    <td className="py-2.5 pr-3 text-center">
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                        title="Remove Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Bottom Totals & Instant Checkout Bar */}
        <div className="p-4 border-t border-slate-200 bg-white shadow-lg space-y-3">
          {/* Quick Discount & Tax Bar - Clean and Compact */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="flex items-center space-x-2">
              <Tag className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-600 font-bold">{t('discount')}</span>
              <input
                type="number"
                min="0"
                value={discountValue || ''}
                placeholder="0"
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-right font-mono text-slate-900 focus:border-emerald-500 focus:outline-hidden"
              />
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                className="bg-white border border-slate-300 text-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-hidden"
              >
                <option value="amount">Rs.</option>
                <option value="percentage">%</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-slate-600 font-bold">{t('tax')}</span>
              <input
                type="number"
                min="0"
                value={taxRate || ''}
                placeholder="0"
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-right font-mono text-slate-900 focus:border-emerald-500 focus:outline-hidden"
              />
              <span className="text-slate-500 font-semibold">%</span>
            </div>
          </div>

          {/* Subtotal / Net Due */}
          <div className="flex items-end justify-between pt-2 border-t border-slate-200">
            <div>
              <div className="text-xs text-slate-600">
                <span>{t('subtotal')} </span><span className="font-mono font-semibold text-slate-800">Rs. {subtotal.toLocaleString()}</span>
                {discountAmount > 0 && <span className="ml-2 text-rose-600 font-mono font-medium">(-Rs. {discountAmount.toLocaleString()})</span>}
                {taxAmount > 0 && <span className="ml-2 text-amber-800 font-mono font-bold">(+Tax {taxRate}%: Rs. {taxAmount.toLocaleString()})</span>}
              </div>
              <div className="text-xs text-slate-500">{t('items_count')} {cart.reduce((s, i) => s + i.quantity, 0)}</div>
            </div>

            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">{t('grand_total')}</div>
              <div className="text-3xl font-black font-mono text-emerald-600 tracking-tight">
                Rs. {grandTotal.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Proceed to Payment Trigger Button - Clean Single Language with Subtle F4 Badge */}
          <button
            onClick={() => {
              setErrorMsg('');
              setIsCheckoutOpen(true);
            }}
            disabled={cart.length === 0}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center space-x-2 text-sm transition-all cursor-pointer"
            title={t('proceed_to_payment')}
          >
            <CheckCircle className="w-5 h-5" />
            <span>{t('proceed_to_payment')}</span>
            <kbd className="ml-2 text-[10px] bg-emerald-800/40 text-emerald-200 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
              F4
            </kbd>
          </button>
        </div>
      </div>



      {/* CHECKOUT MODAL */}
      {/* SEPARATE PAYMENT & BILLING WINDOW (MODAL) */}
      <Modal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        title={t('payment_modal_title')}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          {/* Total Summary Header Card */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between shadow-lg">
            <div>
              <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{t('grand_total')}</div>
              <div className="text-3xl font-black font-mono text-emerald-400 tracking-tight">
                Rs. {grandTotal.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <span className="px-3 py-1 bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold font-mono">
                {cart.reduce((s, i) => s + i.quantity, 0)} {isUrdu ? 'سامان' : 'Items'}
              </span>
            </div>
          </div>

          {/* Payment Mode Selector Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">{t('payment_method_label')}</label>
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setCustomerMode('walkin');
                  setPaymentMethod('cash');
                  setSelectedCustomerId(null);
                  setCustomerName('');
                  setCustomerPhone('');
                  setPartySearchQuery('');
                  setTenderedCash('');
                }}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  customerMode === 'walkin' && paymentMethod === 'cash'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>{t('tab_cash')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCustomerMode('party');
                  setPaymentMethod('cash'); // party invoices can have advance cash
                  setTenderedCash('');
                }}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  customerMode === 'party'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>{t('tab_udhar')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCustomerMode('walkin');
                  setPaymentMethod('card');
                  setSelectedCustomerId(null);
                  setCustomerName('');
                  setCustomerPhone('');
                  setPartySearchQuery('');
                  setTenderedCash(grandTotal.toString());
                }}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  customerMode === 'walkin' && (paymentMethod === 'card' || paymentMethod === 'online')
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>{t('tab_bank')}</span>
              </button>
            </div>
          </div>

          {/* 1. NAQAD CASH MODE */}
          {customerMode === 'walkin' && paymentMethod === 'cash' && (
            <div className="space-y-3 bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-emerald-700" />
                  <span>{t('cash_tendered_label')}</span>
                </span>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                  {isUrdu ? 'کاؤنٹر نقد سیل' : 'Walk-in Retail'}
                </span>
              </div>

              {/* Cash Input & Exact Button */}
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder={isUrdu ? "کتنے روپے وصول ہوئے..." : "Enter received amount..."}
                  value={tenderedCash}
                  onChange={(e) => setTenderedCash(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-emerald-300 rounded-xl text-lg font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setTenderedCash(grandTotal.toString())}
                  className="px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-xl text-xs font-bold border border-emerald-300 cursor-pointer"
                >
                  {t('exact_cash_btn')}
                </button>
              </div>

              {/* Quick Note Buttons */}
              <div className="grid grid-cols-5 gap-1.5">
                {[500, 1000, 5000, 10000, 50000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTenderedCash(amt.toString())}
                    className="py-1.5 bg-white hover:bg-emerald-100 text-slate-800 border border-slate-200 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer"
                  >
                    {amt >= 1000 ? `${amt / 1000}k` : amt}
                  </button>
                ))}
              </div>

              {/* Real-time Baqaya Wapis / Change */}
              <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-emerald-200">
                <span className="text-xs font-bold text-slate-700">{t('change_due_label')}</span>
                {changeDue > 0 ? (
                  <span className="text-base font-black font-mono text-emerald-700">
                    Rs. {changeDue.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-xs font-bold font-mono text-slate-500">
                    {tenderedCash && Number(tenderedCash) < grandTotal ? (
                      <span className="text-amber-700">{t('short_amount_label')} Rs. {(grandTotal - Number(tenderedCash)).toLocaleString()}</span>
                    ) : (
                      `Rs. 0 (${t('full_settled_label')})`
                    )}
                  </span>
                )}
              </div>

              {/* Optional Customer Name & WhatsApp Phone */}
              <div className="pt-2 border-t border-emerald-200/80">
                <div className="text-[11px] font-semibold text-slate-600 mb-1">{t('cust_name_optional')}</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder={isUrdu ? "گاہک کا نام (اختیاری)" : "Customer Name (Optional)"}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder={isUrdu ? "موبائل نمبر (0300-1234567)" : "Mobile # (0300-1234567)"}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. UDHAR INVOICE / KHATA MODE */}
          {customerMode === 'party' && (
            <div className="space-y-3 bg-blue-50/60 p-3.5 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-700" />
                  <span>{t('wholesale_heading')}</span>
                </span>
                <span className="text-[11px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                  {t('credit_sale_badge')}
                </span>
              </div>

              {/* Party Autocomplete Search / Select */}
              <div className="relative">
                <input
                  type="text"
                  placeholder={t('select_party_placeholder')}
                  value={partySearchQuery}
                  onChange={(e) => {
                    setPartySearchQuery(e.target.value);
                    setIsPartyDropdownOpen(true);
                  }}
                  onFocus={() => setIsPartyDropdownOpen(true)}
                  onClick={() => setIsPartyDropdownOpen(true)}
                  className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                {selectedParty && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomerId(null);
                      setCustomerName('');
                      setCustomerPhone('');
                      setPartySearchQuery('');
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}

                {isPartyDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-50 divide-y divide-slate-100">
                    {partiesList
                      .filter((c) =>
                        (c.name || '').toLowerCase().includes(partySearchQuery.toLowerCase()) ||
                        (c.phone || '').includes(partySearchQuery)
                      )
                      .slice(0, 8)
                      .map((cust) => (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId(cust.id);
                            setCustomerName(cust.name);
                            setCustomerPhone(cust.phone || '');
                            setPartySearchQuery(cust.name);
                            setIsPartyDropdownOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between cursor-pointer"
                        >
                          <div>
                            <div className="font-semibold text-xs text-slate-900">{cust.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{cust.phone || 'No phone'}</div>
                          </div>
                          <div className="text-right">
                            <span className={`text-[11px] font-mono font-bold ${cust.current_balance > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                              {t('party_khata_label')} Rs. {Number(cust.current_balance || 0).toLocaleString()}
                            </span>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Advance Cash Wasool */}
              <div className="bg-white p-2.5 rounded-xl border border-blue-200 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-800">{t('cash_paid_now')}</div>
                    <div className="text-[10px] text-slate-500">{t('cash_paid_sub')}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-500 font-mono">Rs.</span>
                    <input
                      type="number"
                      min="0"
                      placeholder={t('poora_udhar')}
                      value={tenderedCash}
                      onChange={(e) => setTenderedCash(e.target.value)}
                      className="w-36 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono font-bold text-right text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Quick Preset Buttons: 0 (Udhar), 5k, 10k, 20k, 30k, 50k, Half, Full Bill */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-0.5">{t('quick_select')}</span>
                  <button
                    type="button"
                    onClick={() => setTenderedCash('0')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                      tenderedCash === '0' || tenderedCash === ''
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {t('poora_udhar')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTenderedCash('5000')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                      tenderedCash === '5000'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    5k
                  </button>
                  <button
                    type="button"
                    onClick={() => setTenderedCash('10000')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                      tenderedCash === '10000'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    10k
                  </button>
                  <button
                    type="button"
                    onClick={() => setTenderedCash('20000')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                      tenderedCash === '20000'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    20k
                  </button>
                  <button
                    type="button"
                    onClick={() => setTenderedCash('30000')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                      tenderedCash === '30000'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    30k
                  </button>
                  <button
                    type="button"
                    onClick={() => setTenderedCash('50000')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                      tenderedCash === '50000'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    50k
                  </button>
                  <button
                    type="button"
                    onClick={() => setTenderedCash(String(Math.round(grandTotal / 2)))}
                    className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[11px] font-bold cursor-pointer"
                  >
                    {t('half_50')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTenderedCash(String(grandTotal))}
                    className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 rounded-md text-[11px] font-bold cursor-pointer"
                  >
                    {t('full_bill')}
                  </button>
                </div>
              </div>

              {/* Khata Summary Breakdown */}
              <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-200 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-700">
                  <span>{t('prev_khata_label')}</span>
                  <span className="font-mono font-bold">
                    Rs. {Number(selectedParty?.current_balance || 0).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span>{t('curr_bill_label')}</span>
                  <span className="font-mono font-bold">
                    + Rs. {grandTotal.toLocaleString()}
                  </span>
                </div>

                {paidAmount > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>{t('amount_received')}</span>
                    <span className="font-mono font-bold text-emerald-700">
                      - Rs. {paidAmount.toLocaleString()}
                    </span>
                  </div>
                )}

                {paidAmount > grandTotal ? (
                  <div className="flex justify-between text-emerald-900 bg-emerald-100/90 border border-emerald-300 px-2 py-1 rounded-lg font-bold">
                    <span>{t('extra_deduction_label')}</span>
                    <span className="font-mono">
                      - Rs. {(paidAmount - grandTotal).toLocaleString()}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between text-slate-700">
                    <span>{t('bill_balance_label')}</span>
                    <span className="font-mono font-bold text-amber-900">
                      + Rs. {balanceDue.toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="flex justify-between pt-1.5 border-t border-amber-300 font-bold text-amber-950">
                  <span>{t('net_new_khata')}</span>
                  <span className="font-mono text-sm">
                    Rs. {Math.round(Number(selectedParty?.current_balance || 0) + grandTotal - paidAmount).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 3. CARD / ONLINE BANK MODE */}
          {(paymentMethod === 'card' || paymentMethod === 'online') && customerMode === 'walkin' && (
            <div className="space-y-3 bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-200">
              <div className="text-xs font-bold text-indigo-950">{t('card_bank_details')}</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{t('card_pos_machine')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('online')}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'online'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>{t('online_bank_upi')}</span>
                </button>
              </div>

              <div>
                <input
                  type="text"
                  placeholder={t('card_ref_placeholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Error Message inside modal */}
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center justify-between">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg('')}
                className="text-rose-500 hover:text-rose-800 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Action Buttons at bottom of modal */}
          <div className="flex items-center space-x-3 pt-3">
            <button
              type="button"
              onClick={() => setIsCheckoutOpen(false)}
              className="w-36 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {t('cancel_btn')}
            </button>

            {customerMode === 'party' ? (
              <button
                type="button"
                onClick={handleProcessSale}
                disabled={isSubmitting || (!selectedCustomerId && !customerName.trim())}
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl shadow-lg shadow-blue-600/20 text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{isSubmitting ? t('saving_udhar') : t('save_udhar_invoice')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleProcessSale}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl shadow-lg shadow-emerald-600/20 text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{isSubmitting ? t('saving_sale') : t('complete_cash_sale')}</span>
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* SERIAL NUMBER INPUT MODAL FOR COMPONENTS */}
      <Modal
        isOpen={!!serialModalItem}
        onClose={() => setSerialModalItem(null)}
        title={`Scan Serial Numbers for ${serialModalItem?.name}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-600">
              Pick from stock or enter <span className="font-bold text-emerald-600">{serialModalItem?.quantity}</span> serial(s):
            </p>
            <button
              type="button"
              onClick={() => {
                const prefix = (serialModalItem?.name || 'ACC').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
                const timeCode = Date.now().toString().slice(-4);
                const available = serialModalItem?.availableSerials || [];
                const auto = [];
                for (let i = 0; i < serialModalItem?.quantity; i++) {
                  auto.push(available[i] || `${prefix}-${timeCode}-${i + 1}`);
                }
                setSerialInputs(auto);
              }}
              className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 rounded text-[10px] font-bold transition-colors cursor-pointer"
            >
              ⚡ Auto-Fill Serials
            </button>
          </div>

          <div className="space-y-2">
            {serialInputs.map((val, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-700">Serial #{idx + 1}:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={`e.g. SN-${serialModalItem?.name.slice(0, 3).toUpperCase()}-${1000 + idx}`}
                    value={val}
                    onChange={(e) => {
                      const updated = [...serialInputs];
                      updated[idx] = e.target.value;
                      setSerialInputs(updated);
                    }}
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden focus:border-emerald-500"
                  />
                  {/* If in-stock serial numbers exist, provide quick picker dropdown */}
                  {serialModalItem?.availableSerials?.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          const updated = [...serialInputs];
                          updated[idx] = e.target.value;
                          setSerialInputs(updated);
                        }
                      }}
                      className="bg-white border border-slate-300 text-slate-800 text-xs rounded-lg px-2"
                    >
                      <option value="">Pick In-Stock S/N</option>
                      {serialModalItem.availableSerials.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center space-x-2 pt-3">
            <button
              onClick={() => setSerialModalItem(null)}
              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSerials}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20"
            >
              Confirm Serials
            </button>
          </div>
        </div>
      </Modal>

      {/* COMPLETED SALE THERMAL RECEIPT PREVIEW MODAL */}
      <Modal
        isOpen={!!completedInvoice}
        onClose={() => setCompletedInvoice(null)}
        title="Sale Completed - Thermal Receipt Preview"
        maxWidth="max-w-lg"
      >
        {completedInvoice && (
          <ThermalReceipt
            invoice={completedInvoice}
            onClose={() => setCompletedInvoice(null)}
          />
        )}
      </Modal>
    </div>
  );
}
