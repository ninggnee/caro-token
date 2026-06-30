import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import FarmerLayout from "../components/layout/FarmerLayout";
import * as api from "../services/orderApi";
import { formatNumber, formatVND } from '../utils/formatters';
import { getTradingBand } from '../services/marketApi';

const PAIRS = ["CR1/VND", "CR2/VND", "CR3/VND"];
const C = { green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", accent: "#487573", muted: "#6b7a99", card: "#172524", border: "rgba(72, 117, 115, 0.15)", tealLight: "#7fe0c9" };

// ── Order Book Side ────────────────────────────────────────────────────────────
function BookSide({ rows, side, maxAmt }) {
  if (!rows.length) return <div style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "12px 0" }}>Trống</div>;
  return (
    <div style={{ display: "grid", gap: 2 }}>
      {rows.slice(0, 8).map((r, i) => {
        const pct = maxAmt > 0 ? (r.amount / maxAmt) * 100 : 0;
        const color = side === "buy" ? C.green : C.red;
        return (
          <div key={i} style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: "3px 6px", borderRadius: 3 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 3, background: color, opacity: 0.07, width: `${pct}%`, right: side === "buy" ? 0 : "auto", left: side === "sell" ? 0 : "auto" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color, position: "relative" }}>{formatNumber(r.price, 0)}</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", position: "relative", textAlign: "right" }}>{formatNumber(r.amount)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Order Form ─────────────────────────────────────────────────────────────────
function OrderForm({ pair, onPlace, isPlacing, prefill, band }) {
  const [side,      setSide]      = useState(prefill?.side || "buy");
  const [orderType, setOrderType] = useState(prefill?.type || "limit");
  const [price,     setPrice]     = useState(prefill?.price  ? String(prefill.price)  : "");
  const [amount,    setAmount]    = useState(prefill?.amount ? String(prefill.amount) : "");

  const isMarket = orderType === "market";

  // Apply pre-fill when it changes (triggered by "Bán vào lệnh" button)
  const prefillRef = useRef(null);
  if (prefill && prefill !== prefillRef.current) {
    prefillRef.current = prefill;
    setSide(prefill.side);
    setOrderType(prefill.type || "limit");
    setPrice(String(prefill.price || ""));
    setAmount(String(prefill.amount || ""));
  }

  const total = isMarket ? 0 : (Number(price) || 0) * (Number(amount) || 0);

  const submit = () => {
    const a = Number(amount);
    if (!a || a <= 0) { toast.error("Số lượng phải > 0"); return; }
    if (!isMarket) {
      const p = Number(price);
      if (!p || p <= 0) { toast.error("Giá phải > 0"); return; }
      // Rule 3: tick size = 100 VND
      if (p % 100 !== 0) { toast.error("Giá phải là bội số của 100 VND (Tick Size). Ví dụ: 88.000, 88.100, ..."); return; }
      // Rule 2: trading band
      if (band && (p < band.floor || p > band.ceiling)) {
        toast.error(`Giá nằm ngoài biên độ hôm nay [${formatNumber(band.floor)} – ${formatNumber(band.ceiling)} VND/kg]`); return;
      }
      onPlace({ pair, side, type: "limit", price: p, amount: a }, () => { setPrice(""); setAmount(""); });
    } else {
      onPlace({ pair, side, type: "market", amount: a }, () => { setAmount(""); });
    }
  };

  const isBuy = side === "buy";
  return (
    <div style={{ background: C.card, borderRadius: 10, padding: 16, border: `1px solid ${C.border}` }}>
      {/* Side toggle */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginBottom: 10, background: "rgba(255,255,255,0.04)", borderRadius: 7, padding: 3 }}>
        {["buy", "sell"].map(s => (
          <button key={s} onClick={() => setSide(s)}
            style={{ padding: "8px 0", borderRadius: 5, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer",
              background: side === s ? (s === "buy" ? C.green : C.red) : "transparent",
              color: side === s ? "#fff" : C.muted }}>
            {s === "buy" ? "Mua" : "Bán"}
          </button>
        ))}
      </div>

      {/* Order type toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
        {["limit", "market"].map(t => (
          <button key={t} onClick={() => { setOrderType(t); if (t === "market") setPrice(""); }}
            style={{ flex: 1, padding: "5px 0", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 12,
              fontWeight: orderType === t ? 700 : 400,
              background: orderType === t ? (isBuy ? "rgba(14,203,129,0.15)" : "rgba(246,70,93,0.15)") : "rgba(255,255,255,0.04)",
              color: orderType === t ? (isBuy ? C.green : C.red) : C.muted }}>
            {t === "limit" ? "Limit" : "Market"}
          </button>
        ))}
      </div>

      {/* Trading band info (Rule 1 & 2) */}
      {band && (
        <div style={{ marginBottom: 10, padding: "7px 10px", background: "rgba(240,185,11,0.06)", borderRadius: 6, border: "1px solid rgba(240,185,11,0.2)", fontSize: 11 }}>
          <div style={{ color: C.gold, fontWeight: 700, marginBottom: 3 }}>Biên độ hôm nay (±7%)</div>
          <div style={{ display: "flex", justifyContent: "space-between", color: C.muted, gap: 4 }}>
            <span>Tham chiếu: <b style={{ color: "#e2e8f0" }}>{formatNumber(band.ref)}</b></span>
            <span>Sàn: <b style={{ color: C.red }}>{formatNumber(band.floor)}</b></span>
            <span>Trần: <b style={{ color: C.green }}>{formatNumber(band.ceiling)}</b></span>
          </div>
          {!isMarket && <div style={{ marginTop: 2, color: C.muted }}>Bước giá: <b style={{ color: "#e2e8f0" }}>100 VND</b></div>}
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {/* Price input — hidden for market orders */}
        {!isMarket ? (
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Giá (VND/kg)</label>
            <input type="number" min="0" step="100" value={price} onChange={e => setPrice(e.target.value)}
              placeholder="88.000, 88.100, ..."
              style={{ width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 6, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
        ) : (
          <div style={{ padding: "9px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, color: C.muted, textAlign: "center" }}>
            Khớp tự động tại giá tốt nhất trong sổ lệnh
          </div>
        )}

        <div>
          <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Số lượng (kg)</label>
          <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0"
            style={{ width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 6, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>

        {!isMarket && total > 0 && (
          <div style={{ padding: "8px 12px", background: isBuy ? "rgba(14,203,129,0.06)" : "rgba(246,70,93,0.06)", borderRadius: 6, fontSize: 12, color: C.muted }}>
            Tổng giá trị: <strong style={{ color: isBuy ? C.green : C.red }}>{formatVND(total)}</strong>
          </div>
        )}

        <button onClick={submit} disabled={isPlacing}
          style={{ padding: "10px 0", background: isPlacing ? "#555" : (isBuy ? C.green : C.red),
            border: "none", borderRadius: 7, color: "#fff", fontWeight: 700, fontSize: 14,
            cursor: isPlacing ? "not-allowed" : "pointer" }}>
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

  if (isLoading) return <div style={{ color: C.muted, fontSize: 13, padding: 12 }}>Đang tải...</div>;
  if (!orders.length) return <div style={{ color: C.muted, fontSize: 13, padding: "20px 12px", textAlign: "center" }}>Không có lệnh mở</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.03)" }}>
            {["Cặp", "Loại", "Giá", "SL", "Khớp", "Còn lại", "Trạng thái", ""].map(h => (
              <th key={h} style={{ padding: "8px 10px", color: C.muted, fontWeight: 600, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: "9px 10px", fontWeight: 600 }}>{o.pair}</td>
              <td style={{ padding: "9px 10px", color: o.side === "buy" ? C.green : C.red, fontWeight: 700 }}>
                {o.side === "buy" ? "MUA" : "BÁN"}
              </td>
              <td style={{ padding: "9px 10px" }}>{formatNumber(o.price)}</td>
              <td style={{ padding: "9px 10px" }}>{formatNumber(o.amount)}</td>
              <td style={{ padding: "9px 10px", color: C.green }}>{formatNumber(o.filled)}</td>
              <td style={{ padding: "9px 10px" }}>{formatNumber(o.remaining)}</td>
              <td style={{ padding: "9px 10px" }}>
                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4,
                  background: o.status === "partial" ? "rgba(240,185,11,0.12)" : "rgba(72,117,115,0.12)",
                  color: o.status === "partial" ? C.gold : C.tealLight, fontWeight: 600 }}>
                  {o.status === "partial" ? "Khớp một phần" : "Mở"}
                </span>
              </td>
              <td style={{ padding: "9px 10px" }}>
                <button onClick={() => onCancel(o.id)} disabled={isCancelling}
                  style={{ padding: "3px 10px", background: "rgba(246,70,93,0.12)", border: "1px solid rgba(246,70,93,0.25)", color: C.red, borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                  Hủy
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

  if (!trades.length) return <div style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "14px 0" }}>Chưa có giao dịch</div>;

  return (
    <div style={{ display: "grid", gap: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "4px 6px", borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
        {["Giá", "SL (kg)", "Thời gian"].map(h => (
          <span key={h} style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>{h}</span>
        ))}
      </div>
      {trades.map((t, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "3px 6px" }}>
          <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>{formatNumber(t.price)}</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{formatNumber(t.amount)}</span>
          <span style={{ fontSize: 11, color: C.muted }}>{new Date(t.created_at).toLocaleTimeString("vi-VN")}</span>
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

  if (isLoading) return <div style={{ color: C.muted, fontSize: 13, padding: 12 }}>Đang tải...</div>;
  if (!orders.length) return <div style={{ color: C.muted, fontSize: 13, padding: "20px 12px", textAlign: "center" }}>Không có lệnh mua nào từ trader</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.03)" }}>
            {["Trader", "Cặp", "Giá (VND/kg)", "Còn lại (kg)", "Tổng giá trị", "Trạng thái", "Thời gian", ""].map(h => (
              <th key={h} style={{ padding: "8px 10px", color: C.muted, fontWeight: 600, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map(o => {
            const totalVal = Number(o.price) * Number(o.remaining);
            return (
              <tr key={o.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "9px 10px", fontWeight: 600, color: C.tealLight }}>{o.trader_name || o.trader_email}</td>
                <td style={{ padding: "9px 10px", fontWeight: 600 }}>{o.pair}</td>
                <td style={{ padding: "9px 10px", color: C.green, fontWeight: 700 }}>{formatNumber(o.price)}</td>
                <td style={{ padding: "9px 10px" }}>{formatNumber(o.remaining)}</td>
                <td style={{ padding: "9px 10px", color: C.gold }}>{formatVND(totalVal)}</td>
                <td style={{ padding: "9px 10px" }}>
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4,
                    background: o.status === "partial" ? "rgba(240,185,11,0.12)" : "rgba(72,117,115,0.12)",
                    color: o.status === "partial" ? C.gold : C.tealLight, fontWeight: 600 }}>
                    {o.status === "partial" ? "Khớp một phần" : "Mở"}
                  </span>
                </td>
                <td style={{ padding: "9px 10px", color: C.muted }}>{new Date(o.created_at).toLocaleString("vi-VN")}</td>
                <td style={{ padding: "9px 10px" }}>
                  <button onClick={() => onSellInto(o)}
                    style={{ padding: "4px 12px", background: "rgba(14,203,129,0.12)", border: "1px solid rgba(14,203,129,0.3)", color: C.green, borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
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

  const token = pair.split("/")[0]; // CR1, CR2, or CR3

  // Trading band (Rule 1 & 2) — refresh every 30s
  const { data: bandData } = useQuery({
    queryKey: ["trading-band"],
    queryFn: getTradingBand,
    refetchInterval: 30000,
  });
  const band = bandData?.bands?.[token] || null;

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
    placeMut.mutate(body, {
      onSuccess: () => reset?.(),
      onError: (e) => toast.error(e?.response?.data?.message || "Đặt lệnh thất bại"),
    });
  }, [placeMut]);

  const handleSellInto = useCallback((order) => {
    setPair(order.pair);
    setPrefillOrder({ side: "sell", type: "limit", price: Number(order.price), amount: Number(order.remaining) });
    setActiveTab("openOrders");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <FarmerLayout title="Giao dịch">
      <div style={{ width: "100%" }}>

        {/* Header + Pair Selector */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>📈 Sàn Giao Dịch</h2>
            <p style={{ margin: "3px 0 0", color: C.muted, fontSize: 13 }}>Đặt lệnh limit mua/bán token cà phê Robusta</p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {PAIRS.map(p => (
              <button key={p} onClick={() => setPair(p)}
                style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid", cursor: "pointer", fontSize: 13, fontWeight: 700,
                  background: pair === p ? "rgba(72,117,115,0.15)" : "rgba(255,255,255,0.04)",
                  borderColor: pair === p ? C.tealLight : C.border,
                  color: pair === p ? C.tealLight : C.muted }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Main grid */}
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 12 }}>

          {/* Left: Order form */}
          <div>
            <OrderForm pair={pair} onPlace={handlePlace} isPlacing={placeMut.isPending} prefill={prefillOrder} band={band} />

            {/* Spread info */}
            <div style={{ marginTop: 10, padding: "10px 14px", background: C.card, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: C.muted }}>Mua tốt nhất</span>
                  <span style={{ color: C.green, fontWeight: 700 }}>{bids[0] ? formatNumber(bids[0].price) : "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: C.muted }}>Bán tốt nhất</span>
                  <span style={{ color: C.red, fontWeight: 700 }}>{asks[0] ? formatNumber(asks[0].price) : "—"}</span>
                </div>
                {spread !== null && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: C.muted }}>Chênh lệch</span>
                    <span style={{ color: C.gold }}>{formatNumber(spread)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Order book + recent trades */}
          <div style={{ display: "grid", gap: 12 }}>

            {/* Order book */}
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700 }}>
                📖 Sổ Lệnh — {pair}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                <div style={{ padding: "10px 12px", borderRight: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Giá (VND)</span>
                    <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Khối lượng (kg)</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.green, fontWeight: 700, marginBottom: 6 }}>BID (MUA)</div>
                  <BookSide rows={bids} side="buy" maxAmt={maxAmt} />
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Giá (VND)</span>
                    <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Khối lượng (kg)</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginBottom: 6 }}>ASK (BÁN)</div>
                  <BookSide rows={asks} side="sell" maxAmt={maxAmt} />
                </div>
              </div>
            </div>

            {/* Recent trades */}
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700 }}>
                🔄 Giao Dịch Gần Đây
              </div>
              <div style={{ padding: "8px 12px" }}>
                <RecentTrades pair={pair} />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: open orders + tabs */}
        <div style={{ marginTop: 12, background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
            {[
              { key: "openOrders",      label: "Lệnh Mở" },
              { key: "traderBuyOrders", label: "Lệnh Mua Trader" },
              { key: "info",            label: "Hướng dẫn" },
            ].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                style={{ padding: "11px 20px", background: "none", border: "none", cursor: "pointer", fontSize: 13,
                  fontWeight: activeTab === t.key ? 700 : 400,
                  color: activeTab === t.key ? C.tealLight : C.muted,
                  borderBottom: activeTab === t.key ? `2px solid ${C.tealLight}` : "2px solid transparent" }}>
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === "openOrders" && (
            <OpenOrdersTable pair={pair} onCancel={id => cancelMut.mutate(id)} isCancelling={cancelMut.isPending} />
          )}

          {activeTab === "traderBuyOrders" && (
            <div>
              <div style={{ padding: "8px 14px 4px", fontSize: 12, color: C.muted }}>
                Các lệnh mua đang mở từ trader — nhấn <strong style={{ color: C.green }}>Bán vào lệnh này</strong> để điền sẵn form bán với giá và số lượng phù hợp.
              </div>
              <TraderBuyOrdersTable pair={pair} onSellInto={handleSellInto} />
            </div>
          )}

          {activeTab === "info" && (
            <div style={{ padding: 20, fontSize: 13, color: C.muted, lineHeight: 1.8 }}>
              <div style={{ fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>Cách đặt lệnh</div>
              <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
                <li><strong style={{ color: "#e2e8f0" }}>Lệnh Mua:</strong> Bạn cần có VND trong ví nội bộ. Lệnh sẽ khóa VND = Giá × Số lượng.</li>
                <li><strong style={{ color: "#e2e8f0" }}>Lệnh Bán:</strong> Bạn cần có token CR1/CR2/CR3 đã được mint. Lệnh sẽ khóa token.</li>
                <li><strong style={{ color: "#e2e8f0" }}>Khớp lệnh:</strong> Hệ thống tự động khớp theo Price-Time Priority (giá tốt nhất → thời gian sớm nhất).</li>
                <li><strong style={{ color: "#e2e8f0" }}>Hủy lệnh:</strong> Chỉ hủy được lệnh đang mở hoặc khớp một phần. Số tiền/token bị khóa sẽ được hoàn trả.</li>
              </ul>
            </div>
          )}
        </div>

      </div>
    </FarmerLayout>
  );
}
