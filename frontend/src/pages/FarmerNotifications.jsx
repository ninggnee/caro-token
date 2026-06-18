import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useMyBatches } from "../hooks/useBatches";

const C = { accent: "#00d4aa", muted: "#6b7a99", green: "#0ecb81", red: "#f6465d", gold: "#f0b90b" };

function batchToNotifs(batches) {
  return batches.flatMap(b => {
    const out = [];
    if (b.status === "MINTED") {
      out.push({
        type: "mint",
        icon: "🪙",
        color: C.green,
        title: "Batch Minted Successfully",
        body: `${b.batch_id} — ${Number(b.minted_amount || b.quantity).toLocaleString()} ${b.quality_grade} tokens credited to your wallet`,
        date: b.minted_at || b.updated_at || b.created_at,
        link: `/farmer/batch/${b.id}`,
      });
    }
    if (b.status === "REJECTED") {
      out.push({
        type: "reject",
        icon: "❌",
        color: C.red,
        title: "Batch Rejected",
        body: `${b.batch_id} was rejected${b.rejection_reason ? ": " + b.rejection_reason : ""}`,
        date: b.rejected_at || b.updated_at || b.created_at,
        link: `/farmer/batch/${b.id}`,
      });
    }
    if (b.status === "APPROVED") {
      out.push({
        type: "approve",
        icon: "✅",
        color: C.accent,
        title: "Batch Approved",
        body: `${b.batch_id} has been approved and is being minted`,
        date: b.approved_at || b.updated_at || b.created_at,
        link: `/farmer/batch/${b.id}`,
      });
    }
    if (b.status === "PENDING_MINT_APPROVAL") {
      out.push({
        type: "pending",
        icon: "⏳",
        color: C.gold,
        title: "Batch Under Review",
        body: `${b.batch_id} — ${Number(b.quantity).toLocaleString()} kg submitted, waiting for admin approval`,
        date: b.created_at,
        link: `/farmer/batch/${b.id}`,
      });
    }
    return out;
  });
}

const TYPES = ["All", "Minted", "Rejected", "Pending"];

export default function FarmerNotifications() {
  const nav = useNavigate();
  const [filter, setFilter] = useState("All");
  const [readAll, setReadAll] = useState(false);

  const { data: allData } = useMyBatches({ limit: 50 });
  const batches = allData?.batches || [];
  const notifs = batchToNotifs(batches).sort((a, b) => new Date(b.date) - new Date(a.date));

  const filtered = notifs.filter(n => {
    if (filter === "All")     return true;
    if (filter === "Minted")  return n.type === "mint";
    if (filter === "Rejected")return n.type === "reject";
    if (filter === "Pending") return n.type === "pending";
    return true;
  });

  return (
    <FarmerLayout title="Notifications">
      <div style={{ maxWidth: 760, display: "grid", gap: 16 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🔔 Notifications</h2>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{filtered.length} notification{filtered.length !== 1 ? "s" : ""}</div>
          </div>
          {!readAll && filtered.length > 0 && (
            <button onClick={() => setReadAll(true)} style={{ padding: "7px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
              Mark all read
            </button>
          )}
        </div>

        {/* Filter */}
        <div style={{ display: "flex", gap: 0, background: "#141f2e", borderRadius: 8, padding: 3, border: "1px solid rgba(255,255,255,0.06)", width: "fit-content" }}>
          {TYPES.map(t => {
            const act = filter === t;
            return (
              <button key={t} onClick={() => setFilter(t)}
                style={{ padding: "6px 16px", borderRadius: 6, background: act ? C.accent : "transparent", color: act ? "#000" : C.muted, border: "none", cursor: "pointer", fontSize: 12, fontWeight: act ? 700 : 400 }}>
                {t}
              </button>
            );
          })}
        </div>

        {/* List */}
        <div style={{ background: "#141f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", color: C.muted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔕</div>
              <div style={{ fontSize: 14 }}>No notifications</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Submit a batch to get started</div>
            </div>
          ) : (
            filtered.map((n, i) => (
              <div key={i}
                onClick={() => nav(n.link)}
                style={{ display: "flex", gap: 14, padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", transition: "background 0.1s", background: (!readAll && i === 0) ? "rgba(0,212,170,0.03)" : "transparent" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                onMouseLeave={e => e.currentTarget.style.background = (!readAll && i === 0) ? "rgba(0,212,170,0.03)" : "transparent"}
              >
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: `${n.color}15`, border: `1px solid ${n.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, marginTop: 2 }}>
                  {n.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{n.title}</div>
                    {!readAll && i === 0 && <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.accent, flexShrink: 0, marginTop: 5 }} />}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{n.body}</div>
                  <div style={{ fontSize: 11, color: "#6b7a99", marginTop: 6 }}>
                    {n.date ? new Date(n.date).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info */}
        <div style={{ fontSize: 12, color: C.muted, padding: "0 4px", lineHeight: 1.7 }}>
          Notifications are generated from your batch activity. Real-time push notifications coming soon.
        </div>

      </div>
    </FarmerLayout>
  );
}
