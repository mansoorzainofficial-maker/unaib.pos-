import React from 'react';
import { Trash2, Plus } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function GrnItemRow({
  item,
  index,
  products = [],
  categories = [],
  onChange,
  onRemove,
  onOpenAddProduct,
  canRemove = true
}) {
  const { t, isUrdu } = useLanguage();
  const lineTotal = Math.round((Number(item.quantity_received || 0) * Number(item.unit_cost || 0)) * 100) / 100;

  // Find currently selected product if item has a product_id
  const currentProduct = products.find(p => item.product_id && String(p.id) === String(item.product_id));

  // Determine selected category: either from item.category_id or inferred from currentProduct
  const selectedCategoryId = (item.category_id !== undefined && item.category_id !== null && item.category_id !== '')
    ? String(item.category_id)
    : (currentProduct?.category_id ? String(currentProduct.category_id) : '');

  // Filter products by selected category (if a category is selected)
  const filteredProducts = selectedCategoryId
    ? products.filter(p => String(p.category_id) === String(selectedCategoryId))
    : products;

  const handleCategoryChange = (newCatId) => {
    // Condition 1: Always reset product_id to '' and unit_cost to 0 when category is changed
    onChange(index, {
      ...item,
      category_id: newCatId ? Number(newCatId) : '',
      product_id: '',
      unit_cost: 0
    });
  };

  const handleProductChange = (productId) => {
    if (productId === '__new__') {
      if (onOpenAddProduct) onOpenAddProduct(index);
      return;
    }
    const selected = products.find(p => productId && String(p.id) === String(productId));
    onChange(index, {
      ...item,
      product_id: productId ? (selected?.id ?? productId) : '',
      custom_product_name: '',
      category_id: (selected?.category_id !== undefined && selected?.category_id !== null && selected?.category_id !== '')
        ? Number(selected.category_id)
        : item.category_id,
      unit_cost: selected ? Number(selected.cost_price || 0) : item.unit_cost
    });
    setSearchQuery('');
    setIsOpen(false);
  };

  const [searchQuery, setSearchQuery] = React.useState(item.custom_product_name || '');
  const [isOpen, setIsOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const inputRef = React.useRef(null);
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    if (item.custom_product_name && !item.product_id && searchQuery !== item.custom_product_name) {
      setSearchQuery(item.custom_product_name);
    }
  }, [item.custom_product_name, item.product_id]);

  // Close dropdown on click outside
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const trimmedSearch = (searchQuery || '').trim().toLowerCase();

  // Cross-category intelligent product matching
  const matches = React.useMemo(() => {
    if (!products || !Array.isArray(products)) return [];

    if (trimmedSearch) {
      // Search all products across entire catalog regardless of category
      const matched = products.filter(p => {
        if (!p) return false;
        const nameMatch = p.name ? String(p.name).toLowerCase().includes(trimmedSearch) : false;
        const barcodeMatch = p.barcode ? String(p.barcode).toLowerCase().includes(trimmedSearch) : false;
        const idMatch = String(p.id) === trimmedSearch;
        return nameMatch || barcodeMatch || idMatch;
      });

      // If category is selected, sort products in that category to the top
      if (selectedCategoryId) {
        return [...matched].sort((a, b) => {
          const aInCat = String(a.category_id) === String(selectedCategoryId) ? 0 : 1;
          const bInCat = String(b.category_id) === String(selectedCategoryId) ? 0 : 1;
          return aInCat - bInCat;
        });
      }
      return matched;
    }

    // If search query is empty, filter by category if selected
    if (selectedCategoryId) {
      return products.filter(p => String(p.category_id) === String(selectedCategoryId));
    }

    return products;
  }, [products, trimmedSearch, selectedCategoryId]);

  return (
    <tr className="hover:bg-slate-50/80 transition-colors text-xs">
      {/* 1. Row Number */}
      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
        {index + 1}
      </td>

      {/* 2. Category Dropdown */}
      <td className="py-2.5 px-3 w-48">
        <select
          value={selectedCategoryId}
          onChange={(e) => handleCategoryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-hidden text-xs"
        >
          <option value="">{t('grn_select_category_option') || (isUrdu ? '-- تمام کیٹیگریز --' : '-- All Categories --')}</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </td>

      {/* 3. Searchable Product Selector (Zero-Scroll Combobox) */}
      <td className="py-2.5 px-3 min-w-[280px]">
        {currentProduct ? (
          <div className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 bg-amber-50/80 border border-amber-300 rounded-lg text-xs shadow-2xs">
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-900 truncate">{currentProduct.name}</div>
              <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                {currentProduct.barcode && (
                  <span className="font-mono bg-white px-1 rounded border border-slate-200">
                    [{currentProduct.barcode}]
                  </span>
                )}
                <span className="text-amber-800 font-semibold">
                  {t('grn_current_stock')} {currentProduct.stock_quantity}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                handleProductChange('');
                setSearchQuery('');
                onChange(index, {
                  ...item,
                  product_id: '',
                  custom_product_name: ''
                });
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              title={isUrdu ? 'پراڈکٹ تبدیل کریں (Change)' : 'Change Product'}
              className="px-1.5 py-0.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 rounded text-[10px] font-bold transition-colors cursor-pointer shrink-0"
            >
              ✕ {isUrdu ? 'بدلیں' : 'Change'}
            </button>
          </div>
        ) : (
          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                placeholder={isUrdu ? "🔍 پراڈکٹ کا نام یا بارکوڈ لکھیں (جیسے Mouse, SSD)..." : "🔍 Type name or scan barcode..."}
                value={searchQuery}
                onFocus={() => setIsOpen(true)}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  setIsOpen(true);
                  setHighlightedIndex(0);
                  onChange(index, {
                    ...item,
                    product_id: '',
                    custom_product_name: val
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlightedIndex(prev => Math.min(prev + 1, matches.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlightedIndex(prev => Math.max(prev - 1, 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (matches.length > 0) {
                      const target = matches[Math.min(highlightedIndex, matches.length - 1)];
                      if (target) {
                        handleProductChange(target.id);
                        setIsOpen(false);
                        setSearchQuery('');
                      }
                    } else if (onOpenAddProduct) {
                      setIsOpen(false);
                      onOpenAddProduct(index);
                    }
                  } else if (e.key === 'Escape') {
                    setIsOpen(false);
                  }
                }}
                required={!item.product_id && !item.custom_product_name?.trim()}
                className="w-full px-2.5 py-1.5 bg-white border-2 border-amber-400 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-amber-200 focus:outline-hidden text-xs placeholder:text-slate-400 shadow-2xs"
              />
            </div>

            {/* Auto-Register Badge: ONLY show when user typed something AND no catalog product matches */}
            {searchQuery.trim() && !item.product_id && matches.length === 0 && (
              <div className="flex items-center justify-between mt-1 px-2.5 py-1.5 bg-amber-50/95 border border-amber-300 rounded-lg text-amber-950 animate-in fade-in shadow-2xs">
                <span className="text-[11px] font-bold flex items-center gap-1.5">
                  <span>✨ {isUrdu ? 'نیا آئٹم: محفوظ ہوتے ہی خودکار رجسٹر ہوگا' : 'New item: auto-registers on save'}</span>
                </span>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsOpen(false);
                    if (onOpenAddProduct) onOpenAddProduct(index);
                  }}
                  className="text-[10px] bg-amber-200 hover:bg-amber-300 text-amber-950 px-2 py-0.5 rounded font-bold transition-colors cursor-pointer"
                >
                  {isUrdu ? 'فارم کھولیں' : 'Open Form'}
                </button>
              </div>
            )}

            {/* Instant Filter Dropdown */}
            {isOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] max-h-64 overflow-y-auto divide-y divide-slate-100 min-w-[320px]">
                {/* 1. Filtered Catalog Matches (Displayed First) */}
                {matches.slice(0, 15).map((p, pIdx) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleProductChange(p.id);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors cursor-pointer text-xs ${
                      highlightedIndex === pIdx ? 'bg-amber-100 font-bold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                        {p.barcode && (
                          <span className="font-mono bg-slate-100 text-slate-700 px-1 rounded border border-slate-200">
                            [{p.barcode}]
                          </span>
                        )}
                        <span>
                          {t('grn_current_stock')} <strong className="text-slate-800">{p.stock_quantity ?? 0}</strong>
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-amber-800 text-xs">
                        Rs. {Number(p.cost_price || 0).toLocaleString()}
                      </div>
                      <div className="text-[9px] text-slate-400">
                        {isUrdu ? 'خرید قیمت' : 'Cost'}
                      </div>
                    </div>
                  </button>
                ))}

                {/* 2. Secondary Quick Add option at bottom when typing */}
                {matches.length > 0 && searchQuery.trim() && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setIsOpen(false);
                      if (onOpenAddProduct) onOpenAddProduct(index);
                    }}
                    className="w-full px-3 py-2 text-left bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-900 font-semibold flex items-center justify-between gap-1.5 text-xs transition-colors cursor-pointer border-t border-slate-200"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">
                        {isUrdu ? `➕ نیا پروڈکٹ فارم کھولیں: "${searchQuery}"` : `➕ Register New Product: "${searchQuery}"`}
                      </span>
                    </div>
                    <span className="text-[10px] bg-slate-200 hover:bg-blue-200 text-slate-800 px-1.5 py-0.5 rounded font-bold shrink-0">
                      {isUrdu ? 'فارم' : 'Form'}
                    </span>
                  </button>
                )}

                {/* 3. When NO products match query */}
                {matches.length === 0 && (
                  <div className="p-3 text-center text-xs bg-slate-50">
                    <p className="font-bold text-slate-800">
                      {searchQuery.trim()
                        ? (isUrdu ? `"${searchQuery}" کیٹلاگ میں نہیں ملا` : `"${searchQuery}" not found in catalog`)
                        : (isUrdu ? 'کوئی پروڈکٹ موجود نہیں' : 'No products found')}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {isUrdu
                        ? 'فکر نہ کریں! نیچے "رسید محفوظ کریں" دبانے پر یہ نیا سامان خودکار رجسٹر ہو جائے گا۔'
                        : 'No problem! It will automatically register when you save the GRN.'}
                    </p>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsOpen(false);
                        if (onOpenAddProduct) onOpenAddProduct(index);
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{isUrdu ? 'مکمل فارم کھولیں' : 'Open Product Form'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </td>

      {/* 4. Quantity Received */}
      <td className="py-2.5 px-3 w-28">
        <input
          type="number"
          min="1"
          required
          value={item.quantity_received}
          onChange={(e) => onChange(index, { ...item, quantity_received: e.target.value, quantity_ordered: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold text-slate-900 focus:border-amber-500 focus:outline-hidden"
        />
      </td>

      {/* 5. Unit Cost */}
      <td className="py-2.5 px-3 w-36">
        <div className="relative">
          <span className="absolute left-2.5 top-1.5 text-slate-400 font-mono font-bold text-[11px]">Rs.</span>
          <input
            type="number"
            min="0"
            step="any"
            required
            value={item.unit_cost}
            onChange={(e) => onChange(index, { ...item, unit_cost: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-right font-mono font-bold text-slate-900 focus:border-amber-500 focus:outline-hidden"
          />
        </div>
      </td>

      {/* 6. Line Total */}
      <td className="py-2.5 px-3 text-left font-mono font-black text-amber-900 w-32 whitespace-nowrap">
        Rs. {lineTotal.toLocaleString()}
      </td>

      {/* 7. Action / Remove */}
      <td className="py-2.5 px-3 text-center w-12">
        {canRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove(index);
            }}
            title={t('grn_remove_row_title')}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  );
}
