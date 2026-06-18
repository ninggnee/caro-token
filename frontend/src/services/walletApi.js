import axios from "../utils/axiosClient";

export const getWalletBalance = () =>
  axios.get("/wallet/balance").then((r) => r.data);

export const createDeposit = (formData) =>
  axios.post("/wallet/deposit", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((r) => r.data);

export const getMyDeposits = () =>
  axios.get("/wallet/deposit").then((r) => r.data);

export const createWithdraw = (body) =>
  axios.post("/wallet/withdraw", body).then((r) => r.data);

export const getMyWithdraws = () =>
  axios.get("/wallet/withdraw").then((r) => r.data);
