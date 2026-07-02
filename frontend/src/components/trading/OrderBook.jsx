import React from "react";
import { formatNumber, formatVND } from '../../utils/formatters';

const C = {
  green:  "#B0E4CC",
  red:    "#f6465d",
  muted:  "#848e9c",
  border: "rgba(255,255,255,0.08)",
};

export default function OrderBook({ bids = [], asks = [], lastPrice }) {
  const maxBid = Math.max(...bids.map(b => b.amount), 1);
  const maxAsk = Math.max(...asks.map(a => a.amount), 1);
  const levels = Math.max(bids.length, asks.length, 5);

  return (
    <div style={{ fontFamily: "monospace", fontSize: 12 }}>
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: "5px 10px", color: C.muted, fontSize: 10, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>
        <span>KL (Mua)</span>
        <span style={{ textAlign: "right" }}>Giá Mua</span>
        <span style={{ paddingLeft: 10 }}>Giá Bán</span>
        <span style={{ textAlign: "right" }}>KL (Bán)</span>
      </div>

      {/* Rows */}
      {Array.from({ length: levels }, (_, i) => {
        const bid  = bids[i];
        const ask  = asks[i];
        const bPct = bid ? (bid.amount / maxBid) * 100 : 0;
        const aPct = ask ? (ask.amount / maxAsk) * 100 : 0;

        return (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", height: 26 }}>

            {/* Bid qty */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", padding: "0 10px", overflow: "hidden" }}>
              <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: `${bPct}%`, background: "rgba(14,203,129,0.1)" }} />
              <span style={{ color: C.muted, fontSize: 11, position: "relative", zIndex: 1 }}>
                {bid ? formatNumber(bid.amount) : ""}
              </span>
            </div>

            {/* Bid price */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 10px" }}>
              <span style={{ color: C.green, fontSize: 11, fontWeight: 600 }}>
                {bid ? formatNumber(bid.price) : ""}
              </span>
            </div>

            {/* Ask price */}
            <div style={{ display: "flex", alignItems: "center", padding: "0 10px", paddingLeft: 12, borderLeft: `1px solid ${C.border}` }}>
              <span style={{ color: C.red, fontSize: 11, fontWeight: 600 }}>
                {ask ? formatNumber(ask.price) : ""}
              </span>
            </div>

            {/* Ask qty */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 10px", overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${aPct}%`, background: "rgba(246,70,93,0.1)" }} />
              <span style={{ color: C.muted, fontSize: 11, position: "relative", zIndex: 1 }}>
                {ask ? formatNumber(ask.amount) : ""}
              </span>
            </div>

          </div>
        );
      })}

      {/* Last price strip */}
      {lastPrice != null && (
        <div style={{ padding: "7px 12px", background: "rgba(255,255,255,0.02)", borderTop: `1px solid ${C.border}`, textAlign: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#eaecef" }}>
            {formatVND(lastPrice)}
          </span>
        </div>
      )}
    </div>
  );
}
