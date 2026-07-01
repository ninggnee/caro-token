import { useState, useEffect, useCallback } from "react";
import TraderLayout from "../components/layout/TraderLayout";
import MarketPageContent from "../components/market/MarketPageContent";
import { API_URL } from "../config/api";
import { formatNumber, formatVND } from "../utils/formatters";
import { toast } from "react-toastify";

const PAIRS = ["CR1/VND", "CR2/VND", "CR3/VND"];

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
    <div className="caro-field" style={{ marginBottom: 12 }}>
      <label className="caro-label">{label}</label>
      <div style={{ display: "flex", border: `1px solid rgba(255,255,255,0.08)`, borderRadius: "8px", overflow: "hidden", background: "rgba(255,255,255,0.04)" }}>
        <button onClick={() => adj(-1)} disabled={disabled}
          style={{ width: 36, background: "rgba(0,0,0,0.2)", border: "none", color: "#94a3b8", cursor: disabled ? "default" : "pointer", fontSize: 18, flexShrink: 0, transition: "background 0.2s" }}
          onMouseEnter={e => !disabled && (e.target.style.background = "rgba(0,0,0,0.4)")}
          onMouseLeave={e => !disabled && (e.target.style.background = "rgba(0,0,0,0.2)")}>
          −
        </button>
        <input type="number" className="caro-input" value={value} onChange={e => !disabled && onChange(e.target.value)}
          readOnly={disabled} placeholder="0"
          style={{ flex: 1, border: "none", background: "transparent", textAlign: "center", borderRadius: 0, padding: "8px 12px" }} />
        <button onClick={() => adj(1)} disabled={disabled}
          style={{ width: 36, background: "rgba(0,0,0,0.2)", border: "none", color: "#94a3b8", cursor: disabled ? "default" : "pointer", fontSize: 18, flexShrink: 0, transition: "background 0.2s" }}
          onMouseEnter={e => !disabled && (e.target.style.background = "rgba(0,0,0,0.4)")}
          onMouseLeave={e => !disabled && (e.target.style.background = "rgba(0,0,0,0.2)")}>
          +
        </button>
      </div>
    </div>
  );
}

// ── Order placement panel ─────────────────────────────────────────────────────
function OrderPanel({ pair, onSuccess }) {
  const [buyPrice,   setBuyPrice]   = useState("");
  const [buyAmount,  setBuyAmount]  = useState("");
  const [sellPrice,  setSellPrice]  = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [placing,    setPlacing]    = useState(null);
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
      toast.warning("Vui lòng nhập Giá và Số lượng hợp lệ");
      return;
    }
    setPlacing(side);
    try {
      const d = await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify({ pair, side, price: Number(p), amount: Number(a) }),
      });
      if (d.success) {
        toast.success(`Đặt lệnh thành công · Khớp: ${d.trades} lệnh`);
        if (side === "buy") { setBuyAmount(""); setBuyPrice(""); }
        else                { setSellAmount(""); setSellPrice(""); }
        loadBalances();
        if (onSuccess) onSuccess();
      } else {
        toast.error(d.message || "Lỗi đặt lệnh");
      }
    } catch { toast.error("Lỗi kết nối server"); }
    setPlacing(null);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      {/* BUY */}
      <div>
        <div style={{ marginBottom: 16, padding: "12px 14px", background: "rgba(176, 228, 204,0.05)", borderRadius: 8, border: "1px solid rgba(176, 228, 204,0.15)" }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>SỨC MUA TỐI ĐA</div>
          <div style={{ fontWeight: 800, color: "#B0E4CC", fontSize: 16, fontFamily: "monospace" }}>{formatNumber(maxBuyQty)} <span style={{ fontSize: 12 }}>{token}</span></div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{formatVND(vndAvail)} VNĐ khả dụng</div>
        </div>
        <Stepper label="Giá Mua (VNĐ)" value={buyPrice} onChange={setBuyPrice} />
        <Stepper label={`Số lượng (${token})`} value={buyAmount} onChange={setBuyAmount} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.05)", marginBottom: 12 }}>
          <span style={{ color: "#94a3b8" }}>Tổng giá trị lệnh</span>
          <span style={{ color: "#f8fafc", fontWeight: 700, fontFamily: "monospace" }}>{formatVND(buyPriceN * buyAmtN)}</span>
        </div>
        <button onClick={() => placeOrder("buy")} disabled={placing === "buy"} className="caro-btn caro-btn-success" style={{ width: "100%", padding: "12px", fontSize: 14 }}>
          {placing === "buy" ? "Đang đặt..." : "MUA THÊM"}
        </button>
      </div>

      {/* SELL */}
      <div>
        <div style={{ marginBottom: 16, padding: "12px 14px", background: "rgba(239,68,68,0.05)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.15)" }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>SỐ LƯỢNG CÓ THỂ BÁN</div>
          <div style={{ fontWeight: 800, color: "#ef4444", fontSize: 16, fontFamily: "monospace" }}>{formatNumber(tokAvail)} <span style={{ fontSize: 12 }}>{token}</span></div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{token} khả dụng trong ví</div>
        </div>
        <Stepper label="Giá Bán (VNĐ)" value={sellPrice} onChange={setSellPrice} />
        <Stepper label={`Số lượng (${token})`} value={sellAmount} onChange={setSellAmount} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.05)", marginBottom: 12 }}>
          <span style={{ color: "#94a3b8" }}>Tổng thu về</span>
          <span style={{ color: "#f8fafc", fontWeight: 700, fontFamily: "monospace" }}>{formatVND(sellPriceN * sellAmtN)}</span>
        </div>
        <button onClick={() => placeOrder("sell")} disabled={placing === "sell"} className="caro-btn caro-btn-danger" style={{ width: "100%", padding: "12px", fontSize: 14 }}>
          {placing === "sell" ? "Đang đặt..." : "BÁN TOKEN"}
        </button>
      </div>
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
    if (d.success) {
      toast.success(`Hủy lệnh #${id} thành công`);
      load();
    } else toast.error(d.message);
  };

  if (!orders.length) {
    return <div className="caro-empty" style={{ padding: "30px" }}><div className="caro-empty-icon">📂</div><div className="caro-empty-title">Không có lệnh mở</div></div>;
  }

  return (
    <div className="caro-table-wrap">
      <table className="caro-table">
        <thead>
          <tr>
            <th>#ID</th>
            <th>Loại</th>
            <th>Giá (VNĐ)</th>
            <th>Khối lượng</th>
            <th>Còn lại</th>
            <th>Trạng thái</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id}>
              <td style={{ color: "#94a3b8" }}>#{o.id}</td>
              <td style={{ fontWeight: 700, color: o.side === "buy" ? "#B0E4CC" : "#ef4444" }}>
                {o.side === "buy" ? "MUA" : "BÁN"}
              </td>
              <td style={{ fontFamily: "monospace", color: "#f8fafc" }}>{formatNumber(o.price)}</td>
              <td style={{ fontFamily: "monospace" }}>{Number(o.amount).toFixed(2)}</td>
              <td style={{ fontFamily: "monospace" }}>{Number(o.remaining).toFixed(2)}</td>
              <td>
                <span className={`caro-badge ${o.status === "partial" ? "caro-badge-warning" : "caro-badge-info"}`}>
                  {o.status === "partial" ? "Khớp 1 phần" : "Mở"}
                </span>
              </td>
              <td style={{ textAlign: "right" }}>
                <button onClick={() => cancel(o.id)} className="caro-btn caro-btn-ghost caro-btn-sm" style={{ color: "#ef4444" }}>
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TraderMarketplace() {
  const [tradePair, setTradePair] = useState("CR1/VND");
  const [tick, setTick] = useState(0);

  return (
    <TraderLayout title="Thị trường">
      <div className="caro-page">
        {/* Market data visualization */}
        <MarketPageContent />

        {/* ── Trade section ── */}
        <div style={{ display: "grid", gap: 24 }}>
          
          {/* Order Placement Card */}
          <div className="caro-card">
            <div className="caro-section-header">
              <h3 className="caro-section-title">Đặt Lệnh Giao Dịch</h3>
              <div style={{ display: "flex", gap: 6 }}>
                {PAIRS.map(p => (
                  <button key={p} onClick={() => setTradePair(p)}
                    className={`caro-btn caro-btn-sm ${p === tradePair ? "caro-btn-secondary" : "caro-btn-ghost"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            
            <OrderPanel key={tradePair} pair={tradePair} onSuccess={() => setTick(t => t + 1)} />
          </div>

          {/* Open Orders Card */}
          <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="caro-section-header" style={{ borderBottom: "none" }}>
              <h3 className="caro-section-title">Lệnh Đang Mở — {tradePair}</h3>
            </div>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <OpenOrdersMini pair={tradePair} refreshTick={tick} />
            </div>
          </div>
          
        </div>
      </div>
    </TraderLayout>
  );
}
