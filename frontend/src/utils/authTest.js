import axios from "./axiosClient";

export async function registerTest(payload) {
  const res = await axios.post(`/auth/register`, payload);
  return res.data;
}

export async function loginTest(email, password, role = null) {
  const body = { email, password };
  if (role) body.role = role;
  const res = await axios.post(`/auth/login`, body);

  const data = res.data;
  if (data?.token) localStorage.setItem("token", data.token);
  if (data?.user) localStorage.setItem("user", JSON.stringify(data.user));

  return data;
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
