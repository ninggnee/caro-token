import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import * as api from "../services/batchApi";
import { formatNumber } from '../utils/formatters';

// ── Query keys ──────────────────────────────────────────────────────────────
export const BATCH_KEYS = {
  mine:      (params) => ["batches", "mine",  params],
  all:       (params) => ["batches", "all",   params],
  detail:    (id)     => ["batches", "detail", id],
  documents: (id)     => ["batches", "docs",  id],
};

// ── Farmer: my batches ───────────────────────────────────────────────────────
export function useMyBatches(params) {
  return useQuery({
    queryKey: BATCH_KEYS.mine(params),
    queryFn:  () => api.getMyBatches(params),
  });
}

// ── Admin: all batches ───────────────────────────────────────────────────────
export function useAllBatches(params) {
  return useQuery({
    queryKey: BATCH_KEYS.all(params),
    queryFn:  () => api.getAllBatches(params),
  });
}

// ── Shared: single batch (includes documents) ────────────────────────────────
export function useBatch(id) {
  return useQuery({
    queryKey: BATCH_KEYS.detail(id),
    queryFn:  () => api.getBatchById(id),
    enabled:  !!id,
  });
}

// ── Admin: documents for a batch ─────────────────────────────────────────────
export function useBatchDocuments(id) {
  return useQuery({
    queryKey: BATCH_KEYS.documents(id),
    queryFn:  () => api.getBatchDocuments(id),
    enabled:  !!id,
  });
}

// ── Farmer: submit batch (FormData with files) ───────────────────────────────
export function useSubmitBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData) => api.submitBatch(formData),
    onSuccess: (data) => {
      toast.success(`Batch ${data.batch_id} đã gửi thành công!`);
      qc.invalidateQueries({ queryKey: ["batches", "mine"] });
    },
    onError: (e) => {
      toast.error(e?.response?.data?.message || "Gửi batch thất bại");
    },
  });
}

// ── Admin: update grade ───────────────────────────────────────────────────────
export function useUpdateGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, grade }) => api.updateBatchGrade(id, grade),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
    onError: (e) => {
      toast.error(e?.response?.data?.message || "Cập nhật grade thất bại");
    },
  });
}

// ── Admin: approve batch ──────────────────────────────────────────────────────
export function useApproveBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, grade }) => api.approveBatch(id, grade),
    onSuccess: (data) => {
      const amount = formatNumber(Number(data.minted_amount));
      toast.success(`Mint thành công! ${amount} ${data.token_type} → ví farmer`);
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
    onError: (e) => {
      const raw     = e?.response?.data?.message || e?.message || "Approve thất bại";
      const isChain = raw.toLowerCase().includes("minter_role") ||
                      raw.toLowerCase().includes("blockchain") ||
                      raw.toLowerCase().includes("revert") ||
                      raw.toLowerCase().includes("paused");
      if (isChain) {
        toast.error(`Blockchain Mint thất bại: ${raw}`, { autoClose: 10000 });
      } else {
        toast.error(raw);
      }
    },
  });
}

// ── Admin: reject batch ───────────────────────────────────────────────────────
export function useRejectBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) => api.rejectBatch(id, reason),
    onSuccess: () => {
      toast.info("Batch đã bị từ chối.");
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
    onError: (e) => {
      toast.error(e?.response?.data?.message || "Reject thất bại");
    },
  });
}
