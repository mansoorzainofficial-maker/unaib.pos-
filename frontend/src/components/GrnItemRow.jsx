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
  const currentProduct = products.find(p => p.id === Number(item.product_id));

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
    const selected = products.find(p => p.id === Number(productId));
    onChange(index, {
      ...item,
      product_id: productId ? Number(productId) : '',
      category_id: selected?.category_id ? Number(selected.category_id) : item.category_id,
      unit_cost: selected ? Number(selected.cost_price || 0) : item.unit_cost
    });
  };

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

      {/* 3. Product Dropdown */}
      <td className="py-2.5 px-3 min-w-[260px]">
        <div className="flex items-center gap-1.5">
          <select
            value={item.product_id || ''}
            onChange={(e) => handleProductChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            required
            className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-hidden text-xs"
          >
            <option value="">{t('grn_select_product_option')}</option>
            {filteredProducts.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({t('grn_current_stock')} {p.stock_quantity})
              </option>
            ))}
          </select>
          {onOpenAddProduct && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenAddProduct(index);
              }}
              title={t('grn_quick_add_product')}
              className="p-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg shrink-0 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
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
