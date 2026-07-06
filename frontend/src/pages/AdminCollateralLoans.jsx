import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../utils/axiosClient";
import DashboardLayout from "../components/layout/DashboardLayout";
import BankReviewModal from "../components/common/BankReviewModal";
import { formatVND, formatToken, formatPct } from "../utils/formatters";
import { LOAN_STATUS, LOAN_STATUS_LABELS } from "../utils/bankSimStatus";

// Compact table styling — many columns of financial data on one screen,
// tuned for readability during a live demo (small padding, centered
// numbers, wrapping headers instead of forcing single-line overflow).
const th = { padding: "8px 10px", fontSize: 10.5, whiteSpace: "normal", lineHeight: 1.3, textAlign: "center" };
const thLeft = { ...th, textAlign: "left" };
const td = { padding: "7px 10px", fontSize: 12.5, textAlign: "center" };
const tdLeft = { ...td, textAlign: "left" };
const stickyCol = { position: "sticky", right: 0, background: "var(--card)", boxShadow: "-6px 0 8px -6px rgba(0,0,0,0.4)" };

export default function AdminCollateralLoans() {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(null); // { action, item }
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/finance/admin/collateral-loans");
      setItems(res.data?.data || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Không tải được danh sách khoản vay");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmReview = async (reason) => {
    if (!modal) return;
    setSubmitting(true);
    try {
      await axios.patch(`/finance/admin/collateral-loans/${modal.item.id}`, {
        action: modal.action,
        note: modal.action === "reject" ? reason : undefined,
      });
      setModal(null);
      load();
    } catch (e) {
      alert(e?.response?.data?.message || "Xử lý thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Phê duyệt thế chấp">
      <div className="caro-page">

        <div className="caro-page-header">
          <div>
            <h1 className="caro-page-title">🏦 Phê duyệt thế chấp</h1>
            <p className="caro-page-subtitle">Xét duyệt khoản vay thế chấp Token của Ngân hàng</p>
          </div>
        </div>

        {err && <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#ef4444", marginBottom: 16 }}>{err}</div>}

        {loading ? (
          <div className="caro-empty"><div className="caro-empty-title">Đang tải dữ liệu...</div></div>
        ) : items.length === 0 ? (
          <div className="caro-empty caro-card">
            <div className="caro-empty-icon">📭</div>
            <h3 className="caro-empty-title">Chưa có khoản vay nào</h3>
          </div>
        ) : (
          <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="caro-table-wrap">
              <table className="caro-table" style={{ tableLayout: "auto" }}>
                <thead>
                  <tr>
                    <th style={thLeft}>Farmer</th>
                    <th style={th}>Token</th>
                    <th style={th}>Số lượng<br />Token</th>
                    <th style={th}>Giá thị<br />trường</th>
                    <th style={th}>Giá trị<br />tài sản</th>
                    <th style={th}>LTV</th>
                    <th style={th}>Haircut</th>
                    <th style={th}>Lãi suất</th>
                    <th style={th}>Thời hạn</th>
                    <th style={th}>Trạng thái</th>
                    <th style={{ ...th, ...stickyCol }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const s = LOAN_STATUS_LABELS[it.status] || { label: it.status, color: "#848e9c" };
                    const canDecide = it.status === LOAN_STATUS.PENDING;
                    const canDisburse = it.status === LOAN_STATUS.APPROVED;
                    const haircut = 1 - Number(it.ltv);
                    return (
                      <tr key={it.id}>
                        <td style={tdLeft}>
                          <div style={{ fontWeight: 700, fontSize: 12.5 }}>{it.farmer_name}</div>
                          <div style={{ fontSize: 10, color: "#64748b" }}>{it.farmer_email}</div>
                        </td>
                        <td style={{ ...td, fontWeight: 700 }}>{it.token_type}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{formatToken(it.quantity, "")}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{formatVND(it.market_price)}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{formatVND(it.collateral_value)}</td>
                        <td style={td}>{formatPct(Number(it.ltv) * 100, 1)}</td>
                        <td style={td}>{formatPct(haircut * 100, 1)}</td>
                        <td style={td}>{formatPct(Number(it.interest_rate) * 100, 1)}</td>
                        <td style={td}>{it.loan_term_months} tháng</td>
                        <td style={td}><span className="caro-badge" style={{ background: `${s.color}18`, color: s.color, fontWeight: 700, fontSize: 10.5 }}>{s.label}</span></td>
                        <td style={{ ...td, ...stickyCol }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                            <button className="caro-btn caro-btn-ghost caro-btn-sm" onClick={() => nav(`/admin/bank-sim/collateral-loans/${it.id}`)}>Chi tiết</button>
                            {canDecide && (
                              <>
                                <button className="caro-btn caro-btn-primary caro-btn-sm" onClick={() => setModal({ action: "approve", item: it })}>Phê duyệt</button>
                                <button className="caro-btn caro-btn-danger caro-btn-sm" onClick={() => setModal({ action: "reject", item: it })}>Từ chối</button>
                              </>
                            )}
                            {canDisburse && (
                              <button className="caro-btn caro-btn-primary caro-btn-sm" onClick={() => setModal({ action: "disburse", item: it })}>Giải ngân</button>
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

        <BankReviewModal
          open={!!modal}
          action={modal?.action}
          product="loan"
          item={modal?.item}
          submitting={submitting}
          onConfirm={confirmReview}
          onClose={() => !submitting && setModal(null)}
        />
      </div>
    </DashboardLayout>
  );
}
