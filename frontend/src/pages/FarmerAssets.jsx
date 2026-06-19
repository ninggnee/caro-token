import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useMyBatches } from "../hooks/useBatches";

const C = { green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", accent: "#00d4aa", muted: "#6b7a99" };

const STATUS = {
  PENDING_MINT_APPROVAL: { label: "Pending",  color: C.gold,   bg: "rgba(240,185,11,0.12)"  },
  MINTED:                { label: "Minted",   color: C.green,  bg: "rgba(14,203,129,0.12)"  },
  REJECTED:              { label: "Rejected", color: C.red,    bg: "rgba(246,70,93,0.12)"   },
  APPROVED:              { label: "Approved", color: C.accent, bg: "rgba(0,212,170,0.12)"   },
};

const TABS = [
  { label: "All Batches",     status: null,                    path: "/farmer/status"           },
  { label: "Pending Approval",status: "PENDING_MINT_APPROVAL", path: "/farmer/status/pending"   },
  { label: "Minted Batches",  status: "MINTED",                path: "/farmer/status/minted"    },
  { label: "Rejected",        status: "REJECTED",              path: "/farmer/status/rejected"  },
];

function Badge({ status }) {
  const m = STATUS[status] || { label: status, color: C.muted, bg: "rgba(255,255,255,0.06)" };
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

function SkRow() {
  return (
    <tr>
      {[40, 120, 80, 80, 90, 60].map((w, i) => (
        <td key={i} style={{ padding: "14px 16px" }}>
          <div style={{ height: 12, background: "rgba(255,255,255,0.06)", borderRadius: 4, width: w, animation: "pulse 1.5s infinite" }} />
        </td>
      ))}
    </tr>
  );
}

function pathToStatus(p) {
  if (p.includes("/pending"))  return "PENDING_MINT_APPROVAL";
  if (p.includes("/minted"))   return "MINTED";
  if (p.includes("/rejected")) return "REJECTED";
  return null;
}

export default function FarmerAssets() {
  const nav = useNavigate();
  const loc = useLocation();

  const [activeStatus, setActiveStatus] = useState(() => pathToStatus(loc.pathname));
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setActiveStatus(pathToStatus(loc.pathname));
    setPage(1);
  }, [loc.pathname]);

  const params = { page, limit: 15 };
  if (activeStatus) params.status = activeStatus;

  const { data, isLoading, isError, refetch } = useMyBatches(params);
  const batches = data?.batches || [];
  const total   = data?.total   || 0;
  const pages   = data?.pages   || 1;

  const filtered = search
    ? batches.filter(b => b.batch_id?.toLowerCase().includes(search.toLowerCase()) || b.storage_location?.toLowerCase().includes(search.toLowerCase()))
    : batches;

  const PAGE_TITLE = {
    null:                    "All Batches",
    PENDING_MINT_APPROVAL:   "Pending Approval",
    MINTED:                  "Minted Batches",
    REJECTED:                "Rejected Batches",
  };

  return (
    <FarmerLayout title={PAGE_TITLE[activeStatus] ?? "Batch Status"}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
      <div style={{ display: "grid", gap: 16, maxWidth: 1100 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>📦 {PAGE_TITLE[activeStatus] ?? "Batch Status"}</h2>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{total} batch{total !== 1 ? "es" : ""} total</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => refetch()} style={{ padding: "7px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>↺</button>
            <button onClick={() => nav("/farmer/status/submit")} style={{ padding: "7px 16px", background: "#00d4aa", color: "#000", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>+ Submit Batch</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, background: "#141f2e", borderRadius: 8, padding: 3, width: "fit-content", border: "1px solid rgba(255,255,255,0.06)" }}>
          {TABS.map(t => {
            const act = activeStatus === t.status;
            return (
              <button key={t.label} onClick={() => nav(t.path)}
                style={{ padding: "6px 16px", borderRadius: 6, background: act ? "#00d4aa" : "transparent", color: act ? "#000" : C.muted, border: "none", cursor: "pointer", fontSize: 12, fontWeight: act ? 700 : 400, transition: "all 0.15s" }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by batch ID or location…"
          style={{ padding: "9px 14px", background: "#141f2e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, color: "#e2e8f0", fontSize: 13, outline: "none", width: 320, boxSizing: "border-box" }}
        />

        {/* Table */}
        <div style={{ background: "#141f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Batch ID", "Coffee Type", "Quantity", "Date", "Status", ""].map(h => (
                  <th key={h} style={{ padding: "10px 16px", fontSize: 11, color: C.muted, fontWeight: 600, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && [1, 2, 3, 4, 5].map(i => <SkRow key={i} />)}
              {isError && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: C.red }}>
                  Error loading data. <button onClick={() => refetch()} style={{ color: C.accent, background: "none", border: "none", cursor: "pointer" }}>Retry</button>
                </td></tr>
              )}
              {!isLoading && !isError && filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 60, textAlign: "center", color: C.muted }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
                  <div style={{ fontSize: 14, marginBottom: 12 }}>No batches found</div>
                  <button onClick={() => nav("/farmer/status/submit")} style={{ padding: "8px 20px", background: "#00d4aa", color: "#000", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>Submit First Batch</button>
                </td></tr>
              )}
              {filtered.map(b => (
                <tr key={b.id}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  onClick={() => nav(`/farmer/batch/${b.id}`)}
                >
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, fontFamily: "monospace" }}>{b.batch_id}</div>
                    {b.storage_location && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{b.storage_location}</div>}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "rgba(0,212,170,0.08)", color: C.muted }}>{b.coffee_type || "ROBUSTA"}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#e2e8f0", whiteSpace: "nowrap" }}>
                    {Number(b.quantity).toLocaleString("vi-VN")} <span style={{ color: C.muted, fontSize: 11 }}>kg</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>
                    {new Date(b.created_at).toLocaleDateString("en-GB")}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Badge status={b.status} />
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <span style={{ fontSize: 12, color: C.accent }}>Details →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rejected note */}
        {activeStatus === "REJECTED" && filtered.some(b => b.rejection_reason) && (
          <div style={{ background: "rgba(246,70,93,0.06)", border: "1px solid rgba(246,70,93,0.2)", borderRadius: 8, padding: "14px 16px" }}>
            {filtered.filter(b => b.rejection_reason).map(b => (
              <div key={b.id} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.red }}>{b.batch_id}</div>
                <div style={{ fontSize: 12, color: "#e2e8f0", marginTop: 2 }}>Reason: {b.rejection_reason}</div>
              </div>
            ))}
          </div>
        )}

        {/* Minted details */}
        {activeStatus === "MINTED" && filtered.filter(b => b.minted_amount).length > 0 && (
          <div style={{ display: "grid", gap: 8 }}>
            {filtered.filter(b => b.minted_amount).map(b => (
              <div key={b.id} style={{ background: "rgba(14,203,129,0.05)", border: "1px solid rgba(14,203,129,0.12)", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: 12, color: C.muted, fontFamily: "monospace" }}>{b.batch_id}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{Number(b.minted_amount).toLocaleString()} CaRo minted</div>
                <div style={{ fontSize: 11, color: C.muted }}>{b.minted_at ? new Date(b.minted_at).toLocaleString("en-GB") : "—"}</div>
                {b.tx_hash && (
                  <a href={`https://sepolia.etherscan.io/tx/${b.tx_hash}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: C.accent, overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200, whiteSpace: "nowrap" }}>
                    {b.tx_hash.slice(0, 16)}…
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center" }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              style={{ padding: "6px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: page <= 1 ? C.muted : "#e2e8f0", borderRadius: 5, cursor: page <= 1 ? "default" : "pointer", fontSize: 12 }}>
              ← Prev
            </button>
            <span style={{ fontSize: 12, color: C.muted, padding: "0 8px" }}>Page {page} / {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
              style={{ padding: "6px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: page >= pages ? C.muted : "#e2e8f0", borderRadius: 5, cursor: page >= pages ? "default" : "pointer", fontSize: 12 }}>
              Next →
            </button>
          </div>
        )}

      </div>
    </FarmerLayout>
  );
}
