/**
 * Shared validation for price / quantity / amount inputs (Trader & Farmer).
 * Negative values must never reach state — strip "-" as it's typed or pasted.
 */

/**
 * sanitizeNonNegative("-100") -> "100"
 * sanitizeNonNegative("12-3") -> "123"
 */
export function sanitizeNonNegative(value) {
  if (value == null) return value;
  return String(value).replace(/-/g, '');
}

/** onChange wrapper: strips "-" before handing the value to the setter. */
export function onNonNegativeChange(setter) {
  return (e) => setter(sanitizeNonNegative(e.target.value));
}
