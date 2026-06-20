import { useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import { useAllBatches } from "../hooks/useBatches";

const C = { green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", accent: "#7fe0c9", muted: "#6b7a99" };

export default function AdminMintedPage() {
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading, isError, refetch } = useAllBatches({
    status: "MINTED",
    search: search || undefined,
    page,
    limit: 10,
  });

  const batches = data?.batches || [];
  const total   = data?.total   || 0;

  const handleSearch = () => { setSearch(searchInput.trim()); setPage(1); };
  const handleClear  = () => { setSearch(""); setSearchInput(""); setPage(1); };

  return (
    <DashboardLayout title="Lịch sử Mint">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>🏅 Lịch sử Lô hàng đã Mint</h2>
          <p style={{ margin: "4px 0 0", color: C.muted, fontSize: 13 }}>
            {total} lô hàng đã được phát hành (tokenize) token thành công
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", background: "#0d1413", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(72,117,115,0.2)" }}>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Mã lô hàng, nông dân..."
              style={{ padding: "8px 12px", background: "none", border: "none", color: "#fff", fontSize: 13, outline: "none", width: 180 }}
            />
            {search && (
              <button onClick={handleClear} style={{ padding: "0 10px", background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14 }}>✕</button>
            )}
            <button onClick={handleSearch} style={{ padding: "8px 12px", background: "#487573", border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>🔍</button>
          </div>
          <button onClick={() => refetch()} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(72,117,115,0.15)", color: "#fff", borderRadius: 8, cursor: "pointer" }}>🔄</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#172524", borderRadius: 10, border: "1px solid rgba(72,117,115,0.15)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.01)", borderBottom: "1px solid rgba(72,117,115,0.15)" }}>
              {["Mã lô hàng", "Nông dân", "Địa chỉ ví", "Khối lượng", "Số lượng CaRo Mint", "Ngày Mint", "Mã giao dịch (TX)"].map((h) => (
                <th key={h} style={{ padding: "11px 14px", color: C.muted, fontWeight: 600, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>

          {isLoading ? (
            <tbody>
              {[1, 2, 3, 4].map((i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(72,117,115,0.1)" }}>
                  {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                    <td key={j} style={{ padding: "14px" }}>
                      <div style={{ height: 12, background: "rgba(72,117,115,0.08)", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ) : isError ? (
            <tbody>
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 60, color: C.red }}>
                Không thể tải dữ liệu — <button onClick={() => refetch()} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", textDecoration: "underline" }}>Thử lại</button>
              </td></tr>
            </tbody>
          ) : batches.length === 0 ? (
            <tbody>
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 60, color: C.muted }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏅</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Chưa có lô hàng nào được Mint</div>
                <div style={{ fontSize: 13 }}>Các lô hàng sẽ hiển thị tại đây sau khi được phê duyệt và phát hành token thành công.</div>
              </td></tr>
            </tbody>
          ) : (
            <tbody>
              {batches.map((b) => {
                const shortWallet = b.farmer_wallet
                  ? `${b.farmer_wallet.slice(0, 8)}...${b.farmer_wallet.slice(-6)}`
                  : "—";
                const shortTx = b.tx_hash
                  ? `${b.tx_hash.slice(0, 10)}...${b.tx_hash.slice(-6)}`
                  : "—";

                return (
                  <tr
                    key={b.id}
                    style={{ borderBottom: "1px solid rgba(72,117,115,0.08)", transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(72,117,115,0.03)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "14px", fontWeight: 700, color: C.accent, whiteSpace: "nowrap" }}>
                      <div>{b.batch_id}</div>
                      <div style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>☕ Robusta</div>
                    </td>
                    <td style={{ padding: "14px" }}>
                      <div style={{ fontWeight: 600 }}>{b.farmer_name || "—"}</div>
                      <div style={{ color: C.muted, fontSize: 11 }}>{b.farmer_email}</div>
                    </td>
                    <td style={{ padding: "14px" }}>
                      <span
                        title={b.farmer_wallet || ""}
                        style={{ fontFamily: "monospace", fontSize: 12, color: C.accent, cursor: b.farmer_wallet ? "help" : "default" }}
                      >
                        {shortWallet}
                      </span>
                    </td>
                    <td style={{ padding: "14px", fontWeight: 600 }}>
                      {Number(b.quantity).toLocaleString()} kg
                    </td>
                    <td style={{ padding: "14px" }}>
                      <span style={{ fontWeight: 700, color: C.green, fontSize: 14 }}>
                        {Number(b.minted_amount || b.quantity).toLocaleString()}
                      </span>
                      <span style={{ color: C.accent, marginLeft: 6, fontSize: 12 }}>{b.quality_grade || "CR1"}</span>
                    </td>
                    <td style={{ padding: "14px", color: C.muted, whiteSpace: "nowrap" }}>
                      {b.minted_at
                        ? new Date(b.minted_at).toLocaleString("vi-VN")
                        : b.approved_at
                        ? new Date(b.approved_at).toLocaleString("vi-VN")
                        : "—"}
                    </td>
                    <td style={{ padding: "14px" }}>
                      {b.tx_hash ? (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${b.tx_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          title={b.tx_hash}
                          style={{ color: C.accent, textDecoration: "none", fontFamily: "monospace", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                        >
                          {shortTx}
                          <span style={{ fontSize: 10, color: C.muted }}>↗</span>
                        </a>
                      ) : (
                        <span style={{ color: C.muted, fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </div>

      {/* Pagination */}
      {total > 10 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", marginTop: 20 }}>
          <button onClick={() => setPage(1)} disabled={page === 1} style={{ padding: "6px 12px", background: "#172524", border: "1px solid rgba(72,117,115,0.15)", color: page === 1 ? C.muted : "#fff", borderRadius: 6, cursor: page === 1 ? "default" : "pointer" }}>«</button>
          <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} style={{ padding: "6px 14px", background: "#172524", border: "1px solid rgba(72,117,115,0.15)", color: page === 1 ? C.muted : "#fff", borderRadius: 6, cursor: page === 1 ? "default" : "pointer" }}>← Trước</button>
          <span style={{ padding: "6px 14px", color: C.muted, fontSize: 13 }}>Trang {page} / {Math.ceil(total / 10)}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={batches.length < 10} style={{ padding: "6px 14px", background: "#172524", border: "1px solid rgba(72,117,115,0.15)", color: batches.length < 10 ? C.muted : "#fff", borderRadius: 6, cursor: batches.length < 10 ? "default" : "pointer" }}>Sau →</button>
          <button onClick={() => setPage(Math.ceil(total / 10))} disabled={batches.length < 10} style={{ padding: "6px 12px", background: "#172524", border: "1px solid rgba(72,117,115,0.15)", color: batches.length < 10 ? C.muted : "#fff", borderRadius: 6, cursor: batches.length < 10 ? "default" : "pointer" }}>»</button>
        </div>
      )}
    </DashboardLayout>
  );
}
