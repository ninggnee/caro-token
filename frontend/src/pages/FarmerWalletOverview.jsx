import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import axios from "../utils/axiosClient";

const C = { green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", accent: "#00d4aa", muted: "#6b7a99" };
const PRICE = { CR1: 100_000, CR2: 85_000, CR3: 70_000 };

function useBalances() {
  return useQuery({
    queryKey: ["token-balances-db"],
    queryFn: () => axios.get("/token/balances").then(r => r.data),
    staleTime: 30_000,
    retry: 1,
  });
}

function extractBal(bals, key) {
  const v = bals[key];
  return Number(v?.total ?? v ?? 0);
}

function BalCard({ label, value, sub, accent, action, onAction }) {
  return (
    <div style={{ background: "#141f2e", borderRadius: 10, padding: "20px", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: accent || "#e2e8f0", marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted }}>{sub}</div>}
      {action && (
        <button onClick={onAction} style={{ marginTop: 12, padding: "6px 14px", background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.2)", color: C.accent, borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
          {action}
        </button>
      )}
    </div>
  );
}

export default function FarmerWalletOverview() {
  const nav = useNavigate();
  const { user } = useAuth();
  const balQ = useBalances();

  const bals = balQ.data?.balances || {};
  const walletAddr = balQ.data?.wallet_address || user?.wallet_address;
  const tokens = ["CR1", "CR2", "CR3"];
  const totalVnd = tokens.reduce((s, t) => s + extractBal(bals, t) * PRICE[t], 0);
  const totalKg = tokens.reduce((s, t) => s + extractBal(bals, t), 0);

  return (
    <FarmerLayout title="Wallet">
      <div style={{ display: "grid", gap: 20, maxWidth: 1000 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>👛 My Wallet</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => nav("/farmer/wallet/deposit")} style={{ padding: "8px 16px", background: C.accent, color: "#000", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Deposit</button>
            <button onClick={() => nav("/farmer/wallet/withdraw")} style={{ padding: "8px 16px", background: "rgba(255,255,255,0.08)", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>Withdraw</button>
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
          <BalCard label="Portfolio Value (Est.)" value={totalVnd > 0 ? (totalVnd / 1_000_000).toFixed(2) + "M ₫" : "0 ₫"} sub={`${totalKg.toLocaleString("vi-VN")} CaRo tokens`} accent="#e2e8f0" action="Trade Now" onAction={() => nav("/farmer/marketplace")} />
          <BalCard label="Wallet" value={walletAddr ? `${walletAddr.slice(0,8)}…` : "Not linked"} sub={walletAddr ? "Sepolia testnet" : "Update in Profile"} accent={C.accent} />
        </div>

        {/* Wallet address */}
        <div style={{ background: "#141f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "18px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#e2e8f0" }}>Internal Exchange Wallet</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 7, fontFamily: "monospace", fontSize: 13, color: "#e2e8f0", wordBreak: "break-all" }}>
              {user?.wallet_address || "No wallet connected"}
            </div>
            {user?.wallet_address && (
              <button onClick={() => navigator.clipboard.writeText(user.wallet_address)}
                style={{ padding: "8px 14px", background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.2)", color: C.accent, borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                Copy
              </button>
            )}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: C.muted }}>
            ☕ CaRo internal exchange wallet — no MetaMask required for trading. Tokens are credited here when batches are minted.
          </div>
        </div>

        {/* Token breakdown */}
        <div style={{ background: "#141f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Token Holdings</div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                {["Token", "Token_CaRo", "Khối lượng", "Est. Value", "Price/kg"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", fontSize: 11, color: C.muted, fontWeight: 600, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {balQ.isLoading && (
                <tr><td colSpan={5} style={{ padding: 30, textAlign: "center", color: C.muted, fontSize: 13 }}>Loading balances…</td></tr>
              )}
              {tokens.map(t => {
                const bal = extractBal(bals, t);
                const val = bal * PRICE[t];
                return (
                  <tr key={t} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 6, background: "linear-gradient(135deg,#1a5c54,#00d4aa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{t}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>CaRo {t}</div>
                          <div style={{ fontSize: 10, color: C.muted }}>Robusta Coffee Token</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 600, color: bal > 0 ? C.green : C.muted }}>
                      {bal > 0 ? bal.toLocaleString("vi-VN") : "—"}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "#e2e8f0" }}>
                      {bal > 0 ? bal.toLocaleString("vi-VN") + " kg" : "—"}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "#e2e8f0" }}>
                      {val > 0 ? val.toLocaleString("vi-VN") + " ₫" : "—"}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: C.muted }}>
                      {PRICE[t].toLocaleString("vi-VN")} ₫
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Quick actions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[
            { label: "Deposit",             sub: "Add funds to exchange wallet", path: "/farmer/wallet/deposit",  accent: C.green  },
            { label: "Withdraw",            sub: "Transfer to MetaMask",         path: "/farmer/wallet/withdraw", accent: C.red    },
            { label: "Transaction History", sub: "View all transactions",        path: "/farmer/wallet/history",  accent: C.accent },
          ].map(a => (
            <button key={a.path} onClick={() => nav(a.path)}
              style={{ padding: "16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 9, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = a.accent + "40"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: a.accent, marginBottom: 4 }}>{a.label}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{a.sub}</div>
            </button>
          ))}
        </div>

      </div>
    </FarmerLayout>
  );
}
