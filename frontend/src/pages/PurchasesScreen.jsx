import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Modal from '../components/Modal';
import { useLanguage } from '../context/LanguageContext';
import {
  Truck,
  Plus,
  Search,
  Calendar,
  FileText,
  DollarSign,
  Package,
  Layers,
  Trash2,
  CheckCircle2,
  Eye,
  XCircle,
  AlertTriangle,
  Printer,
  Ban
} from 'lucide-react';

export default function PurchasesScreen() {
  const { t, isUrdu } = useLanguage();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active', 'voided', 'all'
  const [loading, setLoading] = useState(true);

  // Void Purchase state
  const [purchaseToVoid, setPurchaseToVoid] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  // New Purchase Modal state
  const [isNewPurchaseOpen, setIsNewPurchaseOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0); // Input Tax Rate %
  const [taxAmountManual, setTaxAmountManual] = useState(''); // Manual tax override if needed
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState([]);

  // Selected item row editor state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemCost, setItemCost] = useState(0);
  const [itemSalePrice, setItemSalePrice] = useState(0);
  const [itemSerialsText, setItemSerialsText] = useState('');

  // View details modal
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Quick Add Supplier modal state
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    address: '',
    opening_balance: 0
  });
  const [supplierSubmitting, setSupplierSubmitting] = useState(false);

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    if (!newSupplierForm.name.trim()) return;
    setSupplierSubmitting(true);
    try {
      const res = await api.products.createSupplier({
        name: newSupplierForm.name,
        contact_person: newSupplierForm.contact_person,
        phone: newSupplierForm.phone,
        address: newSupplierForm.address,
        opening_balance: Number(newSupplierForm.opening_balance) || 0
      });
      if (res.success) {
        setIsAddSupplierOpen(false);
        const supRes = await api.products.getSuppliers();
        if (supRes.success) {
          setSuppliers(supRes.suppliers);
          setSupplierId(res.supplierId);
        }
        setNewSupplierForm({ name: '', contact_person: '', phone: '', address: '', opening_balance: 0 });
      }
    } catch (err) {
      alert(err.message || 'Failed to add supplier');
    } finally {
      setSupplierSubmitting(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, supplierFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [purRes, supRes, prodRes, setRes] = await Promise.all([
        api.purchases.getAll({
          search: search || undefined,
          supplier_id: supplierFilter || undefined,
          status: 'all'
        }),
        api.products.getSuppliers(),
        api.products.getAll(),
        api.settings.get().catch(() => ({ success: false }))
      ]);
      if (purRes.success) setPurchases(purRes.purchases);
      if (supRes.success) {
        setSuppliers(supRes.suppliers);
        if (!supplierId && supRes.suppliers.length > 0) {
          setSupplierId(supRes.suppliers[0].id);
        }
      }
      if (prodRes.success) setProducts(prodRes.products);
      if (setRes?.success && setRes?.settings?.default_purchase_tax_rate) {
        const defPurTax = Number(setRes.settings.default_purchase_tax_rate);
        if (!isNaN(defPurTax)) setTaxRate(defPurTax);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmVoidPurchase = async (e) => {
    e.preventDefault();
    if (!purchaseToVoid) return;

    setIsVoiding(true);
    try {
      const res = await api.purchases.void(purchaseToVoid.id, {
        reason: voidReason.trim() || (isUrdu ? 'مال سپلائر کو واپس کیا گیا / منسوخ خریداری بل' : 'Stock returned to supplier / Voided purchase')
      });
      if (res.success) {
        setSuccessMsg(
          isUrdu
            ? `خریداری آرڈر #${purchaseToVoid.purchase_number} کامیابی سے منسوخ کر دیا گیا۔ اسٹاک اور سپلائر کھاتہ درست ہو گیا!`
            : `Purchase #${purchaseToVoid.purchase_number} voided successfully. Stock & Supplier balance restored.`
        );
        setPurchaseToVoid(null);
        setVoidReason('');
        loadData();
      }
    } catch (err) {
      setErrorMsg(err.message || (isUrdu ? 'خریداری بل منسوخ کرنے میں خرابی ہوئی' : 'Failed to void purchase'));
    } finally {
      setIsVoiding(false);
    }
  };

  // Helper for serial number expansion & auto-generation
  const expandSerials = (baseText, qty) => {
    const clean = (baseText || '').trim();
    if (!clean) return [];
    const match = clean.match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const startNum = parseInt(match[2], 10);
      const padLen = match[2].length;
      const list = [];
      for (let i = 0; i < qty; i++) {
        list.push(`${prefix}${String(startNum + i).padStart(padLen, '0')}`);
      }
      return list;
    }
    const list = [];
    for (let i = 1; i <= qty; i++) {
      list.push(`${clean}-${i}`);
    }
    return list;
  };

  const generateSequentialSerials = (prodName, qty) => {
    const cleanName = (prodName || 'ACC').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
    const timeCode = Date.now().toString().slice(-4);
    const list = [];
    for (let i = 1; i <= qty; i++) {
      list.push(`${cleanName}-${timeCode}-${String(i).padStart(3, '0')}`);
    }
    return list;
  };

  const handleProductSelect = (pId) => {
    setSelectedProductId(pId);
    const prod = products.find(p => String(p.id) === String(pId));
    if (prod) {
      setItemCost(prod.cost_price || 0);
      setItemSalePrice(prod.sale_price || 0);
      const q = Math.max(1, Number(itemQty) || 1);
      // Auto-fill serial numbers automatically for this product
      if (prod.has_serials) {
        setItemSerialsText(generateSequentialSerials(prod.name, q).join('\n'));
      } else {
        setItemSerialsText('');
      }
    }
  };

  const handleQtyChange = (val) => {
    setItemQty(val);
    const q = Math.max(1, Number(val) || 1);
    if (selectedProductId) {
      const prod = products.find(p => String(p.id) === String(selectedProductId));
      if (prod && prod.has_serials) {
        setItemSerialsText(generateSequentialSerials(prod.name, q).join('\n'));
      }
    }
  };

  const handleAddItemToPurchase = () => {
    if (!selectedProductId) {
      setErrorMsg('Please select a product first');
      return;
    }
    const prod = products.find(p => String(p.id) === String(selectedProductId));
    if (!prod) return;

    const qty = Number(itemQty) || 1;
    const cost = Number(itemCost) || 0;
    const sale = Number(itemSalePrice) || 0;

    let serialsList = itemSerialsText.split('\n').map(s => s.trim()).filter(Boolean);
    if (prod.has_serials) {
      if (serialsList.length === 0) {
        serialsList = generateSequentialSerials(prod.name, qty);
      } else if (serialsList.length === 1 && qty > 1) {
        serialsList = expandSerials(serialsList[0], qty);
      } else if (serialsList.length < qty) {
        const diff = qty - serialsList.length;
        const extra = generateSequentialSerials(prod.name, diff);
        serialsList = [...serialsList, ...extra];
      }
    }

    setPurchaseItems([
      ...purchaseItems,
      {
        product_id: prod.id,
        name: prod.name,
        has_serials: prod.has_serials,
        quantity: qty,
        cost_price: cost,
        sale_price: sale,
        total_cost: cost * qty,
        serial_numbers: serialsList
      }
    ]);

    // Reset row editor
    setSelectedProductId('');
    setItemQty(1);
    setItemCost(0);
    setItemSalePrice(0);
    setItemSerialsText('');
    setErrorMsg('');
  };

  const handleRemoveItem = (idx) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== idx));
  };

  // Live calculations: Always sum all items in purchaseItems + active item being configured!
  const activeItemTotal = selectedProductId ? ((Number(itemCost) || 0) * (Number(itemQty) || 1)) : 0;
  const itemsSubtotal = purchaseItems.reduce((sum, it) => sum + it.total_cost, 0);
  const subtotal = itemsSubtotal + activeItemTotal;
  const taxableAmount = Math.max(0, subtotal - (Number(discount) || 0));
  const calculatedTaxAmount = taxAmountManual !== '' ? Number(taxAmountManual) : Math.round(((taxableAmount * (Number(taxRate) || 0)) / 100) * 100) / 100;
  const grandTotal = Math.round((taxableAmount + calculatedTaxAmount) * 100) / 100;
  const paid = paidAmount === '' ? grandTotal : Number(paidAmount);
  const balanceDue = Math.max(0, Math.round((grandTotal - paid) * 100) / 100);
  const selectedSupplier = suppliers.find(s => String(s.id) === String(supplierId));

  const handleSubmitPurchase = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    let itemsToSubmit = [...purchaseItems];

    // If user filled product fields without clicking "Add Row", auto-commit it!
    if (selectedProductId) {
      const prod = products.find(p => String(p.id) === String(selectedProductId));
      if (prod) {
        const qty = Number(itemQty) || 1;
        const cost = Number(itemCost) || 0;
        const sale = Number(itemSalePrice) || 0;
        let serialsList = itemSerialsText.split('\n').map(s => s.trim()).filter(Boolean);
        if (prod.has_serials) {
          if (serialsList.length === 0) {
            serialsList = generateSequentialSerials(prod.name, qty);
          } else if (serialsList.length === 1 && qty > 1) {
            serialsList = expandSerials(serialsList[0], qty);
          } else if (serialsList.length < qty) {
            const diff = qty - serialsList.length;
            const extra = generateSequentialSerials(prod.name, diff);
            serialsList = [...serialsList, ...extra];
          }
        }
        itemsToSubmit.push({
          product_id: prod.id,
          name: prod.name,
          has_serials: prod.has_serials,
          quantity: qty,
          cost_price: cost,
          sale_price: sale,
          total_cost: cost * qty,
          serial_numbers: serialsList
        });
      }
    }

    if (itemsToSubmit.length === 0) {
      setErrorMsg('Baraye meherbani Product select karein aur purchase list me shamil karein.');
      return;
    }

    if (!supplierId) {
      setErrorMsg('Baraye meherbani Supplier select karein.');
      return;
    }

    const currentSubtotal = itemsToSubmit.reduce((sum, it) => sum + it.total_cost, 0);
    const currentTaxable = Math.max(0, currentSubtotal - (Number(discount) || 0));
    const currentTaxAmount = taxAmountManual !== '' ? Number(taxAmountManual) : Math.round(((currentTaxable * (Number(taxRate) || 0)) / 100) * 100) / 100;
    const currentGrandTotal = Math.round((currentTaxable + currentTaxAmount) * 100) / 100;
    const currentPaid = paidAmount === '' ? currentGrandTotal : Number(paidAmount);

    try {
      const payload = {
        supplier_id: Number(supplierId),
        supplier_invoice_no: supplierInvoiceNo,
        purchase_date: purchaseDate,
        discount: Number(discount) || 0,
        tax_rate: Number(taxRate) || 0,
        tax_amount: currentTaxAmount,
        paid_amount: currentPaid,
        payment_method: paymentMethod,
        notes,
        items: itemsToSubmit.map(it => ({
          product_id: it.product_id,
          cost_price: it.cost_price,
          sale_price: it.sale_price,
          quantity: it.quantity,
          serial_numbers: it.serial_numbers
        }))
      };

      const res = await api.purchases.create(payload);
      if (res.success) {
        setSuccessMsg(`GRN #${res.purchase.purchaseNumber} successfully saved! Stock Quantity, Khareed Rate (Cost) aur Bechne Ka Rate (Sale) Inventory me update ho gaye hain!`);
        setIsNewPurchaseOpen(false);
        setPurchaseItems([]);
        setSelectedProductId('');
        setItemQty(1);
        setItemCost(0);
        setItemSalePrice(0);
        setItemSerialsText('');
        setSupplierInvoiceNo('');
        setNotes('');
        setPaidAmount('');
        setTaxAmountManual('');
        loadData();
      }
    } catch (err) {
      console.error('Failed to create purchase:', err);
      setErrorMsg(err.response?.data?.error || err.message || 'Error creating purchase order');
    }
  };

  // Print Supplier Purchase Voucher / Bill
  const handlePrintSupplierBill = async () => {
    try {
      if (window.electronAPI?.printReceipt) {
        await window.electronAPI.printReceipt({
          silent: false,
          pageSize: 'A4'
        });
      } else {
        window.print();
      }
    } catch (err) {
      console.error('Print failed:', err);
      window.print();
    }
  };

  const handleOpenDetails = async (pId) => {
    try {
      const res = await api.purchases.getDetails(pId);
      if (res.success) setSelectedPurchase(res.purchase);
    } catch (err) {
      alert('Failed to load purchase details');
    }
  };

  const activeCount = purchases.filter(p => p.status !== 'void' && p.status !== 'cancelled').length;
  const voidCount = purchases.filter(p => p.status === 'void' || p.status === 'cancelled').length;

  const displayedPurchases = purchases.filter(p => {
    const isVoid = p.status === 'void' || p.status === 'cancelled';
    if (statusFilter === 'active') return !isVoid;
    if (statusFilter === 'voided') return isVoid;
    return true;
  });

  const totalPurchasesBill = displayedPurchases.reduce((sum, p) => sum + (Number(p.grand_total) || 0), 0);
  const totalPurchasesPaid = displayedPurchases.reduce((sum, p) => sum + (Number(p.paid_amount) || 0), 0);
  const totalPurchasesDue = displayedPurchases.reduce((sum, p) => sum + (Number(p.balance_due) || 0), 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 text-slate-800 p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-600" />
            <span>{isUrdu ? 'مال خریداری و نیا اسٹاک انٹری (GRN / Purchases)' : 'GRN & Stock Purchases (Goods Received Note)'}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {isUrdu
              ? 'سپلائر سے خریدا گیا مال درج کریں — بل محفوظ کرنے پر اسٹاک کی مقدار، خریداری ریٹ اور فروخت ریٹ خودکار اپ ڈیٹ ہو جاتے ہیں۔'
              : 'Record new inventory — saving GRN updates stock quantity, purchase cost, and sale price instantly.'}
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg('');
            setPurchaseItems([]);
            setIsNewPurchaseOpen(true);
          }}
          className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{isUrdu ? '+ نیا خریداری بل (New GRN)' : '+ New GRN Entry'}</span>
        </button>
      </div>

      {/* Purchases Large Summary Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Ocean Blue Card - Total Purchases Bill */}
        <div className="bg-blue-600 p-4 rounded-2xl text-white flex flex-col justify-between min-h-[135px] shadow-sm shadow-blue-500/20">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-100 block">
              {isUrdu ? 'کل خریداری بل (Total Purchases)' : 'Total Purchases'}
            </span>
            <div className="text-2xl lg:text-3xl font-black font-mono tracking-tight text-white mt-1">
              Rs. {totalPurchasesBill.toLocaleString()}
            </div>
            <div className="text-xs text-blue-100 font-medium mt-0.5">
              {isUrdu ? 'مجموعی خریدا گیا سامان' : 'Gross Inventory Bought'}
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
              <Package className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 2. Fresh Teal Card - Total GRN Inward Batches */}
        <div className="bg-teal-500 p-4 rounded-2xl text-white flex flex-col justify-between min-h-[135px] shadow-sm shadow-teal-500/20">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-100 block">
              {isUrdu ? 'آمدہ مال آرڈرز (GRN Inwards)' : 'GRN Inwards'}
            </span>
            <div className="text-2xl lg:text-3xl font-black font-mono tracking-tight text-white mt-1">
              {displayedPurchases.length} {isUrdu ? 'آرڈرز' : 'Orders'}
            </div>
            <div className="text-xs text-teal-100 font-medium mt-0.5">
              {isUrdu ? 'اسٹاک کے وصول شدہ بیچز' : 'Stock Inward Batches'}
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
              <Truck className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 3. Soft Indigo Card - Paid to Vendors */}
        <div className="bg-indigo-500 p-4 rounded-2xl text-white flex flex-col justify-between min-h-[135px] shadow-sm shadow-indigo-500/20">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-100 block">
              {isUrdu ? 'سپلائرز کو ادا شدہ رقم (Paid)' : 'Paid to Suppliers'}
            </span>
            <div className="text-2xl lg:text-3xl font-black font-mono tracking-tight text-white mt-1">
              Rs. {totalPurchasesPaid.toLocaleString()}
            </div>
            <div className="text-xs text-indigo-100 font-medium mt-0.5">
              {isUrdu ? 'وینڈرز کو کل ادا رقم' : 'Vendor Purchases Cleared'}
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 4. Alert Card - Remaining Unpaid Debt */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200 flex flex-col justify-between min-h-[135px] shadow-xs">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 block">
              {isUrdu ? 'باقی واجب الادا قرض (Payables)' : 'Pending Payables'}
            </span>
            <div className="text-2xl lg:text-3xl font-black font-mono tracking-tight text-rose-600 mt-1">
              Rs. {totalPurchasesDue.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">
              {isUrdu ? 'سپلائرز کو ادا طلب ادھار' : 'Unpaid Vendor Payables'}
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Status Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={isUrdu ? 'خریداری آرڈر #، سپلائر بل # یا وینڈر کا نام تلاش کریں...' : 'Search by Purchase #, Supplier Bill #, or Vendor Name...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden shadow-xs"
          />
        </div>

        <div className="md:col-span-3">
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg text-xs text-slate-800 focus:outline-hidden shadow-xs"
          >
            <option value="">{isUrdu ? 'تمام سپلائرز / پارٹیاں (All Suppliers)' : 'All Suppliers / Vendors'}</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Status Tabs: Active vs Voided */}
        <div className="md:col-span-4 flex justify-end">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isUrdu ? `✓ درست و فعال خریداری (${activeCount})` : `Active Purchases (${activeCount})`}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('voided')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'voided'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isUrdu ? `❌ منسوخ شدہ مال (${voidCount})` : `Voided / Returned (${voidCount})`}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')}><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      {/* Purchases Table */}
      <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-bold sticky top-0 border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">{isUrdu ? 'خریداری آرڈر #' : 'Purchase Order #'}</th>
              <th className="py-2.5 px-2">{isUrdu ? 'تاریخ' : 'Date'}</th>
              <th className="py-2.5 px-2">{isUrdu ? 'سپلائر / ڈسٹری بیوٹر' : 'Supplier / Distributor'}</th>
              <th className="py-2.5 px-2">{isUrdu ? 'سپلائر انوائس #' : 'Supplier Invoice #'}</th>
              <th className="py-2.5 px-2">{isUrdu ? 'آمدہ سامان (اسٹاک)' : 'Items Received (Stock Inward)'}</th>
              <th className="py-2.5 px-2 text-right">{isUrdu ? 'سب ٹوٹل' : 'Subtotal'}</th>
              <th className="py-2.5 px-2 text-right">{isUrdu ? 'ٹیکس' : 'Tax (Input)'}</th>
              <th className="py-2.5 px-2 text-right">{isUrdu ? 'کل بل رقم' : 'Total Bill'}</th>
              <th className="py-2.5 px-2 text-right">{isUrdu ? 'ادا شدہ رقم' : 'Paid Amount'}</th>
              <th className="py-2.5 px-2 text-right">{isUrdu ? 'باقی واجب الادا' : 'Balance Due'}</th>
              <th className="py-2.5 pr-3 text-right">{isUrdu ? 'ایکشن' : 'Action'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedPurchases.length === 0 ? (
              <tr>
                <td colSpan="11" className="py-8 text-center text-slate-500">
                  {isUrdu
                    ? statusFilter === 'voided'
                      ? 'کوئی منسوخ شدہ خریداری ریکارڈ نہیں ہے۔'
                      : 'کوئی خریداری ریکارڈ موجود نہیں ہے۔ نیا اسٹاک شامل کرنے کے لیے اوپر "+ نیا خریداری بل" پر کلک کریں۔'
                    : 'No purchase orders found.'}
                </td>
              </tr>
            ) : (
              displayedPurchases.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-amber-700">
                    <div>{p.purchase_number}</div>
                    {p.status === 'void' && (
                      <span className="text-[10px] text-rose-600 font-sans font-bold block">
                        {isUrdu ? '(منسوخ شدہ / مال واپس)' : '(Voided)'}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 font-mono text-slate-600">{p.purchase_date}</td>
                  <td className="py-2.5 px-2 font-semibold text-slate-900">{p.supplier_name}</td>
                  <td className="py-2.5 px-2 font-mono text-slate-600">{p.supplier_invoice_no || '—'}</td>
                  <td className="py-2.5 px-2 max-w-xs truncate text-slate-700 font-medium" title={p.items_summary}>
                    {p.items_summary || '—'}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                    Rs. {p.subtotal?.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-medium">
                    {p.tax_amount > 0 ? (
                      <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[11px] font-semibold">
                        +{p.tax_rate}% (Rs. {p.tax_amount?.toLocaleString()})
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">
                    Rs. {p.grand_total?.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-700">
                    Rs. {p.paid_amount?.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-bold">
                    {p.balance_due > 0 ? (
                      <span className="text-rose-600">Rs. {p.balance_due?.toLocaleString()}</span>
                    ) : (
                      <span className="text-slate-400">{isUrdu ? 'مکمل ادا شدہ' : 'Paid in Full'}</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenDetails(p.id)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs border border-slate-300 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isUrdu ? 'تفصیل' : 'Details'}</span>
                      </button>
                      {p.status !== 'void' && p.status !== 'cancelled' ? (
                        <button
                          onClick={() => {
                            setPurchaseToVoid(p);
                            setVoidReason('');
                          }}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-xs border border-rose-300 transition-colors cursor-pointer font-bold"
                          title={isUrdu ? 'بل منسوخ کریں اور مال سپلائر کو واپس کریں' : 'Void purchase and return stock to supplier'}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>{isUrdu ? 'منسوخ / واپسی' : 'Void'}</span>
                        </button>
                      ) : (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-md border border-rose-300">
                          {isUrdu ? 'منسوخ شدہ' : 'Voided'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* NEW STOCK PURCHASE MODAL */}
      <Modal
        isOpen={isNewPurchaseOpen}
        onClose={() => setIsNewPurchaseOpen(false)}
        title={isUrdu ? 'سپلائر سے مال خریداری و اسٹاک انٹری (New GRN)' : 'Record Stock Purchase from Vendor'}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSubmitPurchase} className="space-y-4">
          {errorMsg && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-xs">
              {errorMsg}
            </div>
          )}

          {/* Supplier & Header info */}
          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-700">
                  {isUrdu ? 'سپلائر منتخب کریں *' : 'Select Supplier *'}
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddSupplierOpen(true)}
                  className="text-[10px] text-amber-700 hover:text-amber-800 font-bold"
                >
                  {isUrdu ? '+ نیا شامل کریں' : '+ Add New'}
                </button>
              </div>
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden"
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {isUrdu ? 'سپلائر بل / انوائس نمبر' : 'Supplier Bill / Invoice #'}
              </label>
              <input
                type="text"
                value={supplierInvoiceNo}
                onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                placeholder="مثال: INV-9921"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {isUrdu ? 'تاریخ خریداری' : 'Purchase Date'}
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden"
              />
            </div>
          </div>

          {/* ADD ITEM ROW EDITOR */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />
                <span>{isUrdu ? 'سامان و ہارڈویئر شامل کریں' : 'Add Stock Accessory / Product'}</span>
              </h4>
              {selectedProductId && (
                <span className="text-[11px] font-mono text-amber-900 font-bold bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                  {isUrdu ? 'کل رقم:' : 'Total:'} Rs. {((Number(itemCost) || 0) * (Number(itemQty) || 1)).toLocaleString()}
                </span>
              )}
            </div>

            <div className="grid grid-cols-12 gap-2 text-xs">
              <div className="col-span-12 md:col-span-3">
                <label className="block text-[10px] font-semibold text-slate-700 mb-1">
                  {isUrdu ? 'سامان / پراڈکٹ' : 'Product'}
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-amber-500 focus:outline-hidden text-xs font-medium"
                >
                  <option value="">{isUrdu ? `-- پراڈکٹ منتخب کریں (${products.length} دستیاب) --` : `-- Choose Product (${products.length} available) --`}</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({isUrdu ? 'موجود اسٹاک:' : 'Stock:'} {p.stock_quantity})</option>
                  ))}
                </select>
              </div>

              <div className="col-span-4 md:col-span-2">
                <label className="block text-[10px] font-semibold text-slate-700 mb-1">
                  {isUrdu ? 'تعداد (خریداری)' : 'Purchase Qty'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={itemQty}
                  onChange={(e) => handleQtyChange(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-center font-mono font-bold focus:border-amber-500 focus:outline-hidden text-sm"
                />
              </div>

              <div className="col-span-4 md:col-span-2">
                <label className="block text-[10px] font-semibold text-slate-700 mb-1">
                  {isUrdu ? 'خریداری ریٹ / لاگت (روپے)' : 'Khareed Rate / Cost (Rs.)'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={itemCost}
                  onChange={(e) => setItemCost(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-right font-mono font-bold focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              <div className="col-span-4 md:col-span-2">
                <label className="block text-[10px] font-semibold text-slate-700 mb-1">
                  {isUrdu ? 'فروخت ریٹ / سیل ریٹ (روپے)' : 'Sale Price (Rs.)'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={itemSalePrice}
                  onChange={(e) => setItemSalePrice(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-emerald-700 text-right font-mono font-bold focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              <div className="col-span-8 md:col-span-2">
                <label className="block text-[10px] font-bold text-amber-800 mb-1">
                  {isUrdu ? 'کل سامان لاگت' : 'Total Item Cost'}
                </label>
                <div className="w-full px-2.5 py-2 bg-white border border-amber-300 rounded-lg text-amber-900 text-right font-mono font-black text-xs flex items-center justify-end">
                  Rs. {((Number(itemCost) || 0) * (Number(itemQty) || 1)).toLocaleString()}
                </div>
              </div>

              <div className="col-span-4 md:col-span-1 flex items-end">
                <button
                  type="button"
                  onClick={handleAddItemToPurchase}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center shadow-xs cursor-pointer"
                  title={isUrdu ? 'اس سامان کو بل میں شامل کریں' : 'Add this product to purchase list'}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Serials are 100% AUTO-FILLED! */}
              {selectedProductId && products.find(p => String(p.id) === String(selectedProductId))?.has_serials === 1 && (
                <div className="col-span-12 mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                  <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>{isUrdu ? `سیریل نمبرز خودکار بن گئے (${itemQty} آئٹمز):` : `Serials Auto-Filled (${itemQty} items ready):`}</span>
                    <span className="font-mono text-slate-800 text-[10px] bg-white px-2 py-0.5 rounded border border-amber-200">
                      {itemSerialsText.split('\n').filter(Boolean).slice(0, 3).join(', ')}{itemSerialsText.split('\n').filter(Boolean).length > 3 ? '...' : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const prod = products.find(p => String(p.id) === String(selectedProductId));
                      const autoList = generateSequentialSerials(prod?.name, Number(itemQty) || 1);
                      setItemSerialsText(autoList.join('\n'));
                    }}
                    className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded text-[10px] font-bold cursor-pointer"
                  >
                    {isUrdu ? '⚡ دوبارہ بنائیں' : '⚡ Re-Generate'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ITEM LIST TABLE */}
          <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 text-[10px] font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">{isUrdu ? 'سامان' : 'Item'}</th>
                  <th className="py-2 text-center">{isUrdu ? 'تعداد' : 'Qty'}</th>
                  <th className="py-2 text-right">{isUrdu ? 'خریداری ریٹ' : 'Cost Price'}</th>
                  <th className="py-2 text-right">{isUrdu ? 'کل لاگت' : 'Total Cost'}</th>
                  <th className="py-2 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseItems.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-4 text-center text-xs">
                      {selectedProductId ? (
                        <div className="text-emerald-700 font-semibold flex items-center justify-center gap-1.5 px-3">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{isUrdu ? '1 سامان اوپر فارم میں منتخب ہے۔ مزید کے لیے "+" دبائیں یا نیچے براہ راست محفوظ کریں!' : '1 Item active in form above. Click "+" to add more items, or click "Confirm Purchase" below to save directly!'}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">{isUrdu ? 'ابھی کوئی سامان شامل نہیں ہوا۔ اوپر پراڈکٹ منتخب کریں۔' : 'No items added yet. Choose a product above.'}</span>
                      )}
                    </td>
                  </tr>
                ) : (
                  purchaseItems.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-900">{it.name}</div>
                        {it.serial_numbers?.length > 0 && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            {isUrdu ? 'سیریلز:' : 'Serials:'} {it.serial_numbers.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="py-2 text-center font-mono text-slate-800">{it.quantity}</td>
                      <td className="py-2 text-right font-mono text-slate-600">Rs. {it.cost_price.toLocaleString()}</td>
                      <td className="py-2 text-right font-mono font-bold text-emerald-700">
                        Rs. {it.total_cost.toLocaleString()}
                      </td>
                      <td className="py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* TOTALS & PAYMENT */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3 text-xs">
            {/* Breakdown: Subtotal, Discount, Tax, Grand Total */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
              <div className="flex justify-between items-center text-slate-600">
                <span>{isUrdu ? 'سامان کا سب ٹوٹل:' : 'Items Subtotal:'}</span>
                <span className="font-mono font-semibold text-slate-800">Rs. {subtotal.toLocaleString()}</span>
              </div>

              {/* Discount & Tax inputs row */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between gap-2 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-600">{isUrdu ? 'رعایت / ڈسکاؤنٹ (روپے):' : 'Discount (Rs.):'}</span>
                  <input
                    type="number"
                    min="0"
                    value={discount || ''}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    placeholder="0"
                    className="w-20 px-2 py-0.5 bg-white border border-slate-300 rounded text-right font-mono text-slate-900 text-xs focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-medium text-slate-600">{isUrdu ? 'خریداری ٹیکس:' : 'Purchase Tax:'}</span>
                    <input
                      type="number"
                      min="0"
                      value={taxRate || ''}
                      onChange={(e) => {
                        setTaxRate(Number(e.target.value));
                        setTaxAmountManual('');
                      }}
                      placeholder="0"
                      className="w-12 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-right font-mono text-slate-900 text-xs focus:outline-hidden focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-500 font-bold">%</span>
                  </div>
                  <span className="font-mono font-bold text-amber-800 text-[11px]">
                    +Rs. {calculatedTaxAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Grand Total Highlight */}
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-xs font-black uppercase tracking-wide text-slate-800">
                  {isUrdu ? 'کل خریداری بل (Total Bill):' : 'Total Purchase Bill:'}
                </span>
                <span className="font-mono text-xl font-black text-slate-900">
                  Rs. {grandTotal.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Paid Amount & Quick Buttons */}
            <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-800">
                    {isUrdu ? 'سپلائر کو ادا کی گئی رقم (Cash Paid Now):' : 'Supplier Ko Di Gayi Raqam (Cash Paid Now):'}
                  </label>
                  <div className="text-[10px] text-slate-500">
                    {isUrdu ? 'کتنی رقم نقد یا چیک سے موقع پر ادا کی گئی (بٹن یا رقم لکھیں)' : 'Amount paid at counter (Quick buttons or custom amount)'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-400 font-mono">Rs.</span>
                  <input
                    type="number"
                    min="0"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder={String(grandTotal)}
                    className="w-36 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-right font-mono text-emerald-700 text-sm font-black focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:outline-hidden"
                  >
                    <option value="cash">{isUrdu ? 'نقد (Cash)' : 'Cash'}</option>
                    <option value="bank">{isUrdu ? 'بینک ٹرانسفر (Bank)' : 'Bank Transfer'}</option>
                    <option value="credit">{isUrdu ? 'ادھار (Credit)' : 'Credit / Udhar'}</option>
                  </select>
                </div>
              </div>

              {/* Quick Preset Buttons: 0 (مکمل ادھار), 5k, 10k, 20k, 30k, 50k, Half, Full Paid */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-0.5">
                  {isUrdu ? 'فوری رقم:' : 'Quick:'}
                </span>
                <button
                  type="button"
                  onClick={() => setPaidAmount('0')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                    paidAmount === '0'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {isUrdu ? '0 (مکمل ادھار)' : '0 (Full Udhar)'}
                </button>
                <button
                  type="button"
                  onClick={() => setPaidAmount('5000')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                    paidAmount === '5000'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {isUrdu ? '5 ہزار' : '5k'}
                </button>
                <button
                  type="button"
                  onClick={() => setPaidAmount('10000')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                    paidAmount === '10000'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {isUrdu ? '10 ہزار' : '10k'}
                </button>
                <button
                  type="button"
                  onClick={() => setPaidAmount('20000')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                    paidAmount === '20000'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                >
                  {isUrdu ? '20 ہزار' : '20k'}
                </button>
                <button
                  type="button"
                  onClick={() => setPaidAmount('30000')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                    paidAmount === '30000'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                >
                  {isUrdu ? '30 ہزار' : '30k'}
                </button>
                <button
                  type="button"
                  onClick={() => setPaidAmount('50000')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                    paidAmount === '50000'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {isUrdu ? '50 ہزار' : '50k'}
                </button>
                <button
                  type="button"
                  onClick={() => setPaidAmount(String(Math.round(grandTotal / 2)))}
                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[11px] font-bold cursor-pointer"
                >
                  {isUrdu ? '50% آدھا بل' : '50% Half'}
                </button>
                <button
                  type="button"
                  onClick={() => setPaidAmount(String(grandTotal))}
                  className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 rounded-md text-[11px] font-bold cursor-pointer"
                >
                  {isUrdu ? 'پورا بل' : 'Full Bill'}
                </button>
              </div>
            </div>

            {/* Supplier Khata Live Breakdown Card */}
            <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-700">
                <span>{isUrdu ? 'سپلائر کا پچھلا کھاتہ بقایا:' : 'Supplier Previous Balance:'}</span>
                <span className="font-mono font-bold">
                  Rs. {Number(selectedSupplier?.current_balance || 0).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between text-slate-700">
                <span>{isUrdu ? 'اس خریداری کا نیا مال:' : 'Current Purchase Total:'}</span>
                <span className="font-mono font-bold">
                  + Rs. {grandTotal.toLocaleString()}
                </span>
              </div>

              {paid > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>{isUrdu ? 'سپلائر کو ادا کی گئی رقم:' : 'Paid to Supplier:'}</span>
                  <span className="font-mono font-bold text-emerald-700">
                    - Rs. {paid.toLocaleString()}
                  </span>
                </div>
              )}

              {paid > grandTotal ? (
                <div className="flex justify-between text-emerald-900 bg-emerald-100/90 border border-emerald-300 px-2 py-1 rounded-lg font-bold">
                  <span>{isUrdu ? 'اضافی رقم (پچھلے کھاتے سے منہا):' : 'Extra Payment (Deducted from Prev Khata):'}</span>
                  <span className="font-mono">
                    - Rs. {(paid - grandTotal).toLocaleString()}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between text-slate-700">
                  <span>{isUrdu ? 'اس بل کا نیا ادھار (واجب الادا):' : 'Bill Balance Due:'}</span>
                  <span className="font-mono font-bold text-amber-900">
                    + Rs. {balanceDue.toLocaleString()}
                  </span>
                </div>
              )}

              <div className="flex justify-between pt-1.5 border-t border-amber-300 font-bold text-amber-950">
                <span>{isUrdu ? 'کل نیا سپلائر کھاتہ بقایا:' : 'Net New Supplier Balance:'}</span>
                <span className="font-mono text-sm">
                  Rs. {Math.round(Number(selectedSupplier?.current_balance || 0) + grandTotal - paid).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewPurchaseOpen(false)}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-300 cursor-pointer"
            >
              {isUrdu ? 'منسوخ کریں' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex-2 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl text-xs shadow-sm cursor-pointer"
            >
              {isUrdu ? '✓ خریداری بل محفوظ کریں اور اسٹاک اپ ڈیٹ کریں' : 'Confirm Purchase & Update Stock'}
            </button>
          </div>
        </form>
      </Modal>

      {/* VIEW PURCHASE DETAILS MODAL (SUPPLIER BILL / VOUCHER) */}
      <Modal
        isOpen={!!selectedPurchase}
        onClose={() => setSelectedPurchase(null)}
        title={isUrdu ? `خریداری واؤچر و بل: ${selectedPurchase?.purchase_number}` : `Purchase Order: ${selectedPurchase?.purchase_number}`}
        maxWidth="max-w-3xl"
      >
        {selectedPurchase && (
          <div className="space-y-4 text-xs select-text font-urdu">
            {/* Action Bar (hidden in print) */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 no-print">
              <div className="text-slate-500 font-medium">
                {isUrdu ? 'سپلائر مال آمد واؤچر اور اسٹاک اندراج کی تفصیلی رپورٹ' : 'Supplier Purchase Voucher & Inventory Inward Record'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintSupplierBill}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm text-xs transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isUrdu ? '🖨️ خریداری واؤچر پرنٹ کریں' : 'Print Voucher'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPurchase(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  {isUrdu ? 'بند کریں' : 'Close'}
                </button>
              </div>
            </div>

            {/* Printable Supplier Voucher Container */}
            <div id="supplier-bill-print-area" className="bg-white text-slate-900 p-4 rounded-xl border border-slate-200 space-y-3">
              {/* Store Branding Header */}
              <div className="text-center border-b-2 border-slate-800 pb-2">
                <h1 className="text-base md:text-lg font-black uppercase text-slate-900 tracking-tight">
                  قاسم کمپیوٹرز و ایکسیسریز (UNAIB COMPUTER ACCESSORIES)
                </h1>
                <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                  دکان نمبر 14، گراؤنڈ فلور، ٹیکنو سٹی پلازہ، آئی آئی چندریگر روڈ، کراچی | رابطہ: 0300-9258123
                </p>
                <div className="inline-block mt-2 px-3 py-0.5 bg-slate-900 text-white font-bold text-xs rounded-xs uppercase tracking-wider">
                  {isUrdu ? '★ مال آمد واؤچر و خریداری بل (PURCHASE VOUCHER / GRN) ★' : '★ GOODS RECEIPT NOTE & PURCHASE VOUCHER ★'}
                </div>
              </div>

              {/* Supplier & Bill Metadata Grid */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600">{isUrdu ? 'سپلائر / وینڈر پارٹی:' : 'Supplier / Vendor:'}</span>
                    <span className="font-bold text-slate-900">{selectedPurchase.supplier_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">{isUrdu ? 'سپلائر اصل انوائس #:' : 'Supplier Bill #:'}</span>
                    <span className="font-mono font-bold text-slate-800">{selectedPurchase.supplier_invoice_no || '—'}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600">{isUrdu ? 'سسٹم خریداری کوڈ:' : 'Purchase Code:'}</span>
                    <span className="font-mono font-bold text-blue-700">{selectedPurchase.purchase_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">{isUrdu ? 'تاریخ خریداری:' : 'Purchase Date:'}</span>
                    <span className="font-mono font-bold text-slate-800">{selectedPurchase.purchase_date}</span>
                  </div>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-[11px] text-slate-800 font-bold border-b border-slate-300">
                    <tr>
                      <th className="py-2 px-3 text-right">{isUrdu ? 'نمبر' : '#'}</th>
                      <th className="py-2 px-3 text-right">{isUrdu ? 'سامان کی تفصیل و ماڈل' : 'Item Description'}</th>
                      <th className="py-2 text-center">{isUrdu ? 'تعداد' : 'Qty'}</th>
                      <th className="py-2 text-right">{isUrdu ? 'خریداری ریٹ' : 'Cost Rate'}</th>
                      <th className="py-2 px-3 text-right">{isUrdu ? 'کل رقم' : 'Total Cost'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-xs">
                    {selectedPurchase.items?.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-right text-slate-500 font-bold">{idx + 1}</td>
                        <td className="py-2 px-3 text-right font-sans font-semibold text-slate-900">
                          {it.product_name}
                          {it.serials?.length > 0 && (
                            <div className="text-[10.5px] text-slate-600 font-mono mt-0.5">
                              {isUrdu ? 'سیریل نمبرز:' : 'S/N:'} {it.serials.join('، ')}
                            </div>
                          )}
                        </td>
                        <td className="py-2 text-center text-slate-800 font-bold">{it.quantity}</td>
                        <td className="py-2 text-right text-slate-600">Rs. {it.cost_price?.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">Rs. {it.total_cost?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Financial Breakdown */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-700">
                  <span>{isUrdu ? 'سامان کا سب ٹوٹل:' : 'Items Subtotal:'}</span>
                  <span className="font-mono font-semibold text-slate-800">Rs. {selectedPurchase.subtotal?.toLocaleString()}</span>
                </div>
                {selectedPurchase.discount > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>{isUrdu ? 'رعایت / ڈسکاؤنٹ:' : 'Discount:'}</span>
                    <span className="font-mono">- Rs. {selectedPurchase.discount?.toLocaleString()}</span>
                  </div>
                )}
                {selectedPurchase.tax_amount > 0 && (
                  <div className="flex justify-between text-amber-800 font-semibold">
                    <span>{isUrdu ? `خریداری ان پٹ ٹیکس (${selectedPurchase.tax_rate}%):` : `Purchase Tax (${selectedPurchase.tax_rate}%):`}</span>
                    <span className="font-mono">+ Rs. {selectedPurchase.tax_amount?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-slate-900 border-t-2 border-slate-300 pt-1 text-sm">
                  <span>{isUrdu ? 'کل خریداری بل (صاف رقم):' : 'Total Purchase Bill:'}</span>
                  <span className="font-mono text-blue-900">Rs. {selectedPurchase.grand_total?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-emerald-800 font-bold">
                  <span>{isUrdu ? 'نقد ادا شدہ رقم:' : 'Amount Paid:'}</span>
                  <span className="font-mono">Rs. {selectedPurchase.paid_amount?.toLocaleString()}</span>
                </div>
                {selectedPurchase.balance_due > 0 ? (
                  <div className="flex justify-between font-bold text-rose-700 bg-rose-50 border border-rose-200 p-1.5 rounded-sm">
                    <span>{isUrdu ? '⚠️ سپلائر کا بقایا ادھار واجب الادا:' : 'Balance Due:'}</span>
                    <span className="font-mono text-rose-800">Rs. {selectedPurchase.balance_due?.toLocaleString()}</span>
                  </div>
                ) : (
                  <div className="flex justify-between font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 p-1 rounded-sm">
                    <span>{isUrdu ? 'ادائیگی کی صورتحال:' : 'Payment Status:'}</span>
                    <span>{isUrdu ? 'مکمل ادا شدہ' : 'Paid in Full'}</span>
                  </div>
                )}
              </div>

              {/* Authorized Signatures for GRN / Voucher */}
              <div className="pt-8 pb-2 grid grid-cols-3 gap-4 text-center text-[10px] text-slate-600">
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-slate-800">{isUrdu ? 'تیار کنندہ / انوینٹری انچارج' : 'Prepared By / Inventory'}</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-slate-800">{isUrdu ? 'اکاؤنٹس / کیشئر دستخط' : 'Accounts / Cashier'}</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-slate-800">{isUrdu ? 'سپلائر / ڈیلیوری دستخط' : 'Supplier / Receiver'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* QUICK ADD SUPPLIER MODAL */}
      <Modal
        isOpen={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        title={isUrdu ? 'نیا سپلائر / ڈسٹری بیوٹر شامل کریں' : 'Add New Supplier / Vendor'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateSupplier} className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              {isUrdu ? 'سپلائر / ڈسٹری بیوٹر کا نام *' : 'Supplier / Vendor Name *'}
            </label>
            <input
              type="text"
              required
              value={newSupplierForm.name}
              onChange={(e) => setNewSupplierForm({ ...newSupplierForm, name: e.target.value })}
              placeholder={isUrdu ? 'مثال: حفیظ سینٹر ایکسیسریز' : 'e.g. Hafeez Center Accessories'}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {isUrdu ? 'رابطہ کار شخص (Contact Person)' : 'Contact Person'}
              </label>
              <input
                type="text"
                value={newSupplierForm.contact_person}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, contact_person: e.target.value })}
                placeholder={isUrdu ? 'مثال: آصف بھائی' : 'e.g. Asif Bhai'}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {isUrdu ? 'موبائل / فون نمبر' : 'Mobile / Phone #'}
              </label>
              <input
                type="text"
                value={newSupplierForm.phone}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, phone: e.target.value })}
                placeholder="0321-7654321"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              {isUrdu ? 'دکان یا دفتر کا پتہ' : 'Shop / Office Address'}
            </label>
            <input
              type="text"
              value={newSupplierForm.address}
              onChange={(e) => setNewSupplierForm({ ...newSupplierForm, address: e.target.value })}
              placeholder={isUrdu ? 'مثال: دکان نمبر 24، گراؤنڈ فلور، حفیظ سینٹر، لاہور' : 'e.g. Shop # 24, Ground Floor, Hafeez Center, Lahore'}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
            />
          </div>

          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
            <label className="block text-[11px] font-semibold text-amber-900 mb-1">
              {isUrdu ? 'پچھلا کھاتہ بقایا (Opening Balance Rs.)' : 'Opening Payable Balance (Rs.)'}
            </label>
            <input
              type="number"
              min="0"
              value={newSupplierForm.opening_balance}
              onChange={(e) => setNewSupplierForm({ ...newSupplierForm, opening_balance: e.target.value })}
              placeholder="0"
              className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs text-slate-900 font-mono focus:outline-hidden"
            />
            <p className="text-[10px] text-amber-800 mt-1">
              {isUrdu
                ? 'اگر اس وینڈر کو پہلے سے کوئی رقم دینی باقی ہے تو یہاں لکھیں (سپلائر کھاتے میں شامل ہو جائے گی)۔'
                : 'If you have an existing balance payable to this supplier, enter it here to include in ledger.'}
            </p>
          </div>

          <div className="flex items-center space-x-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddSupplierOpen(false)}
              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 cursor-pointer"
            >
              {isUrdu ? 'منسوخ کریں' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={supplierSubmitting}
              className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs shadow-xs cursor-pointer"
            >
              {supplierSubmitting ? (isUrdu ? 'محفوظ ہو رہا ہے...' : 'Saving...') : (isUrdu ? 'سپلائر محفوظ کریں' : 'Save Supplier')}
            </button>
          </div>
        </form>
      </Modal>

      {/* VOID PURCHASE CONFIRMATION MODAL */}
      <Modal
        isOpen={!!purchaseToVoid}
        onClose={() => setPurchaseToVoid(null)}
        title={isUrdu ? '⚠️ خریداری بل منسوخ و مال واپسی (Void Purchase)' : 'Void Purchase & Return Stock'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmVoidPurchase} className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{isUrdu ? 'کیا آپ واقعی یہ خریداری بل منسوخ کرنا چاہتے ہیں؟' : 'Are you sure you want to void this purchase?'}</span>
            </div>
            <div className="text-xs text-slate-700 space-y-1">
              <div><strong>{isUrdu ? 'بل نمبر:' : 'Purchase #:'}</strong> <span className="font-mono text-amber-800 font-bold">{purchaseToVoid?.purchase_number}</span></div>
              <div><strong>{isUrdu ? 'سپلائر:' : 'Supplier:'}</strong> {purchaseToVoid?.supplier_name}</div>
              <div><strong>{isUrdu ? 'کل بل رقم:' : 'Total Bill:'}</strong> <span className="font-mono font-bold">Rs. {purchaseToVoid?.grand_total?.toLocaleString()}</span></div>
              <div><strong>{isUrdu ? 'ادا رقم:' : 'Paid Amount:'}</strong> <span className="font-mono text-emerald-700 font-bold">Rs. {purchaseToVoid?.paid_amount?.toLocaleString()}</span></div>
            </div>
          </div>

          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
            <div className="font-bold">{isUrdu ? 'منسوخی کے اثرات:' : 'Consequences of Voiding:'}</div>
            <ul className="list-disc list-inside space-y-0.5">
              <li>{isUrdu ? 'اس بل کا تمام سامان اسٹاک سے واپس کم کر دیا جائے گا۔' : 'Inventory quantities will be deducted back.'}</li>
              <li>{isUrdu ? 'سپلائر کے کھاتے سے بقایا واجب الادا قرضہ منہا ہو جائے گا۔' : 'Supplier debt will be reversed in ledger.'}</li>
              <li>{isUrdu ? 'اگر کیش دیا گیا تھا تو کیش ڈراور میں رقم واپس جمع ہو گی۔' : 'Cash drawer will be restored if paid by cash.'}</li>
            </ul>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isUrdu ? 'منسوخی کی وجہ / مال واپسی کی تفصیل *' : 'Reason for Void / Return *'}
            </label>
            <input
              type="text"
              required
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder={isUrdu ? 'مثال: ناقص مال سپلائر کو واپس کیا، یا غلط بل اندراج' : 'e.g. Defective stock returned, or entry mistake'}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-rose-500"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setPurchaseToVoid(null)}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 cursor-pointer"
            >
              {isUrdu ? 'منسوخ (واپس)' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isVoiding}
              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>{isVoiding ? (isUrdu ? 'منسوخ ہو رہا ہے...' : 'Voiding...') : (isUrdu ? 'ہاں، بل منسوخ کریں' : 'Yes, Void Purchase')}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
