import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "../components/layout/DashboardLayout";
import { getMarketStats, getMockOrderbook, getMockTrades, getCandles } from "../services/marketApi";
import axios from "../utils/axiosClient";

const C = { accent: "#00d4aa", muted: "#6b7a99", green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", card: "#141f2e", bg: "#0d1829" };
const TOKENS = ["CR1", "CR2", "CR3"];
const TOKEN_LABELS = { CR1: "CaRo1", CR2: "CaRo2", CR3: "CaRo3" };
const INTERVALS = ["1m", "5m", "15m", "1h", "1d"];

function fmt(n, dec = 0) {
  return Number(n || 0).toLocaleString("vi-VN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ── OHLC Candlestick SVG chart ────────────────────────────────────────────────

function CandleChart({ token, interval }) {
  const { data, isLoading } = useQuery({
    queryKey: ["trader-candles", token, interval],
    queryFn: () => getCandles(token, interval, 80),
    refetchInterval: interval === "1m" ? 15_000 : 30_000,
    staleTime: 10_000,
  });
  const candles = data?.candles || [];

  const chart = useMemo(() => {
    if (candles.length < 2) return null;
    const W = 700, H = 200, pad = 4;
    const prices = candles.flatMap(c => [c.high, c.low]);
    const minP = Math.min(...prices), maxP = Math.max(...prices);
    const range = maxP - minP || 1;
    const cw = (W - pad * 2) / candles.length;
    const scaleY = (p) => H - ((p - minP) / range) * H;
    return { candles, W, H, cw, scaleY, pad };
  }, [candles]);

  if (isLoading) return <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 12, color: C.muted }}>Đang tải biểu đồ…</span></div>;
  if (!chart) return <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 12, color: C.muted }}>Chưa có dữ liệu</span></div>;

  const { W, H, cw, scaleY, pad } = chart;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 200, display: "block" }} preserveAspectRatio="none">
      {chart.candles.map((c, i) => {
        const x      = pad + i * cw + cw * 0.1;
        const body   = Math.max(1, Math.abs(scaleY(c.close) - scaleY(c.open)));
        const bodyY  = Math.min(scaleY(c.open), scaleY(c.close));
        const isUp   = c.close >= c.open;
        const color  = isUp ? C.green : C.red;
        const cx     = pad + i * cw + cw / 2;
        return (
          <g key={i}>
            {/* Wick */}
            <line x1={cx} y1={scaleY(c.high)} x2={cx} y2={scaleY(c.low)} stroke={color} strokeWidth="0.7" />
            {/* Body */}
            <rect x={x} y={bodyY} width={cw * 0.8} height={body} fill={color} opacity={isUp ? 0.85 : 0.75} />
          </g>
        );
      })}
    </svg>
  );
}

// ── Order book ────────────────────────────────────────────────────────────────

function OrderBookPanel({ token }) {
  const { data, isLoading } = useQuery({
    queryKey: ["trader-orderbook", token],
    queryFn: () => getMockOrderbook(token, 20),
    refetchInterval: 3_000,
    staleTime: 2_000,
  });
  const bids = data?.bids || [];
  const asks = data?.asks || [];
  const maxQty = Math.max(...[...bids, ...asks].map(r => r.qty), 1);

  if (isLoading) return <div style={{ textAlign: "center", padding: 20, fontSize: 12, color: C.muted }}>Đang tải…</div>;

  const Row = ({ row, side }) => {
    const pct = (row.qty / maxQty) * 70;
    return (
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", padding: "2px 10px" }}>
        <div style={{ position: "absolute", [side === "bid" ? "right" : "left"]: 0, top: 0, bottom: 0, background: side === "bid" ? C.green : C.red, opacity: 0.07, width: `${pct}%` }} />
        <span style={{ fontSize: 11, color: side === "bid" ? C.green : C.red, fontWeight: 600, position: "relative" }}>{fmt(row.price)}</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", position: "relative", textAlign: "right" }}>{fmt(row.qty, 2)}</span>
      </div>
    );
  };

  const spread = bids.length && asks.length ? Number(asks[0].price) - Number(bids[0].price) : null;

  return (
    <div style={{ fontSize: 11 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "4px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ color: C.muted, fontSize: 10, fontWeight: 700 }}>GIÁ (₫)</span>
        <span style={{ color: C.muted, fontSize: 10, fontWeight: 700, textAlign: "right" }}>SL</span>
      </div>
      {[...asks].slice(0, 20).reverse().map((r, i) => <Row key={i} row={r} side="ask" />)}
      {spread !== null && (
        <div style={{ textAlign: "center", padding: "4px 0", fontSize: 11, color: C.muted, background: "rgba(255,255,255,0.02)" }}>
          Spread <span style={{ color: "#e2e8f0" }}>{fmt(spread)}</span>
        </div>
      )}
      {bids.slice(0, 20).map((r, i) => <Row key={i} row={r} side="bid" />)}
    </div>
  );
}

// ── Recent trades ─────────────────────────────────────────────────────────────

function TradesPanel({ token }) {
  const { data } = useQuery({
    queryKey: ["trader-trades", token],
    queryFn: () => getMockTrades(token, 40),
    refetchInterval: 4_000,
    staleTime: 3_000,
  });
  const trades = data?.trades || [];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "4px 10px 4px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {["Giá", "SL", "Giờ"].map(h => <span key={h} style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}>{h}</span>)}
      </div>
      {!trades.length ? (
        <div style={{ textAlign: "center", padding: "20px 0", fontSize: 12, color: C.muted }}>Chưa có giao dịch</div>
      ) : trades.map((t, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "2px 10px" }}>
          <span style={{ fontSize: 11, color: t.side === "buy" ? C.green : C.red, fontWeight: 600 }}>{fmt(t.price)}</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{fmt(t.quantity, 2)}</span>
          <span style={{ fontSize: 10, color: C.muted }}>{t.executedAt ? new Date(t.executedAt).toLocaleTimeString("vi-VN") : "—"}</span>
        </div>
      ))}
    </div>
  );
}

// ── Order placement form ──────────────────────────────────────────────────────

function OrderForm({ token, lastPrice }) {
  const qc = useQueryClient();
  const [side, setSide]   = useState("buy");
  const [price, setPrice] = useState("");
  const [qty, setQty]     = useState("");
  const [msg, setMsg]     = useState(null);

  const total = price && qty ? Number(price) * Number(qty) : null;

  const mutation = useMutation({
    mutationFn: (payload) => axios.post("/orders", payload).then(r => r.data),
    onSuccess: (data) => {
      setMsg({ ok: true, text: data.message || "Lệnh đã được đặt thành công!" });
      setPrice(""); setQty("");
      qc.invalidateQueries({ queryKey: ["trader-orderbook", token] });
      qc.invalidateQueries({ queryKey: ["trader-trades", token] });
    },
    onError: (err) => {
      setMsg({ ok: false, text: err?.response?.data?.message || "Đặt lệnh thất bại. Kiểm tra số dư tài khoản." });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setMsg(null);
    if (!price || !qty || Number(price) <= 0 || Number(qty) <= 0) {
      setMsg({ ok: false, text: "Vui lòng nhập giá và số lượng hợp lệ." });
      return;
    }
    mutation.mutate({
      pair:     `${token}/VND`,
      side,
      type:     "limit",
      price:    Number(price),
      quantity: Number(qty),
    });
  };

  const fillPrice = () => lastPrice && setPrice(String(lastPrice));

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
      {/* Side toggle */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
        <button type="button" onClick={() => setSide("buy")}
          style={{ padding: "9px 0", background: side === "buy" ? C.green : "transparent", color: side === "buy" ? "#000" : C.muted, fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", transition: "all 0.15s" }}>
          MUA
        </button>
        <button type="button" onClick={() => setSide("sell")}
          style={{ padding: "9px 0", background: side === "sell" ? C.red : "transparent", color: side === "sell" ? "#fff" : C.muted, fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", transition: "all 0.15s" }}>
          BÁN
        </button>
      </div>

      {/* Price */}
      <div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Giá (VND)</div>
        <div style={{ display: "flex", gap: 6 }}>
          <input value={price} onChange={e => setPrice(e.target.value)} type="number" min="1" placeholder={lastPrice ? fmt(lastPrice) : "0"}
            style={{ flex: 1, padding: "8px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#e2e8f0", fontSize: 13, outline: "none" }} />
          <button type="button" onClick={fillPrice}
            style={{ padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: C.muted, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
            Giá TT
          </button>
        </div>
      </div>

      {/* Quantity */}
      <div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Số lượng (token)</div>
        <input value={qty} onChange={e => setQty(e.target.value)} type="number" min="1" placeholder="0"
          style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
      </div>

      {/* Total */}
      {total && (
        <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6, fontSize: 12, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: C.muted }}>Tổng</span>
          <span style={{ color: "#e2e8f0", fontWeight: 700 }}>{fmt(total)} ₫</span>
        </div>
      )}

      {/* Submit */}
      <button type="submit" disabled={mutation.isPending}
        style={{ padding: "11px 0", background: side === "buy" ? C.green : C.red, border: "none", borderRadius: 8, color: side === "buy" ? "#000" : "#fff", fontWeight: 700, fontSize: 14, cursor: mutation.isPending ? "not-allowed" : "pointer", opacity: mutation.isPending ? 0.7 : 1 }}>
        {mutation.isPending ? "Đang đặt lệnh…" : `${side === "buy" ? "Đặt lệnh MUA" : "Đặt lệnh BÁN"} ${TOKEN_LABELS[token]}`}
      </button>

      {msg && (
        <div style={{ padding: "8px 12px", borderRadius: 6, fontSize: 12, background: msg.ok ? "rgba(14,203,129,0.08)" : "rgba(246,70,93,0.08)", border: `1px solid ${msg.ok ? "rgba(14,203,129,0.2)" : "rgba(246,70,93,0.2)"}`, color: msg.ok ? C.green : C.red }}>
          {msg.text}
        </div>
      )}
    </form>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TraderMarketplace() {
  const [selectedToken, setSelectedToken] = useState("CR1");
  const [interval, setInterval]           = useState("1h");

  const { data: statsData } = useQuery({
    queryKey: ["trader-market-stats"],
    queryFn: () => getMarketStats(),
    refetchInterval: 10_000,
    staleTime: 8_000,
  });

  const statMap  = Object.fromEntries((statsData?.stats || []).map(s => [s.token, s]));
  const selected = statMap[selectedToken] || {};
  const lastPrice = Number(selected.last_price || 0);
  const change24h = Number(selected.change_24h || 0);
  const isUp      = change24h >= 0;

  return (
    <DashboardLayout title="Trader Marketplace">
      <div style={{ maxWidth: 1300 }}>

        {/* Token selector bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          {TOKENS.map(t => {
            const s = statMap[t];
            const chg = Number(s?.change_24h || 0);
            return (
              <button key={t} onClick={() => setSelectedToken(t)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", background: selectedToken === t ? "rgba(0,212,170,0.08)" : C.card, border: `1px solid ${selectedToken === t ? C.accent : "rgba(255,255,255,0.08)"}`, borderRadius: 8, cursor: "pointer", transition: "all 0.15s" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: selectedToken === t ? C.accent : "#e2e8f0" }}>{TOKEN_LABELS[t]}/VND</span>
                {s && (
                  <>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{fmt(s.last_price)}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: chg >= 0 ? C.green : C.red }}>
                      {chg >= 0 ? "▲" : "▼"}{Math.abs(chg).toFixed(2)}%
                    </span>
                  </>
                )}
              </button>
            );
          })}
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {INTERVALS.map(iv => (
              <button key={iv} onClick={() => setInterval(iv)}
                style={{ padding: "5px 10px", background: interval === iv ? "rgba(0,212,170,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${interval === iv ? C.accent : "rgba(255,255,255,0.08)"}`, borderRadius: 5, color: interval === iv ? C.accent : C.muted, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {iv}
              </button>
            ))}
          </div>
        </div>

        {/* Header stats row */}
        <div style={{ display: "flex", gap: 24, marginBottom: 14, flexWrap: "wrap", alignItems: "baseline" }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{lastPrice ? fmt(lastPrice) + " ₫" : "—"}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: isUp ? C.green : C.red }}>{isUp ? "▲" : "▼"} {Math.abs(change24h).toFixed(2)}% (24h)</span>
          {[
            ["24h Cao", selected.high_24h, C.green],
            ["24h Thấp", selected.low_24h, C.red],
            ["Volume", selected.volume_24h && (fmt(selected.volume_24h, 0) + " token"), null],
          ].map(([label, val, col]) => val && (
            <div key={label} style={{ fontSize: 12 }}>
              <span style={{ color: C.muted }}>{label}: </span>
              <span style={{ color: col || "#e2e8f0", fontWeight: 600 }}>{typeof val === "string" ? val : fmt(val)}</span>
            </div>
          ))}
        </div>

        {/* Main grid: chart + orderbook + form + trades */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 220px 220px", gap: 12 }}>

          {/* Chart + trades stacked */}
          <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
            <div style={{ background: C.card, borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", padding: "12px 14px 8px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: C.muted }}>
                📊 {TOKEN_LABELS[selectedToken]}/VND · {interval.toUpperCase()} · Candlestick
              </div>
              <CandleChart token={selectedToken} interval={interval} />
            </div>

            <div style={{ background: C.card, borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 700 }}>
                🔄 Giao Dịch Gần Đây
              </div>
              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                <TradesPanel token={selectedToken} />
              </div>
            </div>
          </div>

          {/* Order book */}
          <div style={{ background: C.card, borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 700 }}>
              📖 Sổ Lệnh
            </div>
            <div style={{ maxHeight: 540, overflowY: "auto" }}>
              <OrderBookPanel token={selectedToken} />
            </div>
          </div>

          {/* Order form */}
          <div style={{ background: C.card, borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
              ⚡ Đặt Lệnh — {TOKEN_LABELS[selectedToken]}
            </div>
            <OrderForm token={selectedToken} lastPrice={lastPrice} />

            {/* Market info */}
            <div style={{ marginTop: 16, display: "grid", gap: 6 }}>
              {[
                ["Market Cap", selected.market_cap && (fmt(selected.market_cap) + " ₫")],
                ["Lệnh 24h",   selected.trade_count_24h && fmt(selected.trade_count_24h) + " lệnh"],
              ].map(([label, val]) => val && (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: C.muted }}>{label}</span>
                  <span style={{ color: "#e2e8f0" }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14, padding: "10px 16px", background: "rgba(240,185,11,0.04)", border: "1px solid rgba(240,185,11,0.12)", borderRadius: 8, fontSize: 11, color: C.muted }}>
          ⚠️ Dữ liệu thị trường đang ở chế độ <strong style={{ color: C.gold }}>MOCK</strong> — giá và giao dịch do hệ thống tự động tạo ra để phục vụ kiểm thử. Không phản ánh giá thị trường thực.
        </div>
      </div>
    </DashboardLayout>
  );
}