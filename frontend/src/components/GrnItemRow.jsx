import React from 'react';
import { Trash2, Plus } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function GrnItemRow({
  item,
  index,
  products = [],
  onChange,
  onRemove,
  onOpenAddProduct,
  canRemove = true
}) {
  const { t } = useLanguage();
  const lineTotal = Math.round((Number(item.quantity_received || 0) * Number(item.unit_cost || 0)) * 100) / 100;

  const handleProductChange = (productId) => {
    if (productId === '__new__') {
      if (onOpenAddProduct) onOpenAddProduct(index);
      return;
    }
    const selected = products.find(p => p.id === Number(productId));
    onChange(index, {
      ...item,
      product_id: productId ? Number(productId) : '',
      unit_cost: selected ? Number(selected.cost_price || 0) : item.unit_cost
    });
  };

  return (
    <tr className="hover:bg-slate-50/80 transition-colors text-xs">
      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
        {index + 1}
      </td>

      <td className="py-2.5 px-3 min-w-[260px]">
        <div className="flex items-center gap-1.5">
          <select
            value={item.product_id || ''}
            onChange={(e) => handleProductChange(e.target.value)}
            required
            className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-hidden text-xs"
          >
            <option value="">{t('grn_select_product_option')}</option>
            <option value="__new__" className="font-bold text-amber-700 bg-amber-50">
              {t('grn_select_or_add_prod')}
            </option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({t('grn_current_stock')} {p.stock_quantity})
              </option>
            ))}
          </select>
          {onOpenAddProduct && (
            <button
              type="button"
              onClick={() => onOpenAddProduct(index)}
              title={t('grn_quick_add_product')}
              className="p-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg shrink-0 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>

      <td className="py-2.5 px-3 w-32">
        <input
          type="number"
          min="1"
          required
          value={item.quantity_received}
          onChange={(e) => onChange(index, { ...item, quantity_received: e.target.value, quantity_ordered: e.target.value })}
          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold text-slate-900 focus:border-amber-500 focus:outline-hidden"
        />
      </td>

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
            className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-right font-mono font-bold text-slate-900 focus:border-amber-500 focus:outline-hidden"
          />
        </div>
      </td>

      <td className="py-2.5 px-3 text-left font-mono font-black text-amber-900 w-36 whitespace-nowrap">
        Rs. {lineTotal.toLocaleString()}
      </td>

      <td className="py-2.5 px-3 text-center w-12">
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
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
