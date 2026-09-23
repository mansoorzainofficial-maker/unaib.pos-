import { useState, useRef, useCallback } from 'react';

/**
 * useSubmitGuard
 * 
 * Custom hook to guard forms and mutation actions against:
 * 1. Microsecond double-clicks / rapid multi-tap (via synchronous useRef lock).
 * 2. In-flight race conditions (disables button while promise is pending).
 * 3. Rapid post-submit re-clicks (configurable cooldown window, default 800ms).
 * 
 * @param {Function} asyncFn - The async function that performs the submit / API call.
 * @param {Object} options - Configuration options:
 *   - cooldownMs: Cooldown time in ms before re-enabling action (default: 800)
 *   - onError: Optional error callback
 * @returns {[Function, boolean]} [guardedFn, isSubmitting]
 */
export function useSubmitGuard(fnOrCooldown, maybeOptions = {}) {
  const isFunction = typeof fnOrCooldown === 'function';
  const asyncFn = isFunction ? fnOrCooldown : null;
  const rawOptions = isFunction
    ? maybeOptions
    : (typeof fnOrCooldown === 'number' ? { cooldownMs: fnOrCooldown } : (fnOrCooldown || {}));
  const cooldownMs = rawOptions.cooldownMs ?? (typeof fnOrCooldown === 'number' ? fnOrCooldown : 800);
  const onError = rawOptions.onError;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLockedRef = useRef(false);

  const createGuarded = useCallback((targetFn) => {
    return async (...args) => {
      if (isLockedRef.current) {
        console.warn('[SubmitGuard] Prevented rapid duplicate click/tap.');
        return;
      }

      isLockedRef.current = true;
      setIsSubmitting(true);

      try {
        return await targetFn(...args);
      } catch (err) {
        if (onError) onError(err);
        throw err;
      } finally {
        setTimeout(() => {
          isLockedRef.current = false;
          setIsSubmitting(false);
        }, cooldownMs);
      }
    };
  }, [cooldownMs, onError]);

  if (isFunction) {
    const guarded = createGuarded(asyncFn);
    return [guarded, isSubmitting];
  }

  return [isSubmitting, createGuarded];
}

export default useSubmitGuard;
