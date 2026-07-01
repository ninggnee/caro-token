import { useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import { useAllBatches } from "../hooks/useBatches";
import { formatNumber, formatKg } from '../utils/formatters';

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
      <div className="caro-page">
        {/* Header */}
        <div className="caro-page-header">
          <div>
            <h2 className="caro-page-title">🏅 Lịch sử Lô hàng đã Mint</h2>
            <p className="caro-page-subtitle">
              <strong style={{ color: "#f8fafc" }}>{total}</strong> lô hàng đã được phát hành (tokenize) token thành công
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="caro-field" style={{ marginBottom: 0, position: "relative" }}>
              <input
                className="caro-input"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Mã lô hàng, nông dân..."
                style={{ paddingRight: 80, width: 280 }}
              />
              <div style={{ position: "absolute", right: 4, top: 4, display: "flex", gap: 4 }}>
                {search && (
                  <button onClick={handleClear} className="caro-btn caro-btn-ghost caro-btn-sm" style={{ padding: "4px 8px" }}>✕</button>
                )}
                <button onClick={handleSearch} className="caro-btn caro-btn-primary caro-btn-sm" style={{ padding: "4px 12px" }}>🔍</button>
              </div>
            </div>
            <button onClick={() => refetch()} className="caro-btn caro-btn-ghost">🔄</button>
          </div>
        </div>

        {/* Table */}
        <div className="caro-table-container">
          <table className="caro-table">
            <thead>
              <tr>
                {["Mã lô hàng", "Nông dân", "Địa chỉ ví", "Khối lượng", "Số lượng CaRo Mint", "Ngày Mint", "Mã giao dịch (TX)"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>

            {isLoading ? (
              <tbody>
                {[1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                      <td key={j} style={{ padding: "20px 16px" }}>
                        <div style={{ height: 16, background: "rgba(255,255,255,0.05)", borderRadius: 4, animation: "caro-spin 1.5s infinite" }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ) : isError ? (
              <tbody>
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 60, color: "#ef4444" }}>
                  Không thể tải dữ liệu — <button onClick={() => refetch()} className="caro-btn caro-btn-ghost" style={{ color: "#408A71", marginLeft: 8 }}>Thử lại</button>
                </td></tr>
              </tbody>
            ) : batches.length === 0 ? (
              <tbody>
                <tr><td colSpan={7}>
                  <div className="caro-empty" style={{ padding: "80px 0" }}>
                    <div className="caro-empty-icon" style={{ fontSize: 48, marginBottom: 16 }}>🏅</div>
                    <div className="caro-empty-title" style={{ fontSize: 16, marginBottom: 8 }}>Chưa có lô hàng nào được Mint</div>
                    <div style={{ fontSize: 14, color: "#94a3b8" }}>Các lô hàng sẽ hiển thị tại đây sau khi được phê duyệt và phát hành token thành công.</div>
                  </div>
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
                      style={{ cursor: "pointer", transition: "background 0.2s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "16px", fontWeight: 700, color: "#408A71", fontFamily: "monospace", fontSize: 14, whiteSpace: "nowrap" }}>
                        <div>{b.batch_id}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, fontFamily: "sans-serif", marginTop: 4 }}>🫘 Robusta</div>
                      </td>
                      <td style={{ padding: "16px" }}>
                        <div style={{ fontWeight: 700, color: "#f8fafc", fontSize: 14 }}>{b.farmer_name || "—"}</div>
                        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{b.farmer_email}</div>
                      </td>
                      <td style={{ padding: "16px" }}>
                        <span
                          title={b.farmer_wallet || ""}
                          style={{ fontFamily: "monospace", fontSize: 13, color: b.farmer_wallet ? "#94a3b8" : "#ef4444", cursor: b.farmer_wallet ? "help" : "default" }}
                        >
                          {shortWallet}
                        </span>
                      </td>
                      <td style={{ padding: "16px", fontWeight: 800, color: "#f8fafc", fontSize: 14 }}>
                        {formatKg(b.quantity)}
                      </td>
                      <td style={{ padding: "16px" }}>
                        <span style={{ fontWeight: 900, color: "#B0E4CC", fontSize: 16 }}>
                          {formatNumber(b.minted_amount || b.quantity)}
                        </span>
                        <span className="caro-badge caro-badge-info" style={{ marginLeft: 8, fontSize: 11, padding: "2px 6px" }}>{b.quality_grade || "CR1"}</span>
                      </td>
                      <td style={{ padding: "16px", color: "#94a3b8", whiteSpace: "nowrap", fontSize: 13 }}>
                        {b.minted_at
                          ? new Date(b.minted_at).toLocaleString("vi-VN")
                          : b.approved_at
                          ? new Date(b.approved_at).toLocaleString("vi-VN")
                          : "—"}
                      </td>
                      <td style={{ padding: "16px" }}>
                        {b.tx_hash ? (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${b.tx_hash}`}
                            target="_blank"
                            rel="noreferrer"
                            title={b.tx_hash}
                            style={{ color: "#408A71", textDecoration: "none", fontFamily: "monospace", fontSize: 13, display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}
                          >
                            {shortTx}
                            <span style={{ fontSize: 12, color: "#94a3b8" }}>↗</span>
                          </a>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: 13 }}>—</span>
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
          <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", marginTop: 24 }}>
            <button onClick={() => setPage(1)} disabled={page === 1} className={`caro-btn caro-btn-sm ${page === 1 ? "caro-btn-ghost" : "caro-btn-secondary"}`} style={{ opacity: page === 1 ? 0.5 : 1 }}>«</button>
            <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className={`caro-btn caro-btn-sm ${page === 1 ? "caro-btn-ghost" : "caro-btn-secondary"}`} style={{ opacity: page === 1 ? 0.5 : 1 }}>← Trước</button>
            <span style={{ padding: "0 8px", color: "#94a3b8", fontSize: 14, fontWeight: 600 }}>Trang {page} / {Math.ceil(total / 10)}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={batches.length < 10} className={`caro-btn caro-btn-sm ${batches.length < 10 ? "caro-btn-ghost" : "caro-btn-secondary"}`} style={{ opacity: batches.length < 10 ? 0.5 : 1 }}>Sau →</button>
            <button onClick={() => setPage(Math.ceil(total / 10))} disabled={batches.length < 10} className={`caro-btn caro-btn-sm ${batches.length < 10 ? "caro-btn-ghost" : "caro-btn-secondary"}`} style={{ opacity: batches.length < 10 ? 0.5 : 1 }}>»</button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
