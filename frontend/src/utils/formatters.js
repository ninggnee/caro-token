/**
 * Global number formatting utilities — Vietnamese locale standard.
 *
 * Thousands separator : "."   (e.g. 1.250.000)
 * Decimal separator   : ","   (e.g. 1,5 kg — only when needed)
 * No trailing zeros   : 500 not 500.00
 */

/**
 * Format a number with Vietnamese thousands separator.
 * formatNumber(2000)        → "2.000"
 * formatNumber(1250000)     → "1.250.000"
 * formatNumber(1.5, 1)      → "1,5"
 */
export function formatNumber(n, decimals = 0) {
  const num = Number(n ?? 0);
  if (isNaN(num)) return '0';
  return num.toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format Vietnamese Dong — no decimal places.
 * formatVND(90000)          → "90.000 VND"
 * formatVND(1250000)        → "1.250.000 VND"
 */
export function formatVND(n) {
  return formatNumber(n, 0) + ' VND';
}

/**
 * Format a weight value in kilograms.
 * formatKg(500)             → "500 kg"
 * formatKg(15000)           → "15.000 kg"
 * formatKg(1.5, 1)          → "1,5 kg"
 */
export function formatKg(n, decimals = 0) {
  return formatNumber(n, decimals) + ' kg';
}

/**
 * Format a token amount with an optional label.
 * formatToken(1000, 'CaRo1') → "1.000 CaRo1"
 * formatToken(2500)          → "2.500"
 */
export function formatToken(n, tokenLabel = '') {
  return formatNumber(n, 0) + (tokenLabel ? ' ' + tokenLabel : '');
}

/**
 * Format a percentage.
 * formatPct(12.5)            → "12,5%"
 * formatPct(-3.2)            → "-3,2%"
 */
export function formatPct(n, decimals = 2) {
  const num = Number(n ?? 0);
  if (isNaN(num)) return '0%';
  return num.toLocaleString('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + '%';
}
