import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useMyBatches } from "../hooks/useBatches";
import { getMyDeposits, getMyWithdraws } from "../services/walletApi";

const C = { accent: "#00d4aa", muted: "#6b7a99", green: "#0ecb81", red: "#f6465d", gold: "#f0b90b" };

const TX_TYPES = ["All", "Mint", "Deposit", "Withdraw"];

const TYPE_META = {
  Mint:    { icon: "🪙", color: C.green,  sign: "+" },
  Deposit: { icon: "⬇️", color: C.accent, sign: "+" },
  Withdraw:{ icon: "⬆️", color: C.red,    sign: "-" },
};

function StatusBadge({ status }) {
  const map = {
    completed: { bg: "rgba(14,203,129,0.1)",  color: C.green, label: "Hoàn thành" },
    approved:  { bg: "rgba(14,203,129,0.1)",  color: C.green, label: "Đã duyệt"   },
    pending:   { bg: "rgba(240,185,11,0.1)",  color: C.gold,  label: "Chờ duyệt"  },
    rejected:  { bg: "rgba(246,70,93,0.1)",   color: C.red,   label: "Từ chối"    },
  };
  const m = map[status] || map.pending;
  return (
    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: m.bg, color: m.color, fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>
      {m.label}
    </span>
  );
}

function TxRow({ type, title, amount, token, date, status, txHash }) {
  const meta = TYPE_META[type] || { icon: "📋", color: C.muted, sign: "" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.1s" }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${meta.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
        {meta.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
          {type}
          {txHash && (
            <> · <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer"
              style={{ color: C.accent, textDecoration: "none" }}>tx: {txHash.slice(0, 10)}…</a></>
          )}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: meta.color }}>
          {meta.sign}{amount} {token || "VND"}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{date}</div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 14, alignItems: "center" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 13, background: "rgba(255,255,255,0.06)", borderRadius: 4, marginBottom: 8, width: "60%" }} />
        <div style={{ height: 11, background: "rgba(255,255,255,0.04)", borderRadius: 4, width: "30%" }} />
      </div>
    </div>
  );
}

export default function FarmerTxHistory() {
  const [filter, setFilter] = useState("All");

  const { data: mintData, isLoading: mintLoading } = useMyBatches({ status: "MINTED", limit: 50 });
  const { data: depData,  isLoading: depLoading  } = useQuery({ queryKey: ["my-deposits"],  queryFn: getMyDeposits  });
  const { data: wdData,   isLoading: wdLoading   } = useQuery({ queryKey: ["my-withdraws"], queryFn: getMyWithdraws });

  const isLoading = mintLoading || depLoading || wdLoading;

  const mintTxs = (mintData?.batches || [])
    .filter(b => b.minted_amount)
    .map(b => ({
      type:   "Mint",
      title:  `Batch Minted — ${b.batch_id}`,
      amount: Number(b.minted_amount).toLocaleString("vi-VN"),
      token:  b.quality_grade,
      date:   new Date(b.minted_at || b.created_at).toLocaleString("vi-VN"),
      status: "completed",
      txHash: b.tx_hash,
      _ts:    new Date(b.minted_at || b.created_at).getTime(),
    }));

  const depTxs = (depData?.data || []).map(d => ({
    type:   "Deposit",
    title:  `Nạp tiền VND`,
    amount: Number(d.amount).toLocaleString("vi-VN"),
    token:  "VND",
    date:   new Date(d.created_at).toLocaleString("vi-VN"),
    status: d.status === "approved" ? "approved" : d.status === "rejected" ? "rejected" : "pending",
    _ts:    new Date(d.created_at).getTime(),
  }));

  const wdTxs = (wdData?.data || []).map(w => ({
    type:   "Withdraw",
    title:  `Rút tiền — ${w.bank_name || ""}`,
    amount: Number(w.amount).toLocaleString("vi-VN"),
    token:  "VND",
    date:   new Date(w.created_at).toLocaleString("vi-VN"),
    status: w.status === "approved" ? "approved" : w.status === "rejected" ? "rejected" : "pending",
    _ts:    new Date(w.created_at).getTime(),
  }));

  const allTxs = [...mintTxs, ...depTxs, ...wdTxs].sort((a, b) => b._ts - a._ts);
  const filtered = filter === "All" ? allTxs : allTxs.filter(t => t.type === filter);

  // Summary counts
  const counts = {
    All:     allTxs.length,
    Mint:    mintTxs.length,
    Deposit: depTxs.length,
    Withdraw:wdTxs.length,
  };

  return (
    <FarmerLayout title="Transaction History">
      <div style={{ maxWidth: 900, display: "grid", gap: 16 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>📊 Lịch Sử Giao Dịch</h2>
          <div style={{ fontSize: 12, color: C.muted }}>{filtered.length} giao dịch</div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 0, background: "#141f2e", borderRadius: 8, padding: 3, border: "1px solid rgba(255,255,255,0.06)", width: "fit-content" }}>
          {TX_TYPES.map(t => {
            const act = filter === t;
            return (
              <button key={t} onClick={() => setFilter(t)}
                style={{ padding: "6px 16px", borderRadius: 6, background: act ? C.accent : "transparent", color: act ? "#000" : C.muted, border: "none", cursor: "pointer", fontSize: 12, fontWeight: act ? 700 : 400, display: "flex", alignItems: "center", gap: 5 }}>
                {t}
                {counts[t] > 0 && (
                  <span style={{ fontSize: 10, background: act ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.1)", borderRadius: 10, padding: "1px 5px" }}>
                    {counts[t]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div style={{ background: "#141f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
            <div style={{ display: "flex", gap: 20 }}>
              {["Giao dịch", "Loại", "Số tiền", "Trạng thái"].map(h => (
                <div key={h} style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</div>
              ))}
            </div>
          </div>

          {isLoading ? (
            [1, 2, 3, 4].map(i => <Skeleton key={i} />)
          ) : filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", color: C.muted }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
              <div style={{ fontSize: 14 }}>Không có giao dịch {filter !== "All" ? `loại ${filter}` : ""}</div>
              {filter === "Mint" && <div style={{ fontSize: 12, marginTop: 6 }}>Gửi batch và được admin duyệt để thấy lịch sử mint</div>}
              {filter === "Deposit" && <div style={{ fontSize: 12, marginTop: 6 }}>Nạp tiền VND để thấy lịch sử nạp</div>}
            </div>
          ) : (
            filtered.map((tx, i) => <TxRow key={i} {...tx} />)
          )}
        </div>

        <div style={{ padding: "10px 16px", background: "rgba(0,212,170,0.04)", border: "1px solid rgba(0,212,170,0.1)", borderRadius: 8, fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
          📋 Hiển thị tất cả Mint (từ batch đã duyệt), Deposit và Withdraw của tài khoản bạn.
          Giao dịch Deposit/Withdraw đang chờ duyệt sẽ được cập nhật khi admin xử lý.
        </div>

      </div>
    </FarmerLayout>
  );
}
