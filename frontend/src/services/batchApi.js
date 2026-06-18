import axios from "../utils/axiosClient";

// ── Farmer ─────────────────────────────────────────────────────────────────

/**
 * Submit a new batch.
 * @param {FormData} formData  Must include text fields + file fields per document category
 */
export const submitBatch = (formData) =>
  axios.post("/batches", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((r) => r.data);

export const getMyBatches = (params) =>
  axios.get("/batches/mine", { params }).then((r) => r.data);

// ── Shared ──────────────────────────────────────────────────────────────────

export const getBatchById = (id) =>
  axios.get(`/batches/${id}`).then((r) => r.data);

// ── Admin ───────────────────────────────────────────────────────────────────

export const getAllBatches = (params) =>
  axios.get("/batches", { params }).then((r) => r.data);

export const getBatchDocuments = (id) =>
  axios.get(`/batches/${id}/documents`).then((r) => r.data);

export const approveBatch = (id) =>
  axios.post(`/batches/${id}/approve`).then((r) => r.data);

export const rejectBatch = (id, reason) =>
  axios.post(`/batches/${id}/reject`, { reason }).then((r) => r.data);
