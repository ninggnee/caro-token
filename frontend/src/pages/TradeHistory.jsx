import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import TraderLayout from "../components/layout/TraderLayout";
import axios from "../utils/axiosClient";

const C = {
  accent: "#487573", muted: "#6b7a99", green: "#0ecb81", red: "#f6465d",
  card: "#172524", border: "rgba(72,117,115,0.15)", tealLight: "#7fe0c9",
};

const PAIRS = ["Tất cả", "CR1/VND", "CR2/VND", "CR3/VND"];
const SIDES = ["Tất cả", "buy", "sell"];

function fmt(n, dec = 0) {
  return Number(n || 0).toLocaleString("vi-VN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function Badge({ side }) {
  const isBuy = side === "buy";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: isBuy ? "rgba(14,203,129,0.15)" : "rgba(246,70,93,0.15)", color: isBuy ? C.green : C.red }}>
      {isBuy ? "MUA" : "BÁN"}
    </span>
  );
}

export default function TradeHistory() {
  const [pair,    setPair]    = useState("Tất cả");
  const [side,    setSide]    = useState("Tất cả");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [page,    setPage]    = useState(1);
  const pageSize = 20;

  const qPair = pair !== "Tất cả" ? pair : undefined;
  const qSide = side !== "Tất cả" ? side : undefined;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["trader-trades", qPair, qSide, dateFrom, dateTo, page],
    queryFn:  () => {
      const params = new URLSearchParams();
      if (qPair) params.append("pair", qPair);
      if (qSide) params.append("side", qSide);
      if (dateFrom) params.append("from", dateFrom);
      if (dateTo)   params.append("to",   dateTo);
      params.append("limit",  String(pageSize));
      params.append("offset", String((page - 1) * pageSize));
      return axios.get(`/orders/trades?${params.toString()}`).then(r => r.data);
    },
    staleTime: 20_000,
  });

  const rows  = data?.data || [];
  const total = data?.total ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filterBtnStyle = (active) => ({
    padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
    border: `1px solid ${active ? C.accent : C.border}`, borderRadius: 6,
    background: active ? "rgba(72,117,115,0.18)" : "rgba(255,255,255,0.04)",
    color: active ? C.tealLight : C.muted, transition: "all 0.12s",
  });

  const inputStyle = {
    padding: "7px 10px", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
    borderRadius: 7, color: "#e2e8f0", fontSize: 12, outline: "none",
  };

  const totalBuy  = rows.filter(r => r.side === "buy").reduce((s, r)  => s + Number(r.price || 0) * Number(r.amount || r.quantity || 0), 0);
  const totalSell = rows.filter(r => r.side === "sell").reduce((s, r) => s + Number(r.price || 0) * Number(r.amount || r.quantity || 0), 0);

  return (
    <TraderLayout title="Lịch sử giao dịch">
      <div style={{ display: "grid", gap: 18, maxWidth: 1000 }}>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {[
            { label: "Tổng giao dịch",     value: String(total),         color: "#e2e8f0", icon: "📋" },
            { label: "Tổng mua",           value: fmt(totalBuy) + " ₫",  color: C.green,   icon: "📈" },
            { label: "Tổng bán",           value: fmt(totalSell) + " ₫", color: C.red,     icon: "📉" },
          ].map(c => (
            <div key={c.label} style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 24 }}>{c.icon}</span>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: c.color }}>{c.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 18px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>

            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>Cặp giao dịch</div>
              <div style={{ display: "flex", gap: 6 }}>
                {PAIRS.map(p => (
                  <button key={p} onClick={() => { setPair(p); setPage(1); }} style={filterBtnStyle(pair === p)}>{p}</button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>Loại lệnh</div>
              <div style={{ display: "flex", gap: 6 }}>
                {SIDES.map(s => (
                  <button key={s} onClick={() => { setSide(s); setPage(1); }} style={filterBtnStyle(side === s)}>
                    {s === "buy" ? "Mua" : s === "sell" ? "Bán" : s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>Từ ngày</div>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} style={inputStyle} />
            </div>

            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>Đến ngày</div>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} style={inputStyle} />
            </div>

            {(pair !== "Tất cả" || side !== "Tất cả" || dateFrom || dateTo) && (
              <button onClick={() => { setPair("Tất cả"); setSide("Tất cả"); setDateFrom(""); setDateTo(""); setPage(1); }}
                style={{ marginTop: 18, padding: "6px 12px", fontSize: 11, background: "none", border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", color: C.muted, fontWeight: 600 }}>
                ✕ Xóa bộ lọc
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {isFetching ? "Đang tải..." : `${total} giao dịch`}
            </span>
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.muted }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  style={{ padding: "4px 10px", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 5, cursor: page > 1 ? "pointer" : "not-allowed", color: page > 1 ? "#e2e8f0" : C.muted }}>
                  ‹
                </button>
                <span>{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  style={{ padding: "4px 10px", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 5, cursor: page < totalPages ? "pointer" : "not-allowed", color: page < totalPages ? "#e2e8f0" : C.muted }}>
                  ›
                </button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: C.muted, fontSize: 13 }}>Đang tải dữ liệu...</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: "50px 20px", textAlign: "center", color: C.muted, fontSize: 13 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
              Không có giao dịch nào phù hợp với bộ lọc
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                    {["#", "Cặp GD", "Loại", "Giá (₫)", "Số lượng", "Thành tiền (₫)", "Phí", "Thời gian"].map(h => (
                      <th key={h} style={{ padding: "9px 14px", fontSize: 11, color: C.muted, fontWeight: 600, textAlign: "left", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t, i) => {
                    const qty    = Number(t.amount || t.quantity || 0);
                    const price  = Number(t.price || 0);
                    const total_ = qty * price;
                    const fee    = Number(t.fee || 0);
                    return (
                      <tr key={t.id || i} style={{ borderBottom: `1px solid ${C.border}` }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "10px 14px", fontSize: 11, color: C.muted }}>{(page - 1) * pageSize + i + 1}</td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{t.pair || "—"}</td>
                        <td style={{ padding: "10px 14px" }}><Badge side={t.side} /></td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontFamily: "monospace", color: "#e2e8f0", fontWeight: 600 }}>{fmt(price)}</td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontFamily: "monospace", color: "#e2e8f0" }}>{qty.toFixed(4)}</td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontFamily: "monospace", color: t.side === "buy" ? C.green : C.red, fontWeight: 700 }}>{fmt(total_)}</td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: C.muted }}>{fee ? fmt(fee, 0) + " ₫" : "—"}</td>
                        <td style={{ padding: "10px 14px", fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>
                          {t.created_at ? new Date(t.created_at).toLocaleString("vi-VN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </TraderLayout>
  );
}
