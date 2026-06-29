import axios from "axios";
import { API_URL } from "../config/api";

const client = axios.create({ baseURL: API_URL });

// attach token if present
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to landing on 401, but NOT for login/refresh endpoints
// (a 401 from /auth/login just means wrong password — it should NOT clear session)
client.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url || "";
    const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/refresh") || url.includes("/auth/register");
    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem("token");
      localStorage.removeItem("caro_refresh_token");
      localStorage.removeItem("user");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

export default client;
