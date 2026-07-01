import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import TraderLayout from "../components/layout/TraderLayout";
import axios from "../utils/axiosClient";
import { formatNumber, formatVND } from '../utils/formatters';

const PAIRS = ["Tất cả", "CR1/VND", "CR2/VND", "CR3/VND"];
const SIDES = ["Tất cả", "buy", "sell"];

function Badge({ side }) {
  const isBuy = side === "buy";
  return (
    <span className={`caro-badge ${isBuy ? "caro-badge-success" : "caro-badge-danger"}`}>
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

  const totalBuy  = rows.filter(r => r.side === "buy").reduce((s, r)  => s + Number(r.price || 0) * Number(r.amount || r.quantity || 0), 0);
  const totalSell = rows.filter(r => r.side === "sell").reduce((s, r) => s + Number(r.price || 0) * Number(r.amount || r.quantity || 0), 0);

  return (
    <TraderLayout title="Lịch sử giao dịch">
      <div className="caro-page">

        {/* Page header */}
        <div className="caro-page-header">
          <div>
            <h1 className="caro-page-title">📋 Lịch sử giao dịch</h1>
            <p className="caro-page-subtitle">Thống kê toàn bộ các lệnh mua bán đã khớp</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="caro-grid-3">
          <div className="caro-stat-card">
            <div className="caro-stat-icon" style={{ background: "rgba(255,255,255,0.05)", color: "#f8fafc" }}>📋</div>
            <div className="caro-stat-label">Tổng giao dịch</div>
            <div className="caro-stat-value" style={{ color: "#f8fafc" }}>{total}</div>
            <div className="caro-stat-sub">lệnh đã khớp</div>
          </div>
          <div className="caro-stat-card">
            <div className="caro-stat-icon" style={{ background: "rgba(176, 228, 204,0.1)", color: "#B0E4CC" }}>📈</div>
            <div className="caro-stat-label">Tổng mua</div>
            <div className="caro-stat-value" style={{ color: "#B0E4CC" }}>{formatVND(totalBuy)}</div>
            <div className="caro-stat-sub">giá trị token đã mua</div>
          </div>
          <div className="caro-stat-card">
            <div className="caro-stat-icon" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>📉</div>
            <div className="caro-stat-label">Tổng bán</div>
            <div className="caro-stat-value" style={{ color: "#ef4444" }}>{formatVND(totalSell)}</div>
            <div className="caro-stat-sub">giá trị token đã bán</div>
          </div>
        </div>

        {/* Filters */}
        <div className="caro-card" style={{ padding: "16px 24px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>

            <div>
              <div className="caro-label">Cặp giao dịch</div>
              <div style={{ display: "flex", gap: 8 }}>
                {PAIRS.map(p => (
                  <button key={p} onClick={() => { setPair(p); setPage(1); }} className={`caro-btn caro-btn-sm ${pair === p ? "caro-btn-secondary" : "caro-btn-ghost"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="caro-label">Loại lệnh</div>
              <div style={{ display: "flex", gap: 8 }}>
                {SIDES.map(s => (
                  <button key={s} onClick={() => { setSide(s); setPage(1); }} className={`caro-btn caro-btn-sm ${side === s ? "caro-btn-secondary" : "caro-btn-ghost"}`}>
                    {s === "buy" ? "Mua" : s === "sell" ? "Bán" : s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="caro-label">Từ ngày</div>
              <input type="date" className="caro-input" style={{ width: 150 }} value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
            </div>

            <div>
              <div className="caro-label">Đến ngày</div>
              <input type="date" className="caro-input" style={{ width: 150 }} value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
            </div>

            {(pair !== "Tất cả" || side !== "Tất cả" || dateFrom || dateTo) && (
              <div style={{ alignSelf: 'flex-end', paddingBottom: 2 }}>
                <button onClick={() => { setPair("Tất cả"); setSide("Tất cả"); setDateFrom(""); setDateTo(""); setPage(1); }} className="caro-btn caro-btn-sm caro-btn-ghost" style={{ color: "#ef4444" }}>
                  ✕ Xóa bộ lọc
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="caro-section-header">
            <h3 className="caro-section-title">
              {isFetching ? "Đang tải..." : `${total} giao dịch`}
            </h3>
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#94a3b8" }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="caro-btn caro-btn-sm caro-btn-ghost" style={{ padding: "4px 8px" }}>
                  ‹
                </button>
                <span style={{ fontWeight: 600 }}>{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="caro-btn caro-btn-sm caro-btn-ghost" style={{ padding: "4px 8px" }}>
                  ›
                </button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="caro-empty">
              <div className="caro-empty-icon" style={{ animation: "caro-spin 1s linear infinite" }}>⏳</div>
              <div className="caro-empty-title">Đang tải dữ liệu...</div>
            </div>
          ) : rows.length === 0 ? (
            <div className="caro-empty">
              <div className="caro-empty-icon">📋</div>
              <div className="caro-empty-title">Không có giao dịch nào</div>
              <div className="caro-empty-desc">Không tìm thấy giao dịch phù hợp với bộ lọc hiện tại.</div>
            </div>
          ) : (
            <div className="caro-table-wrap">
              <table className="caro-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Cặp GD</th>
                    <th>Loại</th>
                    <th>Giá (VND)</th>
                    <th>Số lượng</th>
                    <th>Thành tiền (VND)</th>
                    <th>Phí</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t, i) => {
                    const qty    = Number(t.amount || t.quantity || 0);
                    const price  = Number(t.price || 0);
                    const total_ = qty * price;
                    const fee    = Number(t.fee || 0);
                    return (
                      <tr key={t.id || i}>
                        <td>{(page - 1) * pageSize + i + 1}</td>
                        <td style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{t.pair || "—"}</td>
                        <td><Badge side={t.side} /></td>
                        <td style={{ fontFamily: "monospace", color: "#f8fafc", fontWeight: 700 }}>{formatNumber(price)}</td>
                        <td style={{ fontFamily: "monospace" }}>{qty.toFixed(4)}</td>
                        <td style={{ fontFamily: "monospace", color: t.side === "buy" ? "#B0E4CC" : "#ef4444", fontWeight: 700 }}>{formatVND(total_)}</td>
                        <td>{fee ? formatVND(fee) : "—"}</td>
                        <td style={{ color: "#94a3b8", whiteSpace: "nowrap" }}>
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
