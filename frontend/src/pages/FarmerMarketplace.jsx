import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import FarmerLayout from "../components/layout/FarmerLayout";
import MarketPageContent from "../components/market/MarketPageContent";
import * as api from "../services/orderApi";
import { formatNumber, formatVND } from "../utils/formatters";

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
            <div style={{ position: "absolute", inset: 0, background: bg, width: `${pct}%`, transition: 'width 0.3s' }} />
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
  const [side,   setSide]   = useState("sell");
  const [price,  setPrice]  = useState("");
  const [amount, setAmount] = useState("");
  const prefillRef = useRef(null);

  if (prefill && prefill !== prefillRef.current) {
    prefillRef.current = prefill;
    setSide(prefill.side);
    setPrice(String(prefill.price || ""));
    setAmount(String(prefill.amount || ""));
  }

  const total = (Number(price) || 0) * (Number(amount) || 0);
  const isBuy = side === "buy";

  const submit = () => {
    const p = Number(price), a = Number(amount);
    if (!p || p <= 0) { toast.error("Giá phải > 0"); return; }
    if (!a || a <= 0) { toast.error("Số lượng phải > 0"); return; }
    onPlace({ pair, side, price: p, amount: a }, () => { setPrice(""); setAmount(""); });
  };

  return (
    <div className="caro-card" style={{ padding: 20 }}>
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
          {isPlacing ? "Đang đặt…" : (isBuy ? `Mua ${pair.split("/")[0]}` : `Bán ${pair.split("/")[0]}`)}
        </button>
      </div>
    </div>
  );
}

// ── Trader Buy Orders ──────────────────────────────────────────────────────────
function TraderBuyOrders({ pair, onSellInto }) {
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
            {["Trader", "Cặp", "Giá", "Còn lại (kg)", "Tổng giá trị", "Trạng thái", "Thời gian", ""].map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id}>
              <td style={{ fontWeight: 700, color: "#408A71" }}>{o.trader_name || o.trader_email}</td>
              <td><span className="caro-badge caro-badge-muted">{o.pair}</span></td>
              <td style={{ color: "#B0E4CC", fontWeight: 800, fontFamily: "monospace" }}>{formatNumber(o.price)}</td>
              <td style={{ fontFamily: "monospace" }}>{formatNumber(o.remaining)}</td>
              <td style={{ color: "#f0b90b", fontWeight: 700, fontFamily: "monospace" }}>{formatVND(Number(o.price) * Number(o.remaining))}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Open Orders ────────────────────────────────────────────────────────────────
function OpenOrders({ pair, onCancel, isCancelling }) {
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
            {["Cặp", "Loại", "Giá", "SL", "Còn lại", "Trạng thái", ""].map(h => (
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

// ── Trading Tab ────────────────────────────────────────────────────────────────
function TradingTab() {
  const qc = useQueryClient();
  const [pair, setPair] = useState("CR1/VND");
  const [bottomTab, setBottomTab] = useState("traderOrders");
  const [prefill, setPrefill] = useState(null);

  const { data: bookData } = useQuery({
    queryKey: ["orderbook", pair],
    queryFn: () => api.getOrderbook(pair),
    refetchInterval: 3000,
  });

  const bids = bookData?.data?.bids || [];
  const asks = bookData?.data?.asks || [];
  const maxAmt = Math.max(...[...bids, ...asks].map(r => r.amount), 1);
  const spread = bids[0] && asks[0] ? Math.abs(asks[0].price - bids[0].price) : null;

  const placeMut = useMutation({
    mutationFn: (body) => api.placeOrder(body),
    onSuccess: (data) => {
      toast.success(data.trades > 0 ? `Đặt lệnh thành công! Khớp ${data.trades} giao dịch.` : "Lệnh đã vào sổ, chờ khớp.");
      qc.invalidateQueries({ queryKey: ["open-orders"] });
      qc.invalidateQueries({ queryKey: ["orderbook"] });
      qc.invalidateQueries({ queryKey: ["recent-trades"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Đặt lệnh thất bại"),
  });

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
    setPrefill({ side: "sell", price: Number(order.price), amount: Number(order.remaining) });
    setBottomTab("openOrders");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div style={{ color: "#fff" }}>

      {/* Pair selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <p style={{ margin: 0, color: "#94a3b8", fontSize: 14 }}>Đặt lệnh limit mua/bán token cà phê Robusta</p>
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

        {/* Left: form + spread */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <OrderForm pair={pair} onPlace={handlePlace} isPlacing={placeMut.isPending} prefill={prefill} />
          
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

        {/* Right: order book */}
        <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="caro-section-header">
            <h3 className="caro-section-title">📖 Sổ Lệnh — {pair}</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            <div style={{ padding: "16px", borderRight: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12, color: "#B0E4CC", fontWeight: 800, marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
                <span>KL (Mua)</span>
                <span>Giá Mua</span>
              </div>
              <BookSide rows={bids} side="buy" maxAmt={maxAmt} />
            </div>
            <div style={{ padding: "16px" }}>
              <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 800, marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
                <span>Giá Bán</span>
                <span>KL (Bán)</span>
              </div>
              <BookSide rows={asks} side="sell" maxAmt={maxAmt} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom tabs */}
      <div className="caro-card" style={{ marginTop: 24, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 20px", background: "rgba(255,255,255,0.02)" }}>
          {[
            { key: "traderOrders", label: "Lệnh Mua Trader" },
            { key: "openOrders",   label: "Lệnh Mở Của Tôi" },
          ].map(t => (
            <button key={t.key} onClick={() => setBottomTab(t.key)}
              style={{
                padding: '14px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
                color: bottomTab === t.key ? "#f8fafc" : "#94a3b8",
                fontWeight: bottomTab === t.key ? 700 : 500, fontSize: 14,
                borderBottom: bottomTab === t.key ? '2px solid #B0E4CC' : '2px solid transparent',
                marginBottom: -1, transition: 'color 0.15s',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <div>
          {bottomTab === "traderOrders" && (
            <div>
              <div style={{ padding: "12px 20px 4px", fontSize: 13, color: "#94a3b8" }}>
                Nhấn <strong style={{ color: "#B0E4CC" }}>Bán vào lệnh này</strong> để tự động điền sẵn form bán với số lượng tương ứng.
              </div>
              <TraderBuyOrders pair={pair} onSellInto={handleSellInto} />
            </div>
          )}

          {bottomTab === "openOrders" && (
            <OpenOrders pair={pair} onCancel={id => cancelMut.mutate(id)} isCancelling={cancelMut.isPending} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FarmerMarketplace() {
  const [tab, setTab] = useState("overview");

  return (
    <FarmerLayout title="Thị trường">
      <div className="caro-page">
        {/* Tab bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
          <button className={`caro-btn ${tab === "overview" ? "caro-btn-primary" : "caro-btn-ghost"}`} onClick={() => setTab("overview")}>
            🏪 Tổng quan thị trường
          </button>
          <button className={`caro-btn ${tab === "trading" ? "caro-btn-primary" : "caro-btn-ghost"}`} onClick={() => setTab("trading")}>
            📈 Bàn giao dịch
          </button>
        </div>

        {tab === "overview" && <MarketPageContent />}
        {tab === "trading"  && <TradingTab />}
      </div>
    </FarmerLayout>
  );
}
