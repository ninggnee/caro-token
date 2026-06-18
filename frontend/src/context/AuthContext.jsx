/**
 * AuthContext — authentication state + refresh token rotation (Part 6).
 *
 * Tokens:
 *   access_token  — stored in memory (this context state); 15-min lifetime.
 *   refresh_token — stored in localStorage; rotated on every use.
 *
 * On app load: if a refresh_token exists, silently exchange it for a new
 * access_token so the user does not have to log in again.
 */

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { API_URL } from '../config/api';

const AuthContext = createContext();

const REFRESH_KEY = 'caro_refresh_token';
const USER_KEY    = 'user';

export const AuthProvider = ({ children }) => {
  const [user,        setUser]        = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
  });
  const [accessToken, setAccessToken] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const refreshTimer = useRef(null);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function persist(userData, rt) {
    setUser(userData);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    if (rt) localStorage.setItem(REFRESH_KEY, rt);
  }

  function clearState() {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(REFRESH_KEY);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }

  // Schedule silent refresh 1 minute before expiry (15 min access token)
  function scheduleRefresh() {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    // Refresh after 14 minutes (1 min before 15-min access token expires)
    refreshTimer.current = setTimeout(() => silentRefresh(), 14 * 60 * 1000);
  }

  async function silentRefresh() {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (!rt) return;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) { clearState(); return; }
      const data = await res.json();
      const newAt = data.access_token || data.token;
      setAccessToken(newAt);
      localStorage.setItem('token', newAt);
      localStorage.setItem(REFRESH_KEY, data.refresh_token);
      scheduleRefresh();
    } catch {
      clearState();
    }
  }

  // ── On mount: restore session ─────────────────────────────────────────────
  useEffect(() => {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (rt) {
      silentRefresh().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); };
  }, []);

  // ── Public API ────────────────────────────────────────────────────────────
  const login = (data) => {
    const at = data.access_token || data.token;
    setAccessToken(at);
    persist(data.user, data.refresh_token);
    // Also keep legacy 'token' key so existing Axios calls work
    localStorage.setItem('token', at);
    scheduleRefresh();
  };

  const logout = async () => {
    const rt = localStorage.getItem(REFRESH_KEY);
    const at = accessToken || localStorage.getItem('token');
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${at}` },
        body:    JSON.stringify({ refresh_token: rt }),
      });
    } catch { /* ignore */ }
    clearState();
    localStorage.removeItem('token');
  };

  const updateUser = (newUser) => {
    setUser(newUser);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  };

  // Provide a token getter so existing code (axios interceptors, etc.) can read it
  const getToken = () => accessToken || localStorage.getItem('token');

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, getToken, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
