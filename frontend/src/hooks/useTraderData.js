/**
 * Centralized data hooks for the Trader role.
 *
 * Using consistent React Query keys ensures all Trader pages share the same
 * cached response — one API call, one cache entry, all components in sync.
 *
 * After deposit / withdrawal / order placement, call invalidateWallet() or
 * invalidateAll() so every component re-fetches in unison.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMarketStats } from '../services/marketApi';
import axios from '../utils/axiosClient';

// ── Stable query keys ─────────────────────────────────────────────────────
export const TRADER_KEYS = {
  wallet:  ['trader-wallet'],
  prices:  ['trader-prices'],
  tokens:  ['trader-token-bals'],
  tickers: ['trader-tickers'],
};

// ── VND wallet balance ────────────────────────────────────────────────────
/**
 * Returns wallet data: { balance, vnd_balance, vnd_available, vnd_locked }
 * All Trader pages that show VND balance must use this hook.
 */
export function useTraderWallet() {
  return useQuery({
    queryKey: TRADER_KEYS.wallet,
    queryFn:  () => axios.get('/wallet/balance').then(r => r.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

// ── Market prices (mock engine — single source of truth) ─────────────────
/**
 * Returns { stats: [{ token, last_price, change_24h, volume_24h, ... }] }
 * All Trader pages that display token prices must use this hook.
 *
 * Helper: getPriceOf(stats, 'CR1') → last_price number (0 if not found)
 */
export function useTraderPrices() {
  return useQuery({
    queryKey: TRADER_KEYS.prices,
    queryFn:  getMarketStats,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

/** Extract last_price for a token from the stats array. */
export function getPriceOf(stats = [], token) {
  return Number(stats.find(s => s.token === token)?.last_price || 0);
}

// ── Off-chain token balances ──────────────────────────────────────────────
/**
 * Returns { data: { CR1: { available, locked, total }, CR2: ..., CR3: ... } }
 */
export function useTraderTokenBals() {
  return useQuery({
    queryKey: TRADER_KEYS.tokens,
    queryFn:  () => axios.get('/orders/my-balances').then(r => r.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

// ── Cache invalidation helpers ────────────────────────────────────────────
/**
 * Call after deposit or withdrawal to instantly refresh all Trader pages.
 * Usage inside a component:
 *   const invalidateWallet = useInvalidateWallet();
 *   await doDeposit();
 *   invalidateWallet();
 */
export function useInvalidateWallet() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: TRADER_KEYS.wallet });
}

/**
 * Call after order placement / cancellation to refresh prices + balances.
 */
export function useInvalidateTraderData() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: TRADER_KEYS.wallet });
    qc.invalidateQueries({ queryKey: TRADER_KEYS.tokens });
    qc.invalidateQueries({ queryKey: TRADER_KEYS.prices });
  };
}
