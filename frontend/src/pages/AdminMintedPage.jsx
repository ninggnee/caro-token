import { useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import { useAllBatches } from "../hooks/useBatches";

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
    <DashboardLayout title="Minted">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>🏅 Minted Batches</h2>
          <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
            {total} batch đã được tokenize thành công
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", background: "#0b1113", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)" }}>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Batch ID, farmer..."
              style={{ padding: "8px 12px", background: "none", border: "none", color: "#fff", fontSize: 13, outline: "none", width: 180 }}
            />
            {search && (
              <button onClick={handleClear} style={{ padding: "0 10px", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 14 }}>✕</button>
            )}
            <button onClick={handleSearch} style={{ padding: "8px 12px", background: "#1f6f64", border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>🔍</button>
          </div>
          <button onClick={() => refetch()} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", borderRadius: 8, cursor: "pointer" }}>🔄</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.04)" }}>
              {["Batch ID", "Farmer", "Wallet Address", "Coffee (kg)", "Minted CaRo", "Mint Date", "TX Hash"].map((h) => (
                <th key={h} style={{ padding: "11px 14px", color: "rgba(255,255,255,0.5)", fontWeight: 600, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>

          {isLoading ? (
            <tbody>
              {[1, 2, 3, 4].map((i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                    <td key={j} style={{ padding: "14px" }}>
                      <div style={{ height: 12, background: "rgba(255,255,255,0.07)", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ) : isError ? (
            <tbody>
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 60, color: "#e74c3c" }}>
                Load error — <button onClick={() => refetch()} style={{ background: "none", border: "none", color: "#9fcfc6", cursor: "pointer", textDecoration: "underline" }}>Retry</button>
              </td></tr>
            </tbody>
          ) : batches.length === 0 ? (
            <tbody>
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.3)" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏅</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No minted batches yet</div>
                <div style={{ fontSize: 13 }}>Batches appear here after admin approval and successful blockchain mint.</div>
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
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "14px", fontWeight: 700, color: "#9fcfc6", whiteSpace: "nowrap" }}>
                      <div>{b.batch_id}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>☕ Robusta</div>
                    </td>
                    <td style={{ padding: "14px" }}>
                      <div style={{ fontWeight: 600 }}>{b.farmer_name || "—"}</div>
                      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>{b.farmer_email}</div>
                    </td>
                    <td style={{ padding: "14px" }}>
                      <span
                        title={b.farmer_wallet || ""}
                        style={{ fontFamily: "monospace", fontSize: 12, color: "#9fcfc6", cursor: b.farmer_wallet ? "help" : "default" }}
                      >
                        {shortWallet}
                      </span>
                    </td>
                    <td style={{ padding: "14px", fontWeight: 600 }}>
                      {Number(b.quantity).toLocaleString()} kg
                    </td>
                    <td style={{ padding: "14px" }}>
                      <span style={{ fontWeight: 700, color: "#27ae60", fontSize: 14 }}>
                        {Number(b.minted_amount || b.quantity).toLocaleString()}
                      </span>
                      <span style={{ color: "#9fcfc6", marginLeft: 6, fontSize: 12 }}>{b.quality_grade || "CR1"}</span>
                    </td>
                    <td style={{ padding: "14px", color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>
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
                          style={{ color: "#9fcfc6", textDecoration: "none", fontFamily: "monospace", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                        >
                          {shortTx}
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>↗</span>
                        </a>
                      ) : (
                        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>—</span>
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
          <button onClick={() => setPage(1)} disabled={page === 1} style={{ padding: "6px 12px", background: "#141a1f", border: "1px solid rgba(255,255,255,0.1)", color: page === 1 ? "rgba(255,255,255,0.3)" : "#fff", borderRadius: 6, cursor: page === 1 ? "default" : "pointer" }}>«</button>
          <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} style={{ padding: "6px 14px", background: "#141a1f", border: "1px solid rgba(255,255,255,0.1)", color: page === 1 ? "rgba(255,255,255,0.3)" : "#fff", borderRadius: 6, cursor: page === 1 ? "default" : "pointer" }}>← Prev</button>
          <span style={{ padding: "6px 14px", color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Page {page} / {Math.ceil(total / 10)}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={batches.length < 10} style={{ padding: "6px 14px", background: "#141a1f", border: "1px solid rgba(255,255,255,0.1)", color: batches.length < 10 ? "rgba(255,255,255,0.3)" : "#fff", borderRadius: 6, cursor: batches.length < 10 ? "default" : "pointer" }}>Next →</button>
          <button onClick={() => setPage(Math.ceil(total / 10))} disabled={batches.length < 10} style={{ padding: "6px 12px", background: "#141a1f", border: "1px solid rgba(255,255,255,0.1)", color: batches.length < 10 ? "rgba(255,255,255,0.3)" : "#fff", borderRadius: 6, cursor: batches.length < 10 ? "default" : "pointer" }}>»</button>
        </div>
      )}
    </DashboardLayout>
  );
}
