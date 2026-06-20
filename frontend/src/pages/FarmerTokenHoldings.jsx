import { useQuery } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import axios from "../utils/axiosClient";

const C = { green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", accent: "#00d4aa", muted: "#6b7a99" };

const TOKEN_TYPES = ["CR1", "CR2", "CR3"];

function useTokenBalances() {
  return useQuery({
    queryKey: ["token-balances-db"],
    queryFn: () => axios.get("/token/balances").then(r => r.data),
    staleTime: 15_000,
    retry: 2,
  });
}

function extractBal(bals, key) {
  const v = bals[key];
  return Number(v?.total ?? v ?? 0);
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: "#141f2e", borderRadius: 10, padding: "20px 22px", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || "#e2e8f0", marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted }}>{sub}</div>}
    </div>
  );
}

export default function FarmerTokenHoldings() {
  const { user } = useAuth();
  const balQ = useTokenBalances();

  const balances = balQ.data?.balances || {};
  const walletAddr = balQ.data?.wallet_address || user?.wallet_address;

  const totalCaRo = TOKEN_TYPES.reduce((s, t) => s + extractBal(balances, t), 0);
  const hasWallet = walletAddr && /^0x[0-9a-fA-F]{40}$/.test(walletAddr);

  return (
    <FarmerLayout title="Token Holdings">
      <div style={{ display: "grid", gap: 20, maxWidth: 960 }}>

        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>☕ Token Holdings</h2>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            Token_CaRo và Khối lượng phản ánh tổng token đã được mint vào tài khoản của bạn.
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
          <StatCard label="Token_CaRo (Tổng)" value={`${totalCaRo.toLocaleString("vi-VN")} CaRo`} sub="Tổng token đã mint" color={C.accent} />
          <StatCard label="Khối lượng" value={`${totalCaRo.toLocaleString("vi-VN")} kg`} sub="1 CaRo = 1 kg cà phê" color={C.green} />
        </div>

        {/* Wallet address */}
        <div style={{ background: "#141f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "18px 20px" }}>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
            Farmer Wallet Address
          </div>
          {hasWallet ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, padding: "10px 14px", background: "rgba(0,212,170,0.04)", border: "1px solid rgba(0,212,170,0.15)", borderRadius: 7, fontFamily: "monospace", fontSize: 14, color: "#e2e8f0", wordBreak: "break-all" }}>
                {walletAddr}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(walletAddr)}
                style={{ padding: "8px 14px", background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.2)", color: C.accent, borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, flexShrink: 0 }}
              >
                Copy
              </button>
              <a
                href={`https://sepolia.etherscan.io/address/${walletAddr}`}
                target="_blank" rel="noreferrer"
                style={{ padding: "8px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0", borderRadius: 6, fontSize: 12, textDecoration: "none", flexShrink: 0 }}
              >
                Etherscan ↗
              </a>
            </div>
          ) : (
            <div style={{ padding: "14px", background: "rgba(246,70,93,0.06)", border: "1px solid rgba(246,70,93,0.15)", borderRadius: 7, color: C.red, fontSize: 13 }}>
              No wallet address linked to this account. Please update your profile with a blockchain wallet address.
            </div>
          )}
        </div>

        {/* Token breakdown table */}
        <div style={{ background: "#141f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>CaRo Token Balances</div>
            <button
              onClick={() => balQ.refetch()}
              disabled={balQ.isFetching}
              style={{ padding: "5px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0", borderRadius: 5, cursor: "pointer", fontSize: 12 }}
            >
              {balQ.isFetching ? "Refreshing…" : "↺ Refresh"}
            </button>
          </div>

          {balQ.isError && !hasWallet && (
            <div style={{ padding: "30px 20px", textAlign: "center", color: C.muted, fontSize: 13 }}>
              Connect a wallet address to your profile to view on-chain holdings.
            </div>
          )}

          {balQ.isError && hasWallet && (
            <div style={{ padding: "20px", color: C.red, fontSize: 13, textAlign: "center" }}>
              Failed to load on-chain balance. Check that the blockchain node is accessible.
            </div>
          )}

          {!balQ.isError && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {["Token", "Token_CaRo", "Khối lượng", "Contract"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 11, color: C.muted, fontWeight: 600, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {balQ.isLoading && (
                  <tr>
                    <td colSpan={4} style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 13 }}>
                      Loading on-chain balances…
                    </td>
                  </tr>
                )}
                {!balQ.isLoading && TOKEN_TYPES.map(t => {
                  const bal = extractBal(balances, t);
                  const contractAddr = balQ.data?.contracts?.[t];
                  return (
                    <tr key={t} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 7, background: "linear-gradient(135deg,#1a5c54,#00d4aa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{t}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>CaRo {t}</div>
                            <div style={{ fontSize: 10, color: C.muted }}>Robusta Coffee Token</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: bal > 0 ? C.green : C.muted }}>
                          {bal > 0 ? bal.toLocaleString("vi-VN") : "0"}
                        </span>
                        <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>CaRo</span>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13, color: "#e2e8f0" }}>
                        {bal > 0 ? bal.toLocaleString("vi-VN") + " kg" : "—"}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {contractAddr ? (
                          <a href={`https://sepolia.etherscan.io/address/${contractAddr}`} target="_blank" rel="noreferrer"
                            style={{ fontSize: 11, color: C.accent, fontFamily: "monospace" }}>
                            {contractAddr.slice(0, 8)}…{contractAddr.slice(-4)} ↗
                          </a>
                        ) : (
                          <span style={{ fontSize: 11, color: C.muted }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!balQ.isLoading && (
                  <tr style={{ background: "rgba(0,212,170,0.03)", borderTop: "1px solid rgba(0,212,170,0.1)" }}>
                    <td style={{ padding: "12px 16px", fontSize: 12, fontWeight: 700, color: C.muted }}>TOTAL</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: C.accent }}>{totalCaRo.toLocaleString("vi-VN")}</span>
                      <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>CaRo</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>
                      {totalCaRo > 0 ? totalCaRo.toLocaleString("vi-VN") + " kg" : "—"}
                    </td>
                    <td />
                  </tr>
                )}

              </tbody>
            </table>
          )}
        </div>

        {/* Info note */}
        <div style={{ padding: "14px 18px", background: "rgba(0,212,170,0.04)", border: "1px solid rgba(0,212,170,0.12)", borderRadius: 9, fontSize: 12, color: C.muted }}>
          <span style={{ color: C.accent, fontWeight: 600 }}>ℹ Nguồn dữ liệu:</span>{" "}
          Token_CaRo và Khối lượng hiển thị ở đây phản ánh tổng token đã được mint cho tài khoản của bạn.
          Giá trị được cập nhật tự động sau khi admin duyệt và mint batch của bạn.
        </div>

      </div>
    </FarmerLayout>
  );
}
