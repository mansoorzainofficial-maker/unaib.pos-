import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * ActionButton
 * 
 * Reusable button with built-in:
 * - Double-click / rapid tap protection
 * - Automatic disable + pointer-events-none while loading
 * - Animated loading spinner
 * - Urdu / English status text
 */
export function ActionButton({
  children,
  onClick,
  loading = false,
  isSubmitting = false,
  loadingText = 'براہ کرم انتظار کریں...',
  disabled = false,
  variant = 'primary',
  icon: Icon,
  className = '',
  type = 'button',
  ...props
}) {
  const isLoading = Boolean(loading || isSubmitting);
  const isDisabled = disabled || isLoading;

  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 select-none text-sm';
  
  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-[0.98]',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-[0.98]',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm active:scale-[0.98]',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-[0.98]',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 active:scale-[0.98]',
    outline: 'border border-slate-600 text-slate-300 hover:bg-slate-700 active:scale-[0.98]'
  };

  const currentVariant = variantStyles[variant] || variantStyles.primary;
  const disabledStyles = isDisabled ? 'opacity-60 cursor-not-allowed pointer-events-none active:scale-100 shadow-none' : '';

  return (
    <button
      type={type}
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      className={`${baseStyles} ${currentVariant} ${disabledStyles} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{loadingText}</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 shrink-0" />}
          {children}
        </span>
      )}
    </button>
  );
}

export default ActionButton;
