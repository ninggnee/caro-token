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
 * formatKg(1085.7)          → "1.085,7 kg"
 * formatKg(1.5, 1)          → "1,5 kg"
 *
 * Default decimals is 2 (not 0) because processing-loss-adjusted weights
 * (net_quantity) carry fractional kg — rounding those to whole numbers here
 * while the minted token amount is shown with full precision elsewhere
 * creates a false "Token != warehouse weight" mismatch. Whole-kg values are
 * unaffected since minimumFractionDigits stays 0.
 */
export function formatKg(n, decimals = 2) {
  return formatNumber(n, decimals) + ' kg';
}

/**
 * Format a token amount with an optional label.
 * formatToken(1000, 'CaRo1') → "1.000 CaRo1"
 * formatToken(2500)          → "2.500"
 */
export function formatToken(n, tokenLabel = '') {
  const num = Number(n ?? 0);
  if (isNaN(num)) return '0' + (tokenLabel ? ' ' + tokenLabel : '');
  const formatted = num.toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
  return formatted + (tokenLabel ? ' ' + tokenLabel : '');
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

/**
 * Format a date string to dd/mm/yyyy format.
 * formatDate("2026-07-03T00:00:00.000Z") -> "03/07/2026"
 * formatDate("2026-07-03") -> "03/07/2026"
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d}/${m}/${y}`;
    }
  } catch (e) {}
  return dateStr;
}

