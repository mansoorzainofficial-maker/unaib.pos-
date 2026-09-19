import React, { useState } from 'react';
import { X, Package, CheckCircle2, AlertCircle, Loader2, Barcode, ShieldCheck, Tag, Plus } from 'lucide-react';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function QuickProductModal({
  isOpen,
  onClose,
  categories = [],
  supplierId = null,
  paymentType = 'credit',
  initialCost = 0,
  initialName = '',
  initialCategoryId = '',
  onSuccess
}) {
  const { t, isUrdu } = useLanguage();
  const [name, setName] = useState(initialName || '');
  const [quantity, setQuantity] = useState(10);
  const [categoryId, setCategoryId] = useState(initialCategoryId || '');
  const [costPrice, setCostPrice] = useState(initialCost || '');
  const [salePrice, setSalePrice] = useState('');
  const [barcode, setBarcode] = useState('');
  const [hasSerials, setHasSerials] = useState(false);
  const [warrantyMonths, setWarrantyMonths] = useState(12);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      if (initialName) setName(initialName);
      if (initialCategoryId) setCategoryId(initialCategoryId);
      if (initialCost) {
        setCostPrice(initialCost);
        const num = Number(initialCost);
        if (num > 0 && (!salePrice || Number(salePrice) === 0)) {
          setSalePrice(Math.round((num * 1.25) / 10) * 10);
        }
      }
    }
  }, [isOpen, initialName, initialCategoryId, initialCost]);

  if (!isOpen) return null;

  const handleCostChange = (val) => {
    setCostPrice(val);
    const num = Number(val);
    if (!salePrice || Number(salePrice) === 0) {
      if (num > 0) {
        const suggested = Math.round((num * 1.25) / 10) * 10;
        setSalePrice(suggested);
      }
    }
  };

  const validateCommon = () => {
    if (!name.trim()) {
      setErrorMsg(isUrdu ? 'پراڈکٹ کا نام درج کرنا لازمی ہے۔' : 'Product name is required.');
      return false;
    }

    const numCost = Number(costPrice);
    if (isNaN(numCost) || numCost < 0) {
      setErrorMsg(isUrdu ? 'خریداری لاگت درست نہیں ہے۔' : 'Cost price must be 0 or greater.');
      return false;
    }

    const numSale = Number(salePrice);
    if (isNaN(numSale) || numSale < 0) {
      setErrorMsg(isUrdu ? 'فروخت کی قیمت درست نہیں ہے۔' : 'Sale price must be 0 or greater.');
      return false;
    }

    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setErrorMsg(isUrdu ? 'وصول شدہ تعداد (اسٹاک) کم از کم 1 ہونا ضروری ہے۔' : 'Quantity received must be at least 1.');
      return false;
    }

    return true;
  };



  /**
   * Option 2: Add to GRN Table (For multi-item GRNs)
   */
  const handleSubmitToList = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    if (!validateCommon()) return;

    setSaving(true);
    try {
      const numQty = Number(quantity) || 1;
      const numCost = Number(costPrice) || 0;
      const numSale = Number(salePrice) || 0;

      const payload = {
        name: name.trim(),
        category_id: categoryId ? Number(categoryId) : null,
        cost_price: numCost,
        sale_price: numSale,
        stock_quantity: 0,
        low_stock_threshold: 5,
        supplier_id: supplierId ? Number(supplierId) : null,
        barcode: barcode.trim() || null,
        has_serials: hasSerials ? 1 : 0,
        warranty_months: Number(warrantyMonths) || 12,
        description: null
      };

      const res = await api.products.create(payload);
      if (res && (res.success || res.productId)) {
        const createdProduct = {
          id: res.productId,
          name: name.trim(),
          cost_price: numCost,
          sale_price: numSale,
          stock_quantity: 0,
          category_id: categoryId ? Number(categoryId) : null,
          barcode: barcode.trim() || null,
          has_serials: hasSerials ? 1 : 0
        };
        onSuccess(createdProduct, false, numQty);
        handleClose();
      } else {
        throw new Error(res?.message || 'Failed to create product');
      }
    } catch (err) {
      console.error('Quick product create error:', err);
      let msg = err.message || (isUrdu ? 'پراڈکٹ بنانے میں خرابی ہوئی' : 'Failed to create product');
      if (msg.includes('already exists')) {
        msg = isUrdu ? 'اس بارکوڈ یا نام سے پراڈکٹ پہلے سے موجود ہے۔' : 'A product with this barcode already exists.';
      }
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setName('');
    setQuantity(10);
    setCategoryId('');
    setCostPrice('');
    setSalePrice('');
    setBarcode('');
    setHasSerials(false);
    setWarrantyMonths(12);
    setErrorMsg('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-amber-500 text-slate-950 flex items-center justify-between border-b border-amber-600">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center shadow-xs">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black">
                {isUrdu ? 'نیا پراڈکٹ اور اسٹاک شامل کریں' : 'Add New Product & Stock'}
              </h3>
              <p className="text-[11px] font-semibold text-slate-900/80">
                {isUrdu ? 'نیا سامان درج کریں تاکہ اسٹاک اور انوائس میں فوری دستیاب ہو سکے' : 'Register new item and add to inventory & invoices'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="p-1 text-slate-900 hover:bg-amber-600/50 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <div className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Product Name */}
          <div className="space-y-1">
            <label className="block font-bold text-slate-800">
              {isUrdu ? 'سامان / پراڈکٹ کا نام *' : 'Product Name *'}
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isUrdu ? 'مثلاً: Kingston 128GB Flash Drive یا Logitech G102 Mouse' : 'e.g., Kingston 128GB Flash Drive'}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-hidden"
            />
          </div>

          {/* Quantity Received / Stock */}
          <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-300 space-y-1">
            <label className="block font-black text-emerald-950">
              {isUrdu ? 'وصول شدہ تعداد / آمدنی اسٹاک (Quantity Received) *' : 'Quantity Received / Stock *'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
                className="w-full px-3 py-2 bg-white border border-emerald-400 rounded-xl text-slate-900 font-mono font-black text-base focus:border-emerald-600 focus:outline-hidden"
              />
              <span className="text-emerald-800 font-black whitespace-nowrap text-xs">
                {isUrdu ? 'تعداد (پیسز)' : 'Units'}
              </span>
            </div>
            <p className="text-[11px] text-emerald-800 font-medium">
              {isUrdu
                ? 'جتنی تعداد آپ یہاں لکھیں گے، اتنے پیسز فوری طور پر اسٹاک میں شامل ہو جائیں گے۔'
                : 'This quantity will be added into stock and become available in POS billing.'}
            </p>
          </div>

          {/* Cost Price & Sale Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/80">
            <div className="space-y-1">
              <label className="block font-bold text-amber-950">
                {isUrdu ? 'خریداری لاگت (Cost Price) *' : 'Cost Price *'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 font-mono font-bold text-slate-400">Rs.</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={costPrice}
                  onChange={(e) => handleCostChange(e.target.value)}
                  placeholder="0"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-amber-300 rounded-xl text-slate-900 font-mono font-black text-sm focus:border-amber-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-emerald-950">
                {isUrdu ? 'فروخت کی قیمت (Sale Price) *' : 'Sale Price *'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 font-mono font-bold text-slate-400">Rs.</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="0"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-emerald-300 rounded-xl text-emerald-900 font-mono font-black text-sm focus:border-emerald-600 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Category & Barcode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block font-bold text-slate-700">
                {isUrdu ? 'کیٹیگری' : 'Category'}
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-amber-500 focus:outline-hidden"
              >
                <option value="">-- {isUrdu ? 'عام کیٹیگری' : 'General'} --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700">
                {isUrdu ? 'بارکوڈ (اختیاری)' : 'Barcode (Optional)'}
              </label>
              <div className="relative">
                <Barcode className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Scan or type barcode..."
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono focus:border-amber-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Serials Checkbox */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={hasSerials}
                onChange={(e) => setHasSerials(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
              />
              <span className="font-bold text-slate-800">
                {isUrdu ? 'کیا اس پراڈکٹ کے وارنٹی سیریل نمبرز ہیں؟' : 'Does this product have warranty serial numbers?'}
              </span>
            </label>

            {hasSerials && (
              <div className="pl-6 pt-1 flex items-center gap-2 animate-in fade-in">
                <span className="text-slate-600 font-medium">
                  {isUrdu ? 'وارنٹی کے مہینے:' : 'Warranty Months:'}
                </span>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={warrantyMonths}
                  onChange={(e) => setWarrantyMonths(e.target.value)}
                  className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold text-slate-900"
                />
                <span className="text-slate-500 font-medium">
                  {isUrdu ? 'ماہ' : 'Months'}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer text-center"
            >
              {t('cancel', 'منسوخ')}
            </button>

            <button
              type="button"
              onClick={handleSubmitToList}
              disabled={saving}
              className="px-5 py-2.5 text-xs font-black text-slate-950 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{isUrdu ? 'محفوظ ہو رہا ہے...' : 'Saving...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isUrdu ? '✓ پراڈکٹ محفوظ کریں' : '✓ Save Product'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
