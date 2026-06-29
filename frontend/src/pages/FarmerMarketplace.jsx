import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import FarmerLayout from "../components/layout/FarmerLayout";
import MarketPageContent from "../components/market/MarketPageContent";
import * as api from "../services/orderApi";
import { formatNumber, formatVND } from "../utils/formatters";

const PAIRS = ["CR1/VND", "CR2/VND", "CR3/VND"];
const C = {
  green: "#0ecb81", red: "#f6465d", gold: "#f0b90b",
  accent: "#487573", muted: "#6b7a99", card: "#172524",
  border: "rgba(72,117,115,0.15)", tealLight: "#7fe0c9",
};

// ── Order Book Side ────────────────────────────────────────────────────────────
function BookSide({ rows, side, maxAmt }) {
  if (!rows.length) return <div style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "10px 0" }}>Trống</div>;
  return (
    <div style={{ display: "grid", gap: 2 }}>
      {rows.slice(0, 8).map((r, i) => {
        const pct = maxAmt > 0 ? (r.amount / maxAmt) * 100 : 0;
        const color = side === "buy" ? C.green : C.red;
        return (
          <div key={i} style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: "3px 6px", borderRadius: 3 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 3, background: color, opacity: 0.07, width: `${pct}%` }} />
            <span style={{ fontSize: 12, fontWeight: 600, color, position: "relative" }}>{formatNumber(r.price, 0)}</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", position: "relative", textAlign: "right" }}>{formatNumber(r.amount)}</span>
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
    <div style={{ background: C.card, borderRadius: 10, padding: 16, border: `1px solid ${C.border}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginBottom: 14, background: "rgba(255,255,255,0.04)", borderRadius: 7, padding: 3 }}>
        {["buy", "sell"].map(s => (
          <button key={s} onClick={() => setSide(s)}
            style={{ padding: "8px 0", borderRadius: 5, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer",
              background: side === s ? (s === "buy" ? C.green : C.red) : "transparent",
              color: side === s ? "#fff" : C.muted }}>
            {s === "buy" ? "Mua" : "Bán"}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Giá (VND/kg)</label>
          <input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="0"
            style={{ width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 6, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Số lượng (kg)</label>
          <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
            style={{ width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 6, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
        {total > 0 && (
          <div style={{ padding: "8px 12px", background: isBuy ? "rgba(14,203,129,0.06)" : "rgba(246,70,93,0.06)", borderRadius: 6, fontSize: 12, color: C.muted }}>
            Tổng: <strong style={{ color: isBuy ? C.green : C.red }}>{formatVND(total)}</strong>
          </div>
        )}
        <button onClick={submit} disabled={isPlacing}
          style={{ padding: "10px 0", background: isPlacing ? "#555" : (isBuy ? C.green : C.red),
            border: "none", borderRadius: 7, color: "#fff", fontWeight: 700, fontSize: 14, cursor: isPlacing ? "not-allowed" : "pointer" }}>
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

  if (isLoading) return <div style={{ color: C.muted, fontSize: 12, padding: 12 }}>Đang tải...</div>;
  if (!orders.length) return <div style={{ color: C.muted, fontSize: 12, padding: "16px 12px", textAlign: "center" }}>Không có lệnh mua nào từ trader</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.03)" }}>
            {["Trader", "Cặp", "Giá", "Còn lại (kg)", "Tổng giá trị", "Trạng thái", "Thời gian", ""].map(h => (
              <th key={h} style={{ padding: "7px 10px", color: C.muted, fontWeight: 600, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: "8px 10px", fontWeight: 600, color: C.tealLight }}>{o.trader_name || o.trader_email}</td>
              <td style={{ padding: "8px 10px", fontWeight: 600 }}>{o.pair}</td>
              <td style={{ padding: "8px 10px", color: C.green, fontWeight: 700 }}>{formatNumber(o.price)}</td>
              <td style={{ padding: "8px 10px" }}>{formatNumber(o.remaining)}</td>
              <td style={{ padding: "8px 10px", color: C.gold }}>{formatVND(Number(o.price) * Number(o.remaining))}</td>
              <td style={{ padding: "8px 10px" }}>
                <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4,
                  background: o.status === "partial" ? "rgba(240,185,11,0.12)" : "rgba(72,117,115,0.12)",
                  color: o.status === "partial" ? C.gold : C.tealLight, fontWeight: 600 }}>
                  {o.status === "partial" ? "Khớp 1 phần" : "Mở"}
                </span>
              </td>
              <td style={{ padding: "8px 10px", color: C.muted }}>{new Date(o.created_at).toLocaleString("vi-VN")}</td>
              <td style={{ padding: "8px 10px" }}>
                <button onClick={() => onSellInto(o)}
                  style={{ padding: "4px 12px", background: "rgba(14,203,129,0.12)", border: "1px solid rgba(14,203,129,0.3)", color: C.green, borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
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

  if (isLoading) return <div style={{ color: C.muted, fontSize: 12, padding: 12 }}>Đang tải...</div>;
  if (!orders.length) return <div style={{ color: C.muted, fontSize: 12, padding: "16px 12px", textAlign: "center" }}>Không có lệnh mở</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.03)" }}>
            {["Cặp", "Loại", "Giá", "SL", "Còn lại", "Trạng thái", ""].map(h => (
              <th key={h} style={{ padding: "7px 10px", color: C.muted, fontWeight: 600, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: "8px 10px", fontWeight: 600 }}>{o.pair}</td>
              <td style={{ padding: "8px 10px", color: o.side === "buy" ? C.green : C.red, fontWeight: 700 }}>
                {o.side === "buy" ? "MUA" : "BÁN"}
              </td>
              <td style={{ padding: "8px 10px" }}>{formatNumber(o.price)}</td>
              <td style={{ padding: "8px 10px" }}>{formatNumber(o.amount)}</td>
              <td style={{ padding: "8px 10px" }}>{formatNumber(o.remaining)}</td>
              <td style={{ padding: "8px 10px" }}>
                <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4,
                  background: o.status === "partial" ? "rgba(240,185,11,0.12)" : "rgba(72,117,115,0.12)",
                  color: o.status === "partial" ? C.gold : C.tealLight, fontWeight: 600 }}>
                  {o.status === "partial" ? "Khớp 1 phần" : "Mở"}
                </span>
              </td>
              <td style={{ padding: "8px 10px" }}>
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>Đặt lệnh limit mua/bán token cà phê Robusta</p>
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

        {/* Left: form + spread */}
        <div>
          <OrderForm pair={pair} onPlace={handlePlace} isPlacing={placeMut.isPending} prefill={prefill} />
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

        {/* Right: order book */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700 }}>
            📖 Sổ Lệnh — {pair}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            <div style={{ padding: "10px 12px", borderRight: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.green, fontWeight: 700, marginBottom: 6 }}>BID (MUA)</div>
              <BookSide rows={bids} side="buy" maxAmt={maxAmt} />
            </div>
            <div style={{ padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginBottom: 6 }}>ASK (BÁN)</div>
              <BookSide rows={asks} side="sell" maxAmt={maxAmt} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom tabs */}
      <div style={{ marginTop: 12, background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
          {[
            { key: "traderOrders", label: "Lệnh Mua Trader" },
            { key: "openOrders",   label: "Lệnh Mở Của Tôi" },
          ].map(t => (
            <button key={t.key} onClick={() => setBottomTab(t.key)}
              style={{ padding: "11px 20px", background: "none", border: "none", cursor: "pointer", fontSize: 13,
                fontWeight: bottomTab === t.key ? 700 : 400,
                color: bottomTab === t.key ? C.tealLight : C.muted,
                borderBottom: bottomTab === t.key ? `2px solid ${C.tealLight}` : "2px solid transparent" }}>
              {t.label}
            </button>
          ))}
        </div>

        {bottomTab === "traderOrders" && (
          <div>
            <div style={{ padding: "8px 14px 4px", fontSize: 12, color: C.muted }}>
              Nhấn <strong style={{ color: C.green }}>Bán vào lệnh này</strong> để điền sẵn form bán.
            </div>
            <TraderBuyOrders pair={pair} onSellInto={handleSellInto} />
          </div>
        )}

        {bottomTab === "openOrders" && (
          <OpenOrders pair={pair} onCancel={id => cancelMut.mutate(id)} isCancelling={cancelMut.isPending} />
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FarmerMarketplace() {
  const [tab, setTab] = useState("overview");

  const tabStyle = (key) => ({
    padding: "11px 24px", background: "none", border: "none", cursor: "pointer", fontSize: 14,
    fontWeight: tab === key ? 700 : 400,
    color: tab === key ? C.tealLight : C.muted,
    borderBottom: tab === key ? `2px solid ${C.tealLight}` : "2px solid transparent",
    transition: "color 0.15s",
  });

  return (
    <FarmerLayout title="Thị trường">

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 18 }}>
        <button style={tabStyle("overview")} onClick={() => setTab("overview")}>🏪 Tổng quan</button>
        <button style={tabStyle("trading")}  onClick={() => setTab("trading")}>📈 Giao dịch</button>
      </div>

      {tab === "overview" && <MarketPageContent />}
      {tab === "trading"  && <TradingTab />}

    </FarmerLayout>
  );
}
