import { useQuery } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import axios from "../utils/axiosClient";

const C = { green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", accent: "#487573", muted: "#6b7a99", card: "#172524", border: "rgba(72, 117, 115, 0.15)", tealLight: "#7fe0c9" };

const TOKEN_TYPES = ["CR1", "CR2", "CR3"];

function useOnChainBalances(walletAddress) {
  return useQuery({
    queryKey: ["onchain-balances", walletAddress],
    queryFn: () => axios.get("/token/balances/onchain").then(r => r.data),
    staleTime: 15_000,
    retry: 2,
  });
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: C.card, borderRadius: 10, padding: "20px 22px", border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || "#e2e8f0", marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted }}>{sub}</div>}
    </div>
  );
}

export default function FarmerTokenHoldings() {
  const { account } = useWallet();
  const { user } = useAuth();
  const balQ = useOnChainBalances(account || user?.wallet_address);

  const balances = balQ.data?.balances || {};
  const walletAddr = account || balQ.data?.wallet_address || user?.wallet_address;

  const totalCaRo = TOKEN_TYPES.reduce((s, t) => s + Number(balances[t] || 0), 0);
  const hasWallet = walletAddr && /^0x[0-9a-fA-F]{40}$/.test(walletAddr);

  return (
    <FarmerLayout title="Số dư Token">
      <div style={{ display: "grid", gap: 20, width: "100%" }}>

        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>☕ Số dư Token</h2>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            Số dư thực tế được truy xuất trực tiếp từ hợp đồng thông minh trên blockchain.
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          <StatCard label="Tổng số dư CaRo" value={`${totalCaRo.toLocaleString("vi-VN")} CaRo`} sub="1 CaRo = 1 kg cà phê" color={C.tealLight} />
          <StatCard label="Nguồn dữ liệu" value="On-Chain" sub="balanceOf(walletAddress)" color={C.green} />
          <StatCard label="Mạng lưới" value="Sepolia" sub="Ethereum Testnet" color={C.gold} />
        </div>

        {/* Wallet address */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "18px 20px" }}>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
            Địa chỉ ví MetaMask của Farmer
          </div>
          {hasWallet ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, padding: "10px 14px", background: "rgba(72,117,115,0.05)", border: `1px solid ${C.border}`, borderRadius: 7, fontFamily: "monospace", fontSize: 14, color: "#e2e8f0", wordBreak: "break-all" }}>
                {walletAddr}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(walletAddr)}
                style={{ padding: "8px 14px", background: "rgba(72,117,115,0.12)", border: `1px solid ${C.border}`, color: C.tealLight, borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, flexShrink: 0 }}
              >
                Sao chép
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
              Không có địa chỉ ví nào được liên kết với tài khoản này. Vui lòng cập nhật hồ sơ cá nhân của bạn với một địa chỉ ví blockchain.
            </div>
          )}
        </div>

        {/* Token breakdown table */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Chi tiết số dư Token CaRo</div>
            <button
              onClick={() => balQ.refetch()}
              disabled={balQ.isFetching}
              style={{ padding: "5px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0", borderRadius: 5, cursor: "pointer", fontSize: 12 }}
            >
              {balQ.isFetching ? "Đang tải lại..." : "↺ Tải lại"}
            </button>
          </div>

          {balQ.isError && !hasWallet && (
            <div style={{ padding: "30px 20px", textAlign: "center", color: C.muted, fontSize: 13 }}>
              Vui lòng kết nối địa chỉ ví vào hồ sơ của bạn để xem số dư on-chain.
            </div>
          )}

          {balQ.isError && hasWallet && (
            <div style={{ padding: "20px", color: C.red, fontSize: 13, textAlign: "center" }}>
              Không thể tải số dư on-chain. Vui lòng kiểm tra lại kết nối mạng blockchain.
            </div>
          )}

          {!balQ.isError && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {["Token", "Số dư (CaRo)", "Quy đổi cà phê", "Địa chỉ hợp đồng"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 11, color: C.muted, fontWeight: 600, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {balQ.isLoading && (
                  <tr>
                    <td colSpan={4} style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 13 }}>
                      Đang tải số dư on-chain…
                    </td>
                  </tr>
                )}
                {!balQ.isLoading && TOKEN_TYPES.map(t => {
                  const bal = Number(balances[t] || 0);
                  const contractAddr = balQ.data?.contracts?.[t];
                  return (
                    <tr key={t} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 7, background: "linear-gradient(135deg,#1a5c54,#487573)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{t}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>CaRo {t}</div>
                            <div style={{ fontSize: 10, color: C.muted }}>Token Cà Phê Robusta</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: bal > 0 ? C.tealLight : C.muted }}>
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
                            style={{ fontSize: 11, color: C.tealLight, fontFamily: "monospace" }}>
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
                  <tr style={{ background: "rgba(72,117,115,0.05)", borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: "12px 16px", fontSize: 12, fontWeight: 700, color: C.muted }}>TỔNG CỘNG</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: C.tealLight }}>{totalCaRo.toLocaleString("vi-VN")}</span>
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
        <div style={{ padding: "14px 18px", background: "rgba(72,117,115,0.05)", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 12, color: C.muted }}>
          <span style={{ color: C.tealLight, fontWeight: 600 }}>ℹ Nguồn thông tin chính xác duy nhất:</span> Số dư hiển thị ở đây được đọc trực tiếp từ blockchain thông qua hàm{" "}
          <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3, color: "#e2e8f0" }}>balanceOf(walletAddress)</code>.
          Hệ thống sẽ tự động cập nhật ngay khi các giao dịch mint token được xác nhận trên chuỗi.
        </div>

      </div>
    </FarmerLayout>
  );
}
