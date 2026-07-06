import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useMyBatches } from "../hooks/useBatches";
import { getMyDeposits, getMyWithdraws } from "../services/walletApi";
import { formatNumber, formatToken } from '../utils/formatters';

const TX_TYPES = ["All", "Mint", "Deposit", "Withdraw"];
const TX_LABELS = { All: "Tất cả", Mint: "Mint", Deposit: "Nạp tiền", Withdraw: "Rút tiền" };
const TYPE_DISPLAY = { Mint: "Mint Token", Deposit: "Nạp tiền", Withdraw: "Rút tiền" };

const TYPE_META = {
  Mint:    { icon: "🪙", color: "#B0E4CC",  sign: "+" },
  Deposit: { icon: "⬇️", color: "#408A71", sign: "+" },
  Withdraw:{ icon: "⬆️", color: "#ef4444",    sign: "-" },
};

function StatusBadge({ status }) {
  const map = {
    completed: { cls: "caro-badge-success", label: "Hoàn thành" },
    approved:  { cls: "caro-badge-success", label: "Đã duyệt"   },
    pending:   { cls: "caro-badge-warning",  label: "Chờ duyệt"  },
    rejected:  { cls: "caro-badge-danger",   label: "Từ chối"    },
  };
  const m = map[status] || map.pending;
  return (
    <span className={`caro-badge ${m.cls}`}>
      {m.label}
    </span>
  );
}

function TxRow({ type, title, amount, token, date, status, txHash }) {
  const meta = TYPE_META[type] || { icon: "📋", color: "#94a3b8", sign: "" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderBottom: "1px solid var(--border)", transition: "background 0.2s" }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
        {meta.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          {TYPE_DISPLAY[type] || type}
          {txHash && (
            <> · <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer"
              style={{ color: "#408A71", textDecoration: "none", fontWeight: 600 }}>tx: {txHash.slice(0, 10)}…</a></>
          )}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: meta.color, fontFamily: "monospace" }}>
          {meta.sign}{amount} <span style={{ fontSize: 12, fontWeight: 600 }}>{token || "VND"}</span>
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{date}</div>
      </div>
      <div style={{ flexShrink: 0, width: 100, textAlign: "right" }}>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", gap: 16, alignItems: "center" }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.05)", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 14, background: "rgba(255,255,255,0.05)", borderRadius: 4, marginBottom: 8, width: "60%" }} />
        <div style={{ height: 12, background: "rgba(255,255,255,0.03)", borderRadius: 4, width: "30%" }} />
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
      title:  `Đã Mint lô hàng — ${b.batch_id}`,
      amount: formatToken(Number(b.minted_amount)),
      token:  "CaRo",
      date:   new Date(b.minted_at || b.created_at).toLocaleString("vi-VN"),
      status: "completed",
      txHash: b.tx_hash,
      _ts:    new Date(b.minted_at || b.created_at).getTime(),
    }));

  const depTxs = (depData?.data || []).map(d => ({
    type:   "Deposit",
    title:  `Nạp tiền VND`,
    amount: formatNumber(Number(d.amount)),
    token:  "VND",
    date:   new Date(d.created_at).toLocaleString("vi-VN"),
    status: d.status === "approved" ? "approved" : d.status === "rejected" ? "rejected" : "pending",
    _ts:    new Date(d.created_at).getTime(),
  }));

  const wdTxs = (wdData?.data || []).map(w => ({
    type:   "Withdraw",
    title:  w.bank_name ? `Rút tiền VND — ${w.bank_name}` : "Rút token về ví MetaMask",
    amount: w.bank_name ? formatNumber(Number(w.amount)) : formatToken(Number(w.amount)),
    token:  w.bank_name ? "VND" : "CaRo",
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
    <FarmerLayout title="Lịch sử giao dịch">
      <div className="caro-page">

        {/* Header */}
        <div className="caro-page-header">
          <div>
            <h2 className="caro-page-title">📊 Lịch Sử Giao Dịch</h2>
            <p className="caro-page-subtitle">Quản lý giao dịch nạp, rút và đúc token</p>
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, background: "rgba(255,255,255,0.05)", padding: "8px 16px", borderRadius: 20 }}>
            {filtered.length} giao dịch
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {TX_TYPES.map(t => {
            const act = filter === t;
            return (
              <button key={t} onClick={() => setFilter(t)} className={`caro-btn caro-btn-sm ${act ? "caro-btn-primary" : "caro-btn-ghost"}`}>
                {TX_LABELS[t]}
                {counts[t] > 0 && (
                  <span style={{ fontSize: 11, background: act ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)", borderRadius: 12, padding: "2px 6px", marginLeft: 8 }}>
                    {counts[t]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
          {isLoading ? (
            [1, 2, 3, 4].map(i => <Skeleton key={i} />)
          ) : filtered.length === 0 ? (
            <div className="caro-empty">
              <div className="caro-empty-icon">📭</div>
              <div className="caro-empty-title">Không có giao dịch {filter !== "All" ? `loại ${TX_LABELS[filter]}` : ""}</div>
              {filter === "Mint" && <div className="caro-empty-desc">Gửi batch và được admin duyệt để thấy lịch sử mint</div>}
              {filter === "Deposit" && <div className="caro-empty-desc">Nạp tiền VND để thấy lịch sử nạp</div>}
            </div>
          ) : (
            filtered.map((tx, i) => <TxRow key={i} {...tx} />)
          )}
        </div>

        <div style={{ padding: "16px", background: "rgba(176, 228, 204,0.05)", border: "1px solid rgba(176, 228, 204,0.1)", borderRadius: 8, fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginTop: 24 }}>
          <span style={{ color: "#B0E4CC", fontWeight: 700, marginRight: 6 }}>📋 Lưu ý:</span>
          Hiển thị tất cả Mint (từ lô hàng đã duyệt), Nạp tiền và Rút tiền của tài khoản bạn.
          Giao dịch Nạp/Rút đang chờ duyệt sẽ được cập nhật khi admin xử lý.
        </div>

      </div>
    </FarmerLayout>
  );
}
