import axios from "../utils/axiosClient";

export const getOrderbook = (pair) =>
  axios.get("/orders/orderbook", { params: { pair } }).then((r) => r.data);

export const getTickers = () =>
  axios.get("/orders/tickers").then((r) => r.data);

export const getRecentTrades = (pair) =>
  axios.get("/orders/trades", { params: { pair } }).then((r) => r.data);

export const getOpenOrders = (pair) =>
  axios.get("/orders/open", { params: pair ? { pair } : {} }).then((r) => r.data);

export const getAllBuyOrders = (pair) =>
  axios.get("/orders/buy-orders", { params: pair ? { pair } : {} }).then((r) => r.data);

export const placeOrder = (body) =>
  axios.post("/orders", body).then((r) => r.data);

export const cancelOrder = (id) =>
  axios.delete(`/orders/${id}`).then((r) => r.data);

export const updateProfile = (body) =>
  axios.put("/auth/profile", body).then((r) => r.data);

export const changePassword = (body) =>
  axios.put("/auth/password", body).then((r) => r.data);
