import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../utils/axiosClient";
import DashboardLayout from "../components/layout/DashboardLayout";
import LCReviewModal from "../components/common/LCReviewModal";
import { formatVND, formatKg } from "../utils/formatters";
import { LC_STATUS, LC_STATUS_LABELS, LC_PAYMENT_METHOD, LC_PAYMENT_METHOD_LABELS, LC_PAYMENT_STATUS, LC_PAYMENT_STATUS_LABELS, LC_DELIVERY_STATUS, LC_DELIVERY_STATUS_LABELS } from "../utils/lcStatus";

// Compact table styling — see AdminTokenDiscounting.jsx for the same pattern.
const th = { padding: "8px 10px", fontSize: 10.5, whiteSpace: "normal", lineHeight: 1.3, textAlign: "center" };
const thLeft = { ...th, textAlign: "left" };
const td = { padding: "7px 10px", fontSize: 12.5, textAlign: "center" };
const tdLeft = { ...td, textAlign: "left" };
const stickyCol = { position: "sticky", right: 0, background: "var(--card)", boxShadow: "-6px 0 8px -6px rgba(0,0,0,0.4)" };

export default function AdminLCContracts() {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/lc/admin/contracts");
      setItems(res.data?.data || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Không tải được danh sách hợp đồng");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmAction = async (reason) => {
    if (!modal) return;
    setSubmitting(true);
    try {
      const { action, item } = modal;
      if (action === "approve" || action === "reject") {
        await axios.patch(`/lc/admin/contracts/${item.id}/review`, { action, note: action === "reject" ? reason : undefined });
      } else if (action === "gather_lock") {
        await axios.post(`/lc/admin/contracts/${item.id}/gather-lock`);
      } else if (action === "settle_credit") {
        await axios.post(`/lc/admin/contracts/${item.id}/settle-credit`);
      } else if (action === "complete") {
        await axios.post(`/lc/admin/contracts/${item.id}/complete`);
      }
      setModal(null);
      load();
    } catch (e) {
      alert(e?.response?.data?.message || "Xử lý thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Nhận nông sản thực tế (L/C)">
      <div className="caro-page">

        <div className="caro-page-header">
          <div>
            <h1 className="caro-page-title">🏦 Nhận nông sản thực tế — Thư tín dụng số (L/C)</h1>
            <p className="caro-page-subtitle">Xét duyệt, gom & khóa Token, xác nhận tất toán tín dụng và hoàn tất các hợp đồng L/C</p>
          </div>
        </div>

        {err && <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#ef4444", marginBottom: 16 }}>{err}</div>}

        {loading ? (
          <div className="caro-empty"><div className="caro-empty-title">Đang tải dữ liệu...</div></div>
        ) : items.length === 0 ? (
          <div className="caro-empty caro-card">
            <div className="caro-empty-icon">📭</div>
            <h3 className="caro-empty-title">Chưa có hợp đồng L/C nào</h3>
          </div>
        ) : (
          <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="caro-table-wrap">
              <table className="caro-table" style={{ tableLayout: "auto" }}>
                <thead>
                  <tr>
                    <th style={thLeft}>Trader</th>
                    <th style={th}>Khối<br />lượng</th>
                    <th style={th}>Giá trị<br />hợp đồng</th>
                    <th style={th}>Ký quỹ</th>
                    <th style={th}>Ngân hàng<br />tài trợ</th>
                    <th style={th}>Token<br />đã khóa</th>
                    <th style={th}>Phương thức<br />thanh toán</th>
                    <th style={th}>Ngân hàng<br />đối tác</th>
                    <th style={th}>Thanh toán</th>
                    <th style={th}>Nhận hàng</th>
                    <th style={th}>Trạng thái</th>
                    <th style={{ ...th, ...stickyCol }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const s = LC_STATUS_LABELS[it.status] || { label: it.status, color: "#848e9c" };
                    const pay = LC_PAYMENT_STATUS_LABELS[it.payment_status] || { label: "—", color: "#848e9c" };
                    const del = LC_DELIVERY_STATUS_LABELS[it.delivery_status] || { label: "—", color: "#848e9c" };
                    const canSettleCredit = it.status === LC_STATUS.ACTIVE && it.payment_method === LC_PAYMENT_METHOD.DEFERRED && it.payment_status === LC_PAYMENT_STATUS.AWAITING_PAYMENT;
                    const canComplete = it.status === LC_STATUS.READY_TO_CLOSE;
                    return (
                      <tr key={it.id}>
                        <td style={tdLeft}>
                          <div style={{ fontWeight: 700, fontSize: 12.5 }}>{it.trader_name}</div>
                          <div style={{ fontSize: 10, color: "#64748b" }}>{it.trader_email}</div>
                        </td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{formatKg(it.requested_weight_kg)}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{formatVND(it.contract_value)}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{formatVND(it.deposit_amount)}</td>
                        <td style={{ ...td, fontFamily: "monospace", color: "#f0b90b" }}>{formatVND(it.bank_funding_amount)}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{it.total_token_locked ? formatKg(it.total_token_locked) : "—"}</td>
                        <td style={td}>{it.payment_method ? LC_PAYMENT_METHOD_LABELS[it.payment_method] : "—"}</td>
                        <td style={{ ...td, color: "#64748b" }}>{it.partner_bank || "—"}</td>
                        <td style={td}><span style={{ color: pay.color, fontWeight: 700, fontSize: 10.5 }}>{pay.label}</span></td>
                        <td style={td}><span style={{ color: del.color, fontWeight: 700, fontSize: 10.5 }}>{del.label}</span></td>
                        <td style={td}><span className="caro-badge" style={{ background: `${s.color}18`, color: s.color, fontWeight: 700, fontSize: 10.5 }}>{s.label}</span></td>
                        <td style={{ ...td, ...stickyCol }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                            <button className="caro-btn caro-btn-ghost caro-btn-sm" onClick={() => nav(`/admin/bank-sim/lc-contracts/${it.id}`)}>Chi tiết</button>
                            {it.status === LC_STATUS.PENDING_BANK_APPROVAL && (
                              <>
                                <button className="caro-btn caro-btn-primary caro-btn-sm" onClick={() => setModal({ action: "approve", item: it })}>Phê duyệt</button>
                                <button className="caro-btn caro-btn-danger caro-btn-sm" onClick={() => setModal({ action: "reject", item: it })}>Từ chối</button>
                              </>
                            )}
                            {it.status === LC_STATUS.BANK_APPROVED && (
                              <button className="caro-btn caro-btn-primary caro-btn-sm" onClick={() => setModal({ action: "gather_lock", item: it })}>Gom & Khóa Token</button>
                            )}
                            {canSettleCredit && (
                              <button className="caro-btn caro-btn-primary caro-btn-sm" onClick={() => setModal({ action: "settle_credit", item: it })}>Xác nhận tất toán</button>
                            )}
                            {canComplete && (
                              <button className="caro-btn caro-btn-primary caro-btn-sm" onClick={() => setModal({ action: "complete", item: it })}>Hoàn tất hợp đồng</button>
                            )}
                            {it.status === LC_STATUS.CLOSED && (
                              <button className="caro-btn caro-btn-ghost caro-btn-sm" disabled style={{ opacity: 0.6, cursor: "default" }}>Đã hoàn tất</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <LCReviewModal
          open={!!modal}
          action={modal?.action}
          item={modal?.item}
          submitting={submitting}
          onConfirm={confirmAction}
          onClose={() => !submitting && setModal(null)}
        />
      </div>
    </DashboardLayout>
  );
}
