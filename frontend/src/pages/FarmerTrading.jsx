import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import FarmerLayout from "../components/layout/FarmerLayout";
import * as api from "../services/orderApi";
import { formatNumber, formatVND } from '../utils/formatters';

const PAIRS = ["CR1/VND", "CR2/VND", "CR3/VND"];

// ── Order Book Side ────────────────────────────────────────────────────────────
function BookSide({ rows, side, maxAmt }) {
  if (!rows.length) return <div className="caro-empty" style={{ padding: "10px 0" }}>Trống</div>;
  return (
    <div style={{ display: "grid", gap: 2 }}>
      {rows.slice(0, 8).map((r, i) => {
        const pct = maxAmt > 0 ? (r.amount / maxAmt) * 100 : 0;
        const isBuy = side === "buy";
        const color = isBuy ? "#B0E4CC" : "#ef4444";
        const bg = isBuy ? "rgba(176, 228, 204,0.15)" : "rgba(239,68,68,0.15)";
        
        return (
          <div key={i} style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: "4px 8px", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: bg, width: `${pct}%`, transition: 'width 0.3s', right: isBuy ? 0 : "auto", left: !isBuy ? 0 : "auto" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color, position: "relative", fontFamily: "monospace" }}>{formatNumber(r.price, 0)}</span>
            <span style={{ fontSize: 13, color: "#94a3b8", position: "relative", textAlign: "right", fontFamily: "monospace" }}>{formatNumber(r.amount)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Order Form ─────────────────────────────────────────────────────────────────
function OrderForm({ pair, onPlace, isPlacing, prefill }) {
  const [side,   setSide]   = useState(prefill?.side   || "buy");
  const [price,  setPrice]  = useState(prefill?.price  ? String(prefill.price)  : "");
  const [amount, setAmount] = useState(prefill?.amount ? String(prefill.amount) : "");

  // Apply pre-fill when it changes (triggered by "Bán vào lệnh" button)
  const prefillRef = useRef(null);
  if (prefill && prefill !== prefillRef.current) {
    prefillRef.current = prefill;
    setSide(prefill.side);
    setPrice(String(prefill.price || ""));
    setAmount(String(prefill.amount || ""));
  }

  const total = (Number(price) || 0) * (Number(amount) || 0);

  const submit = () => {
    const p = Number(price), a = Number(amount);
    if (!p || p <= 0) { toast.error("Giá phải > 0"); return; }
    if (!a || a <= 0) { toast.error("Số lượng phải > 0"); return; }
    onPlace({ pair, side, price: p, amount: a }, () => { setPrice(""); setAmount(""); });
  };

  const isBuy = side === "buy";
  return (
    <div className="caro-card" style={{ padding: 20 }}>
      {/* Side toggle */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginBottom: 20, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 4 }}>
        {["buy", "sell"].map(s => (
          <button key={s} onClick={() => setSide(s)}
            style={{ 
              padding: "10px 0", borderRadius: 6, border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "all 0.2s",
              background: side === s ? (s === "buy" ? "#B0E4CC" : "#ef4444") : "transparent",
              color: side === s ? "#fff" : "#94a3b8",
              boxShadow: side === s ? "0 2px 8px rgba(0,0,0,0.2)" : "none"
            }}>
            {s === "buy" ? "Mua" : "Bán"}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <div className="caro-field">
          <label className="caro-label">Giá (VND/kg)</label>
          <input type="number" min="0" className="caro-input" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" />
        </div>
        <div className="caro-field">
          <label className="caro-label">Số lượng (kg)</label>
          <input type="number" min="0" className="caro-input" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
        </div>

        {total > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: "12px 16px", background: isBuy ? "rgba(176, 228, 204,0.08)" : "rgba(239,68,68,0.08)", borderRadius: 8, fontSize: 13, color: "#94a3b8", border: `1px solid ${isBuy ? "rgba(176, 228, 204,0.2)" : "rgba(239,68,68,0.2)"}` }}>
            <span>Tổng giá trị:</span>
            <strong style={{ color: isBuy ? "#B0E4CC" : "#ef4444", fontSize: 15, fontFamily: "monospace" }}>{formatVND(total)}</strong>
          </div>
        )}

        <button onClick={submit} disabled={isPlacing}
          className={`caro-btn ${isBuy ? 'caro-btn-success' : 'caro-btn-danger'}`}
          style={{ padding: "12px 0", fontSize: 15, width: "100%" }}>
          {isPlacing ? "Đang đặt lệnh..." : (isBuy ? `Mua ${pair.split("/")[0]}` : `Bán ${pair.split("/")[0]}`)}
        </button>
      </div>
    </div>
  );
}

// ── Open Orders Table ──────────────────────────────────────────────────────────
function OpenOrdersTable({ pair, onCancel, isCancelling }) {
  const { data, isLoading } = useQuery({
    queryKey: ["open-orders", pair],
    queryFn: () => api.getOpenOrders(pair),
    refetchInterval: 5000,
  });
  const orders = data?.data || [];

  if (isLoading) return <div className="caro-empty">Đang tải...</div>;
  if (!orders.length) return <div className="caro-empty">Không có lệnh mở</div>;

  return (
    <div className="caro-table-wrap">
      <table className="caro-table">
        <thead>
          <tr>
            {["Cặp", "Loại", "Giá", "SL", "Khớp", "Còn lại", "Trạng thái", ""].map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id}>
              <td><span className="caro-badge caro-badge-muted">{o.pair}</span></td>
              <td style={{ color: o.side === "buy" ? "#B0E4CC" : "#ef4444", fontWeight: 800 }}>
                {o.side === "buy" ? "MUA" : "BÁN"}
              </td>
              <td style={{ fontFamily: "monospace", fontWeight: 700, color: "#f8fafc" }}>{formatNumber(o.price)}</td>
              <td style={{ fontFamily: "monospace" }}>{formatNumber(o.amount)}</td>
              <td style={{ fontFamily: "monospace", color: "#B0E4CC" }}>{formatNumber(o.filled)}</td>
              <td style={{ fontFamily: "monospace" }}>{formatNumber(o.remaining)}</td>
              <td>
                <span className={`caro-badge ${o.status === "partial" ? "caro-badge-warning" : "caro-badge-info"}`}>
                  {o.status === "partial" ? "Khớp 1 phần" : "Mở"}
                </span>
              </td>
              <td style={{ textAlign: "right" }}>
                <button onClick={() => onCancel(o.id)} disabled={isCancelling} className="caro-btn caro-btn-sm caro-btn-danger" style={{ padding: "4px 12px" }}>
                  Hủy lệnh
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Recent Trades ─────────────────────────────────────────────────────────────
function RecentTrades({ pair }) {
  const { data } = useQuery({
    queryKey: ["recent-trades", pair],
    queryFn: () => api.getRecentTrades(pair),
    refetchInterval: 5000,
  });
  const trades = (data?.data || []).filter(t => t.pair === pair).slice(0, 12);

  if (!trades.length) return <div className="caro-empty">Chưa có giao dịch</div>;

  return (
    <div style={{ display: "grid", gap: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "8px 12px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
        {["Giá", "SL (kg)", "Thời gian"].map(h => (
          <span key={h} style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{h}</span>
        ))}
      </div>
      {trades.map((t, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "6px 12px", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#B0E4CC", fontWeight: 700, fontFamily: "monospace" }}>{formatNumber(t.price)}</span>
          <span style={{ fontSize: 13, color: "#cbd5e1", fontFamily: "monospace" }}>{formatNumber(t.amount)}</span>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>{new Date(t.created_at).toLocaleTimeString("vi-VN")}</span>
        </div>
      ))}
    </div>
  );
}

// ── Trader Buy Orders Table ───────────────────────────────────────────────────
function TraderBuyOrdersTable({ pair, onSellInto }) {
  const { data, isLoading } = useQuery({
    queryKey: ["trader-buy-orders", pair],
    queryFn: () => api.getAllBuyOrders(pair),
    refetchInterval: 5000,
  });
  const orders = data?.data || [];

  if (isLoading) return <div className="caro-empty">Đang tải...</div>;
  if (!orders.length) return <div className="caro-empty">Không có lệnh mua nào từ trader</div>;

  return (
    <div className="caro-table-wrap">
      <table className="caro-table">
        <thead>
          <tr>
            {["Trader", "Cặp", "Giá (VND/kg)", "Còn lại (kg)", "Tổng giá trị", "Trạng thái", "Thời gian", ""].map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map(o => {
            const totalVal = Number(o.price) * Number(o.remaining);
            return (
              <tr key={o.id}>
                <td style={{ fontWeight: 700, color: "#408A71" }}>{o.trader_name || o.trader_email}</td>
                <td><span className="caro-badge caro-badge-muted">{o.pair}</span></td>
                <td style={{ color: "#B0E4CC", fontWeight: 800, fontFamily: "monospace" }}>{formatNumber(o.price)}</td>
                <td style={{ fontFamily: "monospace" }}>{formatNumber(o.remaining)}</td>
                <td style={{ color: "#f0b90b", fontWeight: 700, fontFamily: "monospace" }}>{formatVND(totalVal)}</td>
                <td>
                  <span className={`caro-badge ${o.status === "partial" ? "caro-badge-warning" : "caro-badge-info"}`}>
                    {o.status === "partial" ? "Khớp 1 phần" : "Mở"}
                  </span>
                </td>
                <td style={{ color: "#94a3b8" }}>{new Date(o.created_at).toLocaleString("vi-VN")}</td>
                <td style={{ textAlign: "right" }}>
                  <button onClick={() => onSellInto(o)} className="caro-btn caro-btn-sm caro-btn-success" style={{ padding: "4px 12px" }}>
                    Bán vào lệnh này
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function FarmerTrading() {
  const qc = useQueryClient();
  const [pair, setPair] = useState("CR1/VND");
  const [activeTab, setActiveTab] = useState("openOrders");
  const [prefillOrder, setPrefillOrder] = useState(null);

  // Order book (auto-refresh every 3s)
  const { data: bookData } = useQuery({
    queryKey: ["orderbook", pair],
    queryFn: () => api.getOrderbook(pair),
    refetchInterval: 3000,
  });

  const bids = bookData?.data?.bids || [];
  const asks = bookData?.data?.asks || [];
  const maxAmt = Math.max(...[...bids, ...asks].map(r => r.amount), 1);

  const spread = bids[0] && asks[0] ? Math.abs(asks[0].price - bids[0].price) : null;

  // Place order
  const placeMut = useMutation({
    mutationFn: (body) => api.placeOrder(body),
    onSuccess: (data) => {
      const msg = data.trades > 0
        ? `Đặt lệnh thành công! Khớp ${data.trades} giao dịch.`
        : "Lệnh đã vào sổ, chờ khớp.";
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["open-orders"] });
      qc.invalidateQueries({ queryKey: ["orderbook"] });
      qc.invalidateQueries({ queryKey: ["recent-trades"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Đặt lệnh thất bại"),
  });

  // Cancel order
  const cancelMut = useMutation({
    mutationFn: (id) => api.cancelOrder(id),
    onSuccess: () => {
      toast.info("Đã hủy lệnh");
      qc.invalidateQueries({ queryKey: ["open-orders"] });
      qc.invalidateQueries({ queryKey: ["orderbook"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Hủy lệnh thất bại"),
  });

  const handlePlace = useCallback((body, reset) => {
    placeMut.mutate(body, { onSuccess: () => reset?.() });
  }, [placeMut]);

  const handleSellInto = useCallback((order) => {
    setPair(order.pair);
    setPrefillOrder({ side: "sell", price: Number(order.price), amount: Number(order.remaining) });
    setActiveTab("openOrders");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <FarmerLayout title="Giao dịch">
      <div className="caro-page">

        {/* Header + Pair Selector */}
        <div className="caro-page-header" style={{ marginBottom: 24 }}>
          <div>
            <h2 className="caro-page-title">📈 Sàn Giao Dịch</h2>
            <p className="caro-page-subtitle">Đặt lệnh limit mua/bán token cà phê Robusta</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {PAIRS.map(p => (
              <button key={p} onClick={() => setPair(p)} className={`caro-btn caro-btn-sm ${pair === p ? "caro-btn-secondary" : "caro-btn-ghost"}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Main grid */}
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, alignItems: 'start' }}>

          {/* Left: Order form */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <OrderForm pair={pair} onPlace={handlePlace} isPlacing={placeMut.isPending} prefill={prefillOrder} />

            {/* Spread info */}
            <div className="caro-card" style={{ padding: "16px 20px" }}>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#94a3b8", fontWeight: 600 }}>Mua tốt nhất</span>
                  <span style={{ color: "#B0E4CC", fontWeight: 800, fontFamily: "monospace" }}>{bids[0] ? formatNumber(bids[0].price) : "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#94a3b8", fontWeight: 600 }}>Bán tốt nhất</span>
                  <span style={{ color: "#ef4444", fontWeight: 800, fontFamily: "monospace" }}>{asks[0] ? formatNumber(asks[0].price) : "—"}</span>
                </div>
                {spread !== null && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 4 }}>
                    <span style={{ color: "#94a3b8", fontWeight: 600 }}>Chênh lệch</span>
                    <span style={{ color: "#f0b90b", fontWeight: 800, fontFamily: "monospace" }}>{formatNumber(spread)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Order book + recent trades */}
          <div style={{ display: "grid", gap: 24 }}>

            {/* Order book */}
            <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="caro-section-header">
                <h3 className="caro-section-title">📖 Sổ Lệnh — {pair}</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                <div style={{ padding: "16px", borderRight: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Giá (VND)</span>
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Khối lượng</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#B0E4CC", fontWeight: 800, marginBottom: 12 }}>BID (MUA)</div>
                  <BookSide rows={bids} side="buy" maxAmt={maxAmt} />
                </div>
                <div style={{ padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Giá (VND)</span>
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Khối lượng</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 800, marginBottom: 12 }}>ASK (BÁN)</div>
                  <BookSide rows={asks} side="sell" maxAmt={maxAmt} />
                </div>
              </div>
            </div>

            {/* Recent trades */}
            <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="caro-section-header">
                <h3 className="caro-section-title">🔄 Giao Dịch Gần Đây</h3>
              </div>
              <div>
                <RecentTrades pair={pair} />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: open orders + tabs */}
        <div className="caro-card" style={{ marginTop: 24, padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 20px", background: "rgba(255,255,255,0.02)" }}>
            {[
              { key: "openOrders",      label: "Lệnh Mở" },
              { key: "traderBuyOrders", label: "Lệnh Mua Trader" },
              { key: "info",            label: "Hướng dẫn" },
            ].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                style={{
                  padding: '14px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
                  color: activeTab === t.key ? "#f8fafc" : "#94a3b8",
                  fontWeight: activeTab === t.key ? 700 : 500, fontSize: 14,
                  borderBottom: activeTab === t.key ? '2px solid #B0E4CC' : '2px solid transparent',
                  marginBottom: -1, transition: 'color 0.15s',
                }}>
                {t.label}
              </button>
            ))}
          </div>

          <div>
            {activeTab === "openOrders" && (
              <OpenOrdersTable pair={pair} onCancel={id => cancelMut.mutate(id)} isCancelling={cancelMut.isPending} />
            )}

            {activeTab === "traderBuyOrders" && (
              <div>
                <div style={{ padding: "12px 20px 4px", fontSize: 13, color: "#94a3b8" }}>
                  Các lệnh mua đang mở từ trader — nhấn <strong style={{ color: "#B0E4CC" }}>Bán vào lệnh này</strong> để điền sẵn form bán với giá và số lượng phù hợp.
                </div>
                <TraderBuyOrdersTable pair={pair} onSellInto={handleSellInto} />
              </div>
            )}

            {activeTab === "info" && (
              <div style={{ padding: 24, fontSize: 14, color: "#cbd5e1", lineHeight: 1.8 }}>
                <div style={{ fontWeight: 800, color: "#f8fafc", marginBottom: 12 }}>Cách đặt lệnh</div>
                <ul style={{ margin: 0, paddingLeft: 24, display: "grid", gap: 10 }}>
                  <li><strong style={{ color: "#f8fafc" }}>Lệnh Mua:</strong> Bạn cần có VND trong ví nội bộ. Lệnh sẽ khóa VND = Giá × Số lượng.</li>
                  <li><strong style={{ color: "#f8fafc" }}>Lệnh Bán:</strong> Bạn cần có token CR1/CR2/CR3 đã được mint. Lệnh sẽ khóa token.</li>
                  <li><strong style={{ color: "#f8fafc" }}>Khớp lệnh:</strong> Hệ thống tự động khớp theo Price-Time Priority (giá tốt nhất → thời gian sớm nhất).</li>
                  <li><strong style={{ color: "#f8fafc" }}>Hủy lệnh:</strong> Chỉ hủy được lệnh đang mở hoặc khớp một phần. Số tiền/token bị khóa sẽ được hoàn trả.</li>
                </ul>
              </div>
            )}
          </div>
        </div>

      </div>
    </FarmerLayout>
  );
}
