import { useState, useEffect, useCallback } from "react";
import TraderLayout from "../components/layout/TraderLayout";
import MarketPageContent from "../components/market/MarketPageContent";
import { API_URL } from "../config/api";
import { formatNumber, formatVND } from "../utils/formatters";

const PAIRS = ["CR1/VND", "CR2/VND", "CR3/VND"];

const C = {
  card:   "#0f1e20",
  border: "rgba(255,255,255,0.08)",
  green:  "#0ecb81",
  red:    "#f6465d",
  text:   "#eaecef",
  muted:  "#848e9c",
  dim:    "#1e2d2f",
  input:  "#162020",
  gold:   "#f0b90b",
  teal:   "#00d4aa",
};

function authHeader() {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeader(), ...(opts.headers || {}) },
  });
  return res.json();
}

// ── Stepper input ─────────────────────────────────────────────────────────────
function Stepper({ label, value, onChange, step = 1, disabled = false }) {
  const adj = (delta) => {
    const nxt = Math.max(0, (parseFloat(value) || 0) + delta * step);
    onChange(nxt % 1 === 0 ? String(nxt) : nxt.toFixed(2));
  };
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
        <button onClick={() => adj(-1)} disabled={disabled}
          style={{ width: 32, height: 36, background: C.dim, border: "none", color: "#bbb", cursor: disabled ? "default" : "pointer", fontSize: 18, flexShrink: 0 }}>−</button>
        <input type="number" value={value} onChange={e => !disabled && onChange(e.target.value)}
          readOnly={disabled} placeholder="0"
          style={{ flex: 1, height: 36, padding: "0 6px", background: C.input, border: "none", color: disabled ? C.muted : C.text, textAlign: "center", fontSize: 13, outline: "none" }} />
        <button onClick={() => adj(1)} disabled={disabled}
          style={{ width: 32, height: 36, background: C.dim, border: "none", color: "#bbb", cursor: disabled ? "default" : "pointer", fontSize: 18, flexShrink: 0 }}>+</button>
      </div>
    </div>
  );
}

// ── Order placement panel ─────────────────────────────────────────────────────
function OrderPanel({ pair }) {
  const [buyPrice,   setBuyPrice]   = useState("");
  const [buyAmount,  setBuyAmount]  = useState("");
  const [sellPrice,  setSellPrice]  = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [placing,    setPlacing]    = useState(null);
  const [msg,        setMsg]        = useState(null);
  const [vndWallet,  setVndWallet]  = useState({});
  const [tokenBals,  setTokenBals]  = useState({});

  const token     = pair.split("/")[0];
  const vndAvail  = Number(vndWallet.vnd_available || 0);
  const tokAvail  = Number(tokenBals[token]?.available || 0);
  const buyPriceN  = parseFloat(buyPrice)  || 0;
  const buyAmtN    = parseFloat(buyAmount) || 0;
  const sellPriceN = parseFloat(sellPrice) || 0;
  const sellAmtN   = parseFloat(sellAmount) || 0;
  const maxBuyQty  = buyPriceN > 0 ? vndAvail / buyPriceN : 0;

  const loadBalances = useCallback(async () => {
    const [w, b] = await Promise.all([
      apiFetch("/wallet/balance"),
      apiFetch("/orders/my-balances"),
    ]);
    if (w.success !== false) setVndWallet(w);
    if (b.success) setTokenBals(b.data || {});
  }, []);

  useEffect(() => {
    loadBalances();
    const iv = setInterval(loadBalances, 8000);
    return () => clearInterval(iv);
  }, [loadBalances]);

  const placeOrder = async (side) => {
    const p = side === "buy" ? buyPrice  : sellPrice;
    const a = side === "buy" ? buyAmount : sellAmount;
    if (!p || !a || Number(p) <= 0 || Number(a) <= 0) {
      return setMsg({ ok: false, text: "Vui lòng nhập Giá và Số lượng hợp lệ" });
    }
    setPlacing(side); setMsg(null);
    try {
      const d = await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify({ pair, side, price: Number(p), amount: Number(a) }),
      });
      if (d.success) {
        setMsg({ ok: true, text: `Đặt lệnh thành công · ${d.status} · Khớp: ${d.trades} lệnh` });
        if (side === "buy") { setBuyAmount(""); setBuyPrice(""); }
        else                { setSellAmount(""); setSellPrice(""); }
        loadBalances();
      } else {
        setMsg({ ok: false, text: d.message || "Lỗi đặt lệnh" });
      }
    } catch { setMsg({ ok: false, text: "Lỗi kết nối server" }); }
    setPlacing(null);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

      {/* BUY */}
      <div>
        <div style={{ marginBottom: 10, padding: "8px 10px", background: "rgba(14,203,129,0.05)", borderRadius: 6, border: "1px solid rgba(14,203,129,0.15)" }}>
          <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>Sức mua tối đa</div>
          <div style={{ fontWeight: 700, color: C.green, fontFamily: "monospace" }}>{formatNumber(maxBuyQty)} {token}</div>
          <div style={{ fontSize: 10, color: C.muted }}>{formatVND(vndAvail)} khả dụng</div>
        </div>
        <Stepper label="Giá (VNĐ)" value={buyPrice} onChange={setBuyPrice} />
        <Stepper label="Số lượng (token)" value={buyAmount} onChange={setBuyAmount} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderTop: `1px solid ${C.border}`, marginBottom: 10 }}>
          <span style={{ color: C.muted }}>Giá trị lệnh</span>
          <span style={{ color: C.text, fontWeight: 700, fontFamily: "monospace" }}>{formatVND(buyPriceN * buyAmtN)}</span>
        </div>
        <button onClick={() => placeOrder("buy")} disabled={placing === "buy"}
          style={{ width: "100%", padding: "11px 0", borderRadius: 6, border: "none",
            background: placing === "buy" ? "#1a5c3c" : C.green,
            color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", letterSpacing: "1px" }}>
          {placing === "buy" ? "Đang đặt…" : "MUA"}
        </button>
      </div>

      {/* SELL */}
      <div>
        <div style={{ marginBottom: 10, padding: "8px 10px", background: "rgba(246,70,93,0.05)", borderRadius: 6, border: "1px solid rgba(246,70,93,0.15)" }}>
          <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>KL có thể bán</div>
          <div style={{ fontWeight: 700, color: C.red, fontFamily: "monospace" }}>{formatNumber(tokAvail)} {token}</div>
          <div style={{ fontSize: 10, color: C.muted }}>{token} khả dụng</div>
        </div>
        <Stepper label="Giá (VNĐ)" value={sellPrice} onChange={setSellPrice} />
        <Stepper label="Số lượng (token)" value={sellAmount} onChange={setSellAmount} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderTop: `1px solid ${C.border}`, marginBottom: 10 }}>
          <span style={{ color: C.muted }}>Giá trị lệnh</span>
          <span style={{ color: C.text, fontWeight: 700, fontFamily: "monospace" }}>{formatVND(sellPriceN * sellAmtN)}</span>
        </div>
        <button onClick={() => placeOrder("sell")} disabled={placing === "sell"}
          style={{ width: "100%", padding: "11px 0", borderRadius: 6, border: "none",
            background: placing === "sell" ? "#6b1a2a" : C.red,
            color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", letterSpacing: "1px" }}>
          {placing === "sell" ? "Đang đặt…" : "BÁN"}
        </button>
      </div>

      {/* Status */}
      {msg && (
        <div style={{ gridColumn: "1/-1", padding: "9px 12px", borderRadius: 6, fontSize: 12,
          background: msg.ok ? "rgba(14,203,129,0.07)" : "rgba(246,70,93,0.07)",
          border: `1px solid ${msg.ok ? "rgba(14,203,129,0.25)" : "rgba(246,70,93,0.25)"}`,
          color: msg.ok ? C.green : C.red }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}

// ── Open orders mini-table ─────────────────────────────────────────────────────
function OpenOrdersMini({ pair, refreshTick }) {
  const [orders, setOrders] = useState([]);

  const load = useCallback(async () => {
    const d = await apiFetch(`/orders/open?pair=${encodeURIComponent(pair)}`);
    if (d.success) setOrders(d.data || []);
  }, [pair]);

  useEffect(() => { load(); }, [load, refreshTick]);
  useEffect(() => {
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [load]);

  const cancel = async (id) => {
    const d = await apiFetch(`/orders/${id}`, { method: "DELETE" });
    if (d.success) load();
    else alert(d.message);
  };

  if (!orders.length) {
    return <div style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "14px 0" }}>Không có lệnh đang mở cho {pair}</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.02)" }}>
            {["#ID", "Loại", "Giá (VNĐ)", "Số lượng", "Còn lại", "Trạng thái", ""].map(h => (
              <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: C.muted, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
              <td style={{ padding: "7px 10px", color: C.muted }}>#{o.id}</td>
              <td style={{ padding: "7px 10px", fontWeight: 700, color: o.side === "buy" ? C.green : C.red }}>
                {o.side === "buy" ? "MUA" : "BÁN"}
              </td>
              <td style={{ padding: "7px 10px", fontFamily: "monospace" }}>{formatNumber(o.price)}</td>
              <td style={{ padding: "7px 10px", fontFamily: "monospace" }}>{Number(o.amount).toFixed(2)}</td>
              <td style={{ padding: "7px 10px", fontFamily: "monospace" }}>{Number(o.remaining).toFixed(2)}</td>
              <td style={{ padding: "7px 10px" }}>
                <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4,
                  background: o.status === "partial" ? "rgba(240,185,11,0.12)" : "rgba(0,212,170,0.1)",
                  color: o.status === "partial" ? C.gold : C.teal, fontWeight: 600 }}>
                  {o.status === "partial" ? "Khớp 1 phần" : "Mở"}
                </span>
              </td>
              <td style={{ padding: "7px 10px" }}>
                <button onClick={() => cancel(o.id)}
                  style={{ padding: "3px 10px", background: "rgba(246,70,93,0.1)", color: C.red,
                    border: "1px solid rgba(246,70,93,0.3)", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TraderMarketplace() {
  const [tradePair, setTradePair] = useState("CR1/VND");
  const [tick, setTick] = useState(0);

  return (
    <TraderLayout title="Thị trường">

      {/* Market data visualization */}
      <MarketPageContent />

      {/* ── Trade section ── */}
      <div style={{ marginTop: 20, color: C.text, fontSize: 13 }}>

        {/* Section header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📈 Đặt Lệnh Giao Dịch</h3>
            <p style={{ margin: "3px 0 0", color: C.muted, fontSize: 12 }}>Lệnh limit · Khớp tự động theo Price-Time Priority</p>
          </div>
          {/* Pair selector */}
          <div style={{ display: "flex", gap: 6 }}>
            {PAIRS.map(p => (
              <button key={p} onClick={() => setTradePair(p)}
                style={{ padding: "6px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 12,
                  background: p === tradePair ? "rgba(0,212,170,0.1)" : "rgba(255,255,255,0.04)",
                  color: p === tradePair ? C.teal : C.muted,
                  border: p === tradePair ? "1px solid rgba(0,212,170,0.35)" : `1px solid ${C.border}` }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Buy/Sell forms */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 18, marginBottom: 12 }}>
          <OrderPanel key={tradePair} pair={tradePair} onSuccess={() => setTick(t => t + 1)} />
        </div>

        {/* Open orders */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700 }}>
            📋 Lệnh Đang Mở — {tradePair}
          </div>
          <OpenOrdersMini pair={tradePair} refreshTick={tick} />
        </div>
      </div>

    </TraderLayout>
  );
}
