import React from "react";

export default function OrderBook({ bids = [], asks = [] }) {
  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: 0 }}>Bids</h4>
        <div style={{ background: "#0f1619", padding: 8, marginTop: 8 }}>
          <table style={{ width: "100%" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#8fb" }}>
                <th>Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((b, i) => (
                <tr key={i} style={{ color: "#9f9" }}>
                  <td>{b.price}</td>
                  <td>{b.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <h4 style={{ margin: 0 }}>Asks</h4>
        <div style={{ background: "#0f1619", padding: 8, marginTop: 8 }}>
          <table style={{ width: "100%" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#f88" }}>
                <th>Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {asks.map((a, i) => (
                <tr key={i} style={{ color: "#f99" }}>
                  <td>{a.price}</td>
                  <td>{a.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
