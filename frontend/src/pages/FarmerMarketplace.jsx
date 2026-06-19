import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import FarmerLayout from "../components/layout/FarmerLayout";
import { getOrderbook, getTickers, getRecentTrades } from "../services/orderApi";

const C = { green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", accent: "#487573", muted: "#6b7a99", card: "#172524", border: "rgba(72, 117, 115, 0.15)", tealLight: "#7fe0c9" };
const PAIRS = ["CR1/VND", "CR2/VND", "CR3/VND"];

const GRADE_DESC = {
  "CR1/VND": { grade: "CR1", name: "Xuất Sắc", desc: "Cà phê Robusta chất lượng cao nhất — phù hợp xuất khẩu" },
  "CR2/VND": { grade: "CR2", name: "Tốt",      desc: "Robusta chất lượng tốt — tiêu dùng trong nước + xuất khẩu" },
  "CR3/VND": { grade: "CR3", name: "Tiêu Chuẩn", desc: "Robusta tiêu chuẩn — phù hợp pha trộn và nội địa" },
};

function fmt(n, dec = 0) {
  return Number(n || 0).toLocaleString("vi-VN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function PairCard({ ticker, selected, onClick }) {
  const pair     = ticker?.pair || "—";
  const last     = Number(ticker?.last_price || 0);
  const high     = Number(ticker?.high        || 0);
  const low      = Number(ticker?.low         || 0);
  const volume   = Number(ticker?.volume      || 0);
  const meta     = GRADE_DESC[pair] || {};
  const change   = high && low ? ((last - low) / low * 100) : 0;
  const isUp     = change >= 0;

  return (
    <div onClick={onClick} style={{ background: selected ? "rgba(72, 117, 115, 0.08)" : C.card, border: `1px solid ${selected ? C.tealLight : C.border}`, borderRadius: 10, padding: 16, cursor: "pointer", transition: "all 0.15s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: selected ? C.tealLight : "#e2e8f0" }}>{pair}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>☕ {meta.name || ""}</div>
        </div>
        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: isUp ? "rgba(14,203,129,0.12)" : "rgba(246,70,93,0.12)", color: isUp ? C.green : C.red, fontWeight: 700 }}>
          {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
        </span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: last ? "#fff" : C.muted, marginBottom: 8 }}>
        {last ? fmt(last) + " ₫" : "Chưa có giao dịch"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        <div style={{ fontSize: 11, color: C.muted }}>Cao nhất: <span style={{ color: C.green }}>{high ? fmt(high) : "—"}</span></div>
        <div style={{ fontSize: 11, color: C.muted }}>Thấp nhất:  <span style={{ color: C.red }}>{low ? fmt(low) : "—"}</span></div>
        <div style={{ fontSize: 11, color: C.muted, gridColumn: "1/-1" }}>Vol: <span style={{ color: "#e2e8f0" }}>{fmt(volume, 2)} kg</span></div>
      </div>
    </div>
  );
}

function OrderBookPanel({ pair }) {
  const { data, isLoading } = useQuery({
    queryKey: ["orderbook", pair],
    queryFn: () => getOrderbook(pair),
    refetchInterval: 4000,
  });
  const bids = data?.data?.bids || [];
  const asks = data?.data?.asks || [];
  const maxAmt = Math.max(...[...bids, ...asks].map(r => r.amount), 1);

  if (isLoading) return <div style={{ color: C.muted, fontSize: 12, padding: 14 }}>Đang tải sổ lệnh...</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
      {/* Bids */}
      <div style={{ padding: "10px 12px", borderRight: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.green, marginBottom: 8 }}>BID — MUA</div>
        {bids.length === 0 ? (
          <div style={{ fontSize: 11, color: C.muted, textAlign: "center", padding: "12px 0" }}>Trống</div>
        ) : (
          bids.slice(0, 6).map((r, i) => {
            const pct = (r.amount / maxAmt) * 100;
            return (
              <div key={i} style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: "3px 4px", borderRadius: 3, marginBottom: 2 }}>
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, background: C.green, opacity: 0.06, borderRadius: 3, width: `${pct}%` }} />
                <span style={{ fontSize: 12, color: C.green, fontWeight: 600, position: "relative" }}>{fmt(r.price)}</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", position: "relative", textAlign: "right" }}>{fmt(r.amount, 1)}</span>
              </div>
            );
          })
        )}
      </div>
      {/* Asks */}
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.red, marginBottom: 8 }}>ASK — BÁN</div>
        {asks.length === 0 ? (
          <div style={{ fontSize: 11, color: C.muted, textAlign: "center", padding: "12px 0" }}>Trống</div>
        ) : (
          asks.slice(0, 6).map((r, i) => {
            const pct = (r.amount / maxAmt) * 100;
            return (
              <div key={i} style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: "3px 4px", borderRadius: 3, marginBottom: 2 }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, background: C.red, opacity: 0.06, borderRadius: 3, width: `${pct}%` }} />
                <span style={{ fontSize: 12, color: C.red, fontWeight: 600, position: "relative" }}>{fmt(r.price)}</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", position: "relative", textAlign: "right" }}>{fmt(r.amount, 1)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function RecentTradesPanel({ pair }) {
  const { data } = useQuery({
    queryKey: ["recent-trades", pair],
    queryFn: () => getRecentTrades(pair),
    refetchInterval: 5000,
  });
  const trades = (data?.data || []).filter(t => t.pair === pair).slice(0, 8);

  if (!trades.length) return <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: "14px 0" }}>Chưa có giao dịch</div>;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "0 0 6px", borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
        {["Giá", "SL (kg)", "Giờ"].map(h => (
          <span key={h} style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>{h}</span>
        ))}
      </div>
      {trades.map((t, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "3px 0" }}>
          <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>{fmt(t.price)}</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{fmt(t.amount, 2)}</span>
          <span style={{ fontSize: 11, color: C.muted }}>{new Date(t.created_at).toLocaleTimeString("vi-VN")}</span>
        </div>
      ))}
    </div>
  );
}

export default function FarmerMarketplace() {
  const navigate = useNavigate();
  const [selectedPair, setSelectedPair] = useState("CR1/VND");

  const { data: tickerData, isLoading } = useQuery({
    queryKey: ["tickers"],
    queryFn: getTickers,
    refetchInterval: 10000,
  });

  const tickers = tickerData?.data || [];
  const tickerMap = Object.fromEntries(tickers.map(t => [t.pair, t]));

  const selectedMeta = GRADE_DESC[selectedPair] || {};

  return (
    <FarmerLayout title="Chợ giao dịch">
      <div style={{ width: "100%" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🏪 Marketplace — Cà Phê Robusta</h2>
            <p style={{ margin: "3px 0 0", color: C.muted, fontSize: 13 }}>Xem giá thị trường · Sổ lệnh · Giao dịch gần đây</p>
          </div>
          <button onClick={() => navigate("/farmer/orders")}
            style={{ padding: "9px 20px", background: C.accent, border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            📈 Đặt lệnh →
          </button>
        </div>

        {/* Pair cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          {isLoading
            ? PAIRS.map(p => (
                <div key={p} style={{ background: C.card, borderRadius: 10, height: 130, border: "1px solid " + C.border }} />
              ))
            : PAIRS.map(p => (
                <PairCard key={p} ticker={tickerMap[p] || { pair: p }} selected={selectedPair === p} onClick={() => setSelectedPair(p)} />
              ))}
        </div>

        {/* Detail: order book + recent trades */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

          {/* Order Book */}
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ padding: "11px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>📖 Sổ Lệnh — {selectedPair}</span>
              <span style={{ fontSize: 11, color: C.muted }}>Cập nhật mỗi 4s</span>
            </div>
            <div style={{ padding: "4px 0" }}>
              <OrderBookPanel pair={selectedPair} />
            </div>
            <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => navigate("/farmer/orders")}
                style={{ width: "100%", padding: "9px 0", background: "rgba(72,117,115,0.12)", border: `1px solid ${C.border}`, borderRadius: 7, color: C.tealLight, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                Giao dịch {selectedPair} →
              </button>
            </div>
          </div>

          {/* Recent trades + info */}
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ padding: "11px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700 }}>
                🔄 Giao Dịch Gần Đây — {selectedPair}
              </div>
              <div style={{ padding: "8px 14px" }}>
                <RecentTradesPanel pair={selectedPair} />
              </div>
            </div>

            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>ℹ️ Về {selectedPair}</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, marginBottom: 12 }}>{selectedMeta.desc}</div>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: C.muted }}>Giá hiện tại</span>
                  <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
                    {tickerMap[selectedPair]?.last_price ? fmt(tickerMap[selectedPair].last_price) + " VND/kg" : "Chưa có"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: C.muted }}>Khối lượng 24h</span>
                  <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
                    {tickerMap[selectedPair]?.volume ? fmt(tickerMap[selectedPair].volume, 2) + " kg" : "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: C.muted }}>Loại</span>
                  <span style={{ color: C.tealLight, fontWeight: 600 }}>☕ Robusta — {selectedMeta.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom info */}
        <div style={{ marginTop: 16, padding: "12px 18px", background: "rgba(72,117,115,0.05)", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
          📋 Giá và sổ lệnh được cập nhật real-time từ matching engine. Để đặt lệnh mua/bán, nhấn <strong style={{ color: C.tealLight }}>Đặt lệnh →</strong> hoặc vào menu <strong style={{ color: "#e2e8f0" }}>Chợ giao dịch</strong>.
        </div>

      </div>
    </FarmerLayout>
  );
}
