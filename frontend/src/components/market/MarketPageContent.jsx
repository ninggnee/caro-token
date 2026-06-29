import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMarketStats, getMockOrderbook, getMockTrades, getChart } from "../../services/marketApi";
import { formatNumber, formatVND } from '../../utils/formatters';

const C = {
  accent: "#00d4aa", muted: "#6b7a99",
  green:  "#0ecb81", red:   "#f6465d",
  gold:   "#f0b90b", card:  "#141f2e",
};
const TOKEN_KEYS   = ["CR1", "CR2", "CR3"];
const TOKEN_LABELS = { CR1: "CaRo1", CR2: "CaRo2", CR3: "CaRo3" };
const TOKEN_COLORS = { CR1: "#f0b90b", CR2: "#00d4aa", CR3: "#9b87f5" };

const TIME_OPTIONS = [
  { key: "1h",  label: "1H"  },
  { key: "24h", label: "24H" },
  { key: "7d",  label: "7D"  },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "1y",  label: "1Y"  },
];

// ── OHLC Candlestick chart ───────────────────────────────────────────────────

function CandleChart({ candles }) {
  const W = 700, H_C = 210, H_V = 48, H = H_C + H_V, PAD_R = 52;

  if (!candles || candles.length < 2) {
    return (
      <div style={{ height: H, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <div style={{ fontSize: 24 }}>📊</div>
        <div style={{ fontSize: 12, color: C.muted }}>Đang tải dữ liệu biểu đồ…</div>
      </div>
    );
  }

  const prices  = candles.flatMap(c => [c.high, c.low]);
  const minP    = Math.min(...prices), maxP = Math.max(...prices);
  const pRange  = maxP - minP || 1;
  const maxVol  = Math.max(...candles.map(c => c.volume), 1);
  const chartW  = W - PAD_R;
  const step    = chartW / candles.length;
  const cw      = Math.max(1.5, Math.min(10, step * 0.75));

  const sy  = p => H_C - 8 - ((p - minP) / pRange) * (H_C - 18);
  const sv  = v => (v / maxVol) * (H_V - 6);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    price: minP + t * pRange,
    y:     H_C - 8 - t * (H_C - 18),
  }));

  const last  = candles[candles.length - 1];
  const lastY = sy(last.close);
  const isUp  = last.close >= candles[0].close;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }}
         preserveAspectRatio="none">
      {yTicks.map((t, i) => (
        <line key={i} x1={0} y1={t.y} x2={chartW} y2={t.y}
              stroke="rgba(255,255,255,0.04)" strokeDasharray="3,4" />
      ))}
      <line x1={0} y1={H_C} x2={W} y2={H_C} stroke="rgba(255,255,255,0.06)" />
      {candles.map((c, i) => {
        const cx    = i * step + step / 2;
        const isGreen = c.close >= c.open;
        const col   = isGreen ? C.green : C.red;
        const bTop  = sy(Math.max(c.open, c.close));
        const bH    = Math.max(1, Math.abs(sy(c.open) - sy(c.close)));
        const vH    = sv(c.volume);
        return (
          <g key={i}>
            <line x1={cx} y1={sy(c.high)} x2={cx} y2={sy(c.low)}
                  stroke={col} strokeWidth="0.9" opacity="0.75" />
            <rect x={cx - cw / 2} y={bTop} width={cw} height={bH}
                  fill={col} opacity={isGreen ? 0.88 : 0.8} />
            <rect x={cx - cw / 2} y={H_C + H_V - 3 - vH} width={cw} height={vH}
                  fill={col} opacity={0.38} />
          </g>
        );
      })}
      <line x1={0} y1={lastY} x2={chartW} y2={lastY}
            stroke={isUp ? C.green : C.red} strokeWidth="0.8"
            strokeDasharray="4,3" opacity="0.55" />
      {yTicks.map((t, i) => (
        <text key={i} x={W - 2} y={t.y + 3} textAnchor="end"
              fill="#6b7a99" fontSize="8.5" fontFamily="monospace">
          {formatNumber(t.price)}
        </text>
      ))}
      <rect x={chartW + 1} y={lastY - 7} width={PAD_R - 2} height={13}
            fill={isUp ? C.green : C.red} rx="2" opacity="0.9" />
      <text x={W - 3} y={lastY + 3} textAnchor="end" fill="#fff"
            fontSize="8" fontFamily="monospace" fontWeight="bold">
        {formatNumber(last.close)}
      </text>
      <text x={3} y={H - 2} fill="#6b7a99" fontSize="8">VOL</text>
    </svg>
  );
}

// ── Multi-token comparison line chart ─────────────────────────────────────────

function MultiLineChart({ dataMap }) {
  const W = 700, H = 270, PAD_R = 52, chartW = W - PAD_R;

  const tokens = TOKEN_KEYS.filter(t => (dataMap[t] || []).length >= 2);
  if (!tokens.length) {
    return (
      <div style={{ height: H, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <div style={{ fontSize: 24 }}>📊</div>
        <div style={{ fontSize: 12, color: C.muted }}>Đang tải dữ liệu biểu đồ…</div>
      </div>
    );
  }

  const norm = {};
  for (const t of tokens) {
    const pts  = dataMap[t];
    const base = pts[0].close || 1;
    norm[t] = pts.map(p => ((p.close - base) / base) * 100);
  }

  const allPcts = Object.values(norm).flat();
  const minPct  = Math.min(...allPcts), maxPct = Math.max(...allPcts);
  const pRange  = maxPct - minPct || 1;
  const sy      = pct => H - 10 - ((pct - minPct) / pRange) * (H - 22);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    pct: minPct + t * pRange,
    y:   H - 10 - t * (H - 22),
  }));

  const zeroY = minPct <= 0 && maxPct >= 0 ? sy(0) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }}
         preserveAspectRatio="none">
      {yTicks.map((t, i) => (
        <line key={i} x1={0} y1={t.y} x2={chartW} y2={t.y}
              stroke="rgba(255,255,255,0.04)" strokeDasharray="3,4" />
      ))}
      {zeroY !== null && (
        <line x1={0} y1={zeroY} x2={chartW} y2={zeroY}
              stroke="rgba(255,255,255,0.13)" strokeDasharray="5,3" />
      )}
      {tokens.map(t => {
        const pcts  = norm[t];
        const step  = chartW / (pcts.length - 1 || 1);
        const pts   = pcts.map((p, i) => `${(i * step).toFixed(1)},${sy(p).toFixed(1)}`).join(" ");
        const last  = pcts[pcts.length - 1];
        const lastY = sy(last);
        const col   = TOKEN_COLORS[t];
        return (
          <g key={t}>
            <polyline fill="none" stroke={col} strokeWidth="1.8"
                      points={pts} strokeLinejoin="round" strokeLinecap="round" />
            <rect x={chartW + 1} y={lastY - 7} width={PAD_R - 2} height={13}
                  fill={col} rx="2" opacity="0.9" />
            <text x={W - 3} y={lastY + 3} textAnchor="end" fill="#000"
                  fontSize="8" fontFamily="monospace" fontWeight="bold">
              {last >= 0 ? "+" : ""}{last.toFixed(1)}%
            </text>
          </g>
        );
      })}
      {yTicks.map((t, i) => (
        <text key={i} x={chartW - 3} y={t.y - 2} textAnchor="end"
              fill="#6b7a99" fontSize="8" fontFamily="monospace">
          {t.pct >= 0 ? "+" : ""}{t.pct.toFixed(1)}%
        </text>
      ))}
    </svg>
  );
}

// ── Order book ────────────────────────────────────────────────────────────────

function OrderBookPanel({ token }) {
  const bookToken = token === "all" ? "CR1" : token;
  const { data, isLoading } = useQuery({
    queryKey: ["mkt-orderbook", bookToken],
    queryFn:  () => getMockOrderbook(bookToken, 20),
    refetchInterval: 4_000,
    staleTime: 3_000,
  });

  const bids   = data?.bids || [];
  const asks   = data?.asks || [];
  const maxQty = Math.max(...[...bids, ...asks].map(r => r.qty), 1);
  const spread = bids.length && asks.length
    ? Number(asks[0].price) - Number(bids[0].price)
    : null;

  if (isLoading) {
    return <div style={{ textAlign: "center", padding: 20, fontSize: 12, color: C.muted }}>Đang tải…</div>;
  }

  const Row = ({ row, side }) => {
    const pct = (row.qty / maxQty) * 68;
    return (
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr auto", gap: 0, padding: "2px 10px" }}>
        <div style={{
          position: "absolute", [side === "bid" ? "right" : "left"]: 0,
          top: 0, bottom: 0,
          background: side === "bid" ? C.green : C.red,
          opacity: 0.07, width: `${pct}%`,
        }} />
        <span style={{ fontSize: 11, color: side === "bid" ? C.green : C.red, fontWeight: 600, position: "relative", fontFamily: "monospace" }}>
          {formatNumber(row.price)}
        </span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", position: "relative", textAlign: "right", fontFamily: "monospace", minWidth: 52 }}>
          {formatNumber(row.qty, 1)}
        </span>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", padding: "4px 10px 3px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}>GIÁ (VND)</span>
        <span style={{ fontSize: 10, color: C.muted, fontWeight: 700, minWidth: 52, textAlign: "right" }}>SL</span>
      </div>
      <div style={{ padding: "3px 0 0" }}>
        {[...asks].slice(0, 20).reverse().map((r, i) => <Row key={i} row={r} side="ask" />)}
      </div>
      <div style={{ textAlign: "center", padding: "5px 0", fontSize: 10, color: C.muted, background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        {spread !== null
          ? <>Spread <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{formatVND(spread)}</span></>
          : "—"}
      </div>
      <div style={{ padding: "0 0 3px" }}>
        {bids.slice(0, 20).map((r, i) => <Row key={i} row={r} side="bid" />)}
      </div>
      {token === "all" && (
        <div style={{ textAlign: "center", padding: "5px 0 3px", fontSize: 10, color: C.muted, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          ℹ Hiển thị sổ lệnh CaRo1
        </div>
      )}
    </div>
  );
}

// ── Recent trades ─────────────────────────────────────────────────────────────

function TradesPanel({ token }) {
  const { data } = useQuery({
    queryKey: ["mkt-trades", token],
    queryFn:  () => getMockTrades(token === "all" ? "all" : token, 30),
    refetchInterval: 5_000,
    staleTime: 4_000,
  });
  const trades = data?.trades || [];

  if (!trades.length) {
    return <div style={{ textAlign: "center", padding: "16px 0", fontSize: 12, color: C.muted }}>Chưa có giao dịch</div>;
  }

  const showToken = token === "all";
  const cols = showToken
    ? ["Thời gian", "Token", "Giá (VND)", "SL", "Tổng (VND)", "Chiều"]
    : ["Thời gian", "Giá (VND)", "SL", "Tổng (VND)", "Chiều"];
  const gridCols = showToken ? "1fr 0.7fr 1fr 0.8fr 1.1fr 0.6fr" : "1fr 1fr 0.8fr 1.1fr 0.6fr";

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: gridCols, padding: "4px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {cols.map(h => (
          <span key={h} style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}>{h}</span>
        ))}
      </div>
      {trades.map((t, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: gridCols, padding: "3px 14px", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
          <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>
            {t.executedAt ? new Date(t.executedAt).toLocaleTimeString("vi-VN") : "—"}
          </span>
          {showToken && (
            <span style={{ fontSize: 10, fontWeight: 700, color: TOKEN_COLORS[t.token] || C.muted }}>
              {TOKEN_LABELS[t.token] || t.token}
            </span>
          )}
          <span style={{ fontSize: 11, color: t.side === "buy" ? C.green : C.red, fontWeight: 700, fontFamily: "monospace" }}>
            {formatNumber(t.price)}
          </span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>
            {formatNumber(t.quantity)}
          </span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>
            {formatNumber(t.value)}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: t.side === "buy" ? C.green : C.red }}>
            {t.side === "buy" ? "MUA" : "BÁN"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ stats, token }) {
  if (token === "all") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
        {TOKEN_KEYS.map(t => {
          const s   = stats.find(r => r.token === t) || {};
          const chg = Number(s.change_24h || 0);
          return (
            <div key={t} style={{ background: C.card, borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)", padding: "10px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: TOKEN_COLORS[t] }}>{TOKEN_LABELS[t]}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: chg >= 0 ? C.green : C.red }}>
                  {chg >= 0 ? "▲" : "▼"}{Math.abs(chg).toFixed(2)}%
                </span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
                {s.last_price ? formatVND(s.last_price) : "—"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, fontSize: 10, color: C.muted }}>
                <span>24H H: <span style={{ color: C.green }}>{s.high_24h ? formatNumber(s.high_24h) : "—"}</span></span>
                <span>24H L: <span style={{ color: C.red }}>{s.low_24h ? formatNumber(s.low_24h) : "—"}</span></span>
                <span style={{ gridColumn: "1/-1" }}>Vol: <span style={{ color: "#e2e8f0" }}>{s.volume_24h ? formatNumber(Number(s.volume_24h)) : "—"} token</span></span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const s   = stats.find(r => r.token === token) || {};
  const chg = Number(s.change_24h || 0);
  const last = Number(s.last_price || 0);

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "baseline", marginBottom: 14, flexWrap: "wrap", padding: "10px 16px", background: C.card, borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
      <div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 2, fontWeight: 600 }}>Last Price</div>
        <span style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{last ? formatVND(last) : "—"}</span>
      </div>
      <div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>24H Change</div>
        <span style={{ fontSize: 14, fontWeight: 700, color: chg >= 0 ? C.green : C.red }}>
          {chg >= 0 ? "▲" : "▼"} {Math.abs(chg).toFixed(2)}%
        </span>
      </div>
      {[
        ["24H High",   s.high_24h,  C.green],
        ["24H Low",    s.low_24h,   C.red],
        ["Volume",     s.volume_24h  ? formatNumber(Number(s.volume_24h)) + " token" : null, null],
        ["Market Cap", s.market_cap  ? formatVND(Number(s.market_cap))                : null, null],
      ].filter(([, v]) => v).map(([label, val, col]) => (
        <div key={label}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>{label}</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: col || "#e2e8f0" }}>
            {typeof val === "string" ? val : formatNumber(val)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Shared market page content ────────────────────────────────────────────────

export default function MarketPageContent({ onPlaceOrder }) {
  const [token, setToken] = useState("all");
  const [time,  setTime]  = useState("24h");

  const { data: statsData } = useQuery({
    queryKey: ["mkt-stats"],
    queryFn:  getMarketStats,
    refetchInterval: 10_000,
    staleTime: 8_000,
  });
  const stats = statsData?.stats || [];

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ["mkt-chart", token, time],
    queryFn:  () => getChart(token, time),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
  const dataMap       = chartData?.data || {};
  const singleCandles = token !== "all" ? (dataMap[token] || []) : [];

  const btnStyle = (active, color = C.accent) => ({
    padding: "5px 12px",
    borderRadius: 6,
    border: `1px solid ${active ? color : "rgba(255,255,255,0.08)"}`,
    background: active ? `${color}18` : "transparent",
    color:  active ? color : C.muted,
    fontWeight: 700, fontSize: 12,
    cursor: "pointer", transition: "all 0.12s",
  });

  return (
    <div style={{ maxWidth: 1120 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🏪 Marketplace — CaRo Token</h2>
          <p style={{ margin: "3px 0 0", color: C.muted, fontSize: 13 }}>
            Biểu đồ thời gian thực · Sổ lệnh 20 cấp · Giao dịch gần đây
          </p>
        </div>
        {onPlaceOrder && (
          <button onClick={onPlaceOrder}
            style={{ padding: "9px 20px", background: C.accent, border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            📈 Đặt lệnh →
          </button>
        )}
      </div>

      {/* ── Filter row ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginRight: 2 }}>Token:</span>
          <button onClick={() => setToken("all")} style={btnStyle(token === "all")}>All</button>
          {TOKEN_KEYS.map(t => (
            <button key={t} onClick={() => setToken(t)}
              style={btnStyle(token === t, TOKEN_COLORS[t])}>
              {TOKEN_LABELS[t]}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginRight: 2 }}>Time:</span>
          {TIME_OPTIONS.map(({ key, label }) => (
            <button key={key} onClick={() => setTime(key)}
              style={btnStyle(time === key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats ── */}
      <StatsBar stats={stats} token={token} />

      {/* ── Chart + Order book ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 250px", gap: 12, marginBottom: 12 }}>

        <div style={{ background: C.card, borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px 9px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>
              📊{" "}
              {token === "all"
                ? "So sánh CaRo1 / CaRo2 / CaRo3 (%)"
                : `${TOKEN_LABELS[token]}/VND · Candlestick`}
              {" · "}
              <span style={{ color: C.muted, fontWeight: 400 }}>{time.toUpperCase()}</span>
            </span>
            {token === "all" && (
              <div style={{ display: "flex", gap: 12 }}>
                {TOKEN_KEYS.map(t => (
                  <span key={t} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                    <span style={{ display: "inline-block", width: 14, height: 2.5, background: TOKEN_COLORS[t], borderRadius: 2 }} />
                    <span style={{ color: TOKEN_COLORS[t], fontWeight: 700 }}>{TOKEN_LABELS[t]}</span>
                  </span>
                ))}
              </div>
            )}
            {token !== "all" && singleCandles.length > 0 && (() => {
              const last = singleCandles[singleCandles.length - 1];
              return (
                <div style={{ display: "flex", gap: 14, fontSize: 11 }}>
                  <span>O: <span style={{ color: "#e2e8f0" }}>{formatNumber(last.open)}</span></span>
                  <span>H: <span style={{ color: C.green }}>{formatNumber(last.high)}</span></span>
                  <span>L: <span style={{ color: C.red }}>{formatNumber(last.low)}</span></span>
                  <span>C: <span style={{ color: C.accent }}>{formatNumber(last.close)}</span></span>
                </div>
              );
            })()}
          </div>
          <div style={{ padding: "6px 4px 2px" }}>
            {chartLoading ? (
              <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 12, color: C.muted }}>Đang tải dữ liệu…</span>
              </div>
            ) : token === "all" ? (
              <MultiLineChart dataMap={dataMap} />
            ) : (
              <CandleChart candles={singleCandles} />
            )}
          </div>
        </div>

        <div style={{ background: C.card, borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "10px 12px 9px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>📖 Sổ Lệnh</span>
            <span style={{ fontSize: 10, color: C.muted }}>20 + 20 · 4s</span>
          </div>
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            <OrderBookPanel token={token} />
          </div>
        </div>
      </div>

      {/* ── Recent trades ── */}
      <div style={{ background: C.card, borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "10px 14px 9px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>
            🔄 Giao Dịch Gần Đây{token !== "all" ? ` — ${TOKEN_LABELS[token]}` : " — Tất cả"}
          </span>
          <span style={{ fontSize: 10, color: C.muted }}>Cập nhật mỗi 5s</span>
        </div>
        <div style={{ maxHeight: 230, overflowY: "auto" }}>
          <TradesPanel token={token} />
        </div>
      </div>

      {/* ── Footer note ── */}
      <div style={{ marginTop: 14, padding: "11px 16px", background: "rgba(0,212,170,0.04)", border: "1px solid rgba(0,212,170,0.1)", borderRadius: 8, fontSize: 12, color: C.muted }}>
        📋 Dữ liệu được tạo tự động bởi <strong style={{ color: C.accent }}>Mock Market Engine</strong> (MARKET_MODE=MOCK).
        Biểu đồ, sổ lệnh và giao dịch cập nhật real-time.
        {onPlaceOrder && <> Để đặt lệnh thực, nhấn <strong style={{ color: C.accent }}>Đặt lệnh →</strong>.</>}
      </div>

    </div>
  );
}
