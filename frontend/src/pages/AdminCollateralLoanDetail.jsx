import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../utils/axiosClient";
import DashboardLayout from "../components/layout/DashboardLayout";
import BankReviewModal from "../components/common/BankReviewModal";
import { getMarketStats } from "../services/marketApi";
import { formatVND, formatToken, formatPct } from "../utils/formatters";
import { LOAN_STATUS, LOAN_STATUS_LABELS, loanTokenStatus, loanTokenStatusLabel, loanLifecycleSteps } from "../utils/bankSimStatus";

function formatDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const Row = ({ l, v, highlight }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
    <span style={{ color: "#94a3b8" }}>{l}</span>
    <span style={{ fontWeight: 700, color: highlight || "#e2e8f0", fontFamily: "monospace" }}>{v}</span>
  </div>
);

function LifecycleStepper({ steps, rejected }) {
  if (rejected) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#f6465d", fontWeight: 700 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f6465d" }} />
        Chờ Ngân hàng duyệt → Đã từ chối
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 0, alignItems: "center" }}>
      {steps.map((s, i) => (
        <div key={s.key} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 84 }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800,
              background: s.done ? "#B0E4CC" : "rgba(255,255,255,0.08)",
              color: s.done ? "#06251a" : "#64748b",
              border: s.done ? "none" : "1px solid rgba(255,255,255,0.15)",
            }}>
              {s.done ? "✓" : i + 1}
            </div>
            <div style={{ fontSize: 10, color: s.done ? "#B0E4CC" : "#64748b", textAlign: "center", marginTop: 6, fontWeight: s.done ? 700 : 500, maxWidth: 90 }}>
              {s.label}
            </div>
            {s.done && s.at && (
              <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{formatDate(s.at)}</div>
            )}
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 28, height: 2, background: steps[i + 1].done ? "#B0E4CC" : "rgba(255,255,255,0.1)", marginBottom: 24 }} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function AdminCollateralLoanDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [loan, setLoan] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [oraclePrice, setOraclePrice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/finance/admin/collateral-loans/${id}`);
      setLoan(res.data?.data || null);
      setHistory(res.data?.history || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Không tải được chi tiết khoản vay");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Live Oracle/market price — independent of the price stored on the loan
  // (which was locked in at the moment the farmer submitted the request).
  // Shown side-by-side so the bank can see if the collateral's value has
  // since moved.
  useEffect(() => {
    if (!loan?.token_type) return;
    getMarketStats().then((data) => {
      const row = (data?.stats || []).find((s) => s.token === loan.token_type);
      if (row) setOraclePrice(Number(row.last_price));
    }).catch(() => {});
  }, [loan?.token_type]);

  const confirmReview = async (reason) => {
    if (!modal) return;
    setSubmitting(true);
    try {
      await axios.patch(`/finance/admin/collateral-loans/${id}`, {
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

  if (loading) {
    return <DashboardLayout title="Chi tiết khoản vay"><div className="caro-page"><div className="caro-empty"><div className="caro-empty-title">Đang tải...</div></div></div></DashboardLayout>;
  }
  if (err || !loan) {
    return <DashboardLayout title="Chi tiết khoản vay"><div className="caro-page"><div className="caro-empty caro-card"><div className="caro-empty-title">{err || "Không tìm thấy khoản vay"}</div></div></div></DashboardLayout>;
  }

  const s = LOAN_STATUS_LABELS[loan.status] || { label: loan.status, color: "#848e9c" };
  const canDecide = loan.status === LOAN_STATUS.PENDING;
  const canDisburse = loan.status === LOAN_STATUS.APPROVED;
  const isRejected = loan.status === LOAN_STATUS.REJECTED;

  const qty   = Number(loan.quantity);
  const price = Number(loan.market_price);
  const ltv   = Number(loan.ltv);
  const haircut = 1 - ltv; // derived — LTV and Haircut are complementary; no separate column needed.

  // Interest amount / total repayment are not separate stored columns — the
  // saved interest_rate/max_loan_amount/loan_term_months (fixed at creation,
  // never regenerated here) are just multiplied out for display.
  const annualInterest = Number(loan.max_loan_amount) * Number(loan.interest_rate);
  const termInterest   = annualInterest * (Number(loan.loan_term_months) / 12);
  const totalRepay     = Number(loan.max_loan_amount) + termInterest;

  return (
    <DashboardLayout title="Chi tiết khoản vay">
      <div className="caro-page">

        <div className="caro-page-header">
          <div>
            <button className="caro-btn caro-btn-ghost caro-btn-sm" onClick={() => nav("/admin/bank-sim/collateral-loans")} style={{ marginBottom: 10 }}>← Danh sách</button>
            <h1 className="caro-page-title">🏦 Khoản vay #{loan.id}</h1>
            <p className="caro-page-subtitle">Xét duyệt khoản vay thế chấp Token của Ngân hàng</p>
          </div>
        </div>

        {/* ── Lifecycle stepper ── */}
        <div className="caro-card" style={{ marginBottom: 20, overflowX: "auto" }}>
          <div className="caro-section-title" style={{ marginBottom: 14 }}>VÒNG ĐỜI KHOẢN VAY</div>
          <LifecycleStepper steps={loanLifecycleSteps(loan)} rejected={isRejected} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

          <div style={{ display: "grid", gap: 16 }}>
            <div className="caro-card">
              <div className="caro-section-title" style={{ marginBottom: 12 }}>THÔNG TIN FARMER</div>
              <Row l="Họ tên" v={loan.farmer_name} />
              <Row l="Email" v={loan.farmer_email} />
              <Row l="Điện thoại" v={loan.farmer_phone || "—"} />
              <Row l="Khu vực canh tác" v={loan.farmer_farm_location || "—"} />
            </div>

            <div className="caro-card">
              <div className="caro-section-title" style={{ marginBottom: 12 }}>TÀI SẢN THẾ CHẤP</div>
              <Row l="Token" v={loan.token_type} />
              <Row l="Khối lượng" v={formatToken(loan.quantity, loan.token_type)} />
              <Row l="Giá Token tại thời điểm tạo hồ sơ" v={`${formatVND(loan.market_price)}/${loan.token_type}`} />
              <Row l="Giá Oracle hiện tại" v={oraclePrice != null ? `${formatVND(oraclePrice)}/${loan.token_type}` : "Đang tải..."} highlight={oraclePrice != null && oraclePrice !== price ? "#f0b90b" : undefined} />
              <Row l="Giá trị tài sản" v={formatVND(loan.collateral_value)} highlight="#f0b90b" />
              <Row l="Haircut (suy ra từ LTV)" v={formatPct(haircut * 100, 1)} />
              <Row l="Trạng thái Token" v={loanTokenStatusLabel(loan.status)} highlight={loanTokenStatus(loan.status) === "PLEDGED" ? "#f0b90b" : "#B0E4CC"} />
            </div>

            {/* ── Formula breakdown ── */}
            <div className="caro-card">
              <div className="caro-section-title" style={{ marginBottom: 12 }}>CÔNG THỨC TÍNH</div>
              <div style={{ fontSize: 12.5, color: "#cbd5e1", lineHeight: 2, fontFamily: "monospace" }}>
                <div>Giá trị tài sản = Số lượng Token × Giá Token</div>
                <div style={{ color: "#f0b90b" }}>
                  = {formatToken(qty, loan.token_type)} × {formatVND(price)} = <b>{formatVND(qty * price)}</b>
                </div>
                <div style={{ marginTop: 10 }}>Hạn mức vay = Giá trị tài sản × LTV</div>
                <div style={{ color: "#B0E4CC" }}>
                  = {formatVND(qty * price)} × {formatPct(ltv * 100, 1)} = <b>{formatVND(loan.max_loan_amount)}</b>
                </div>
                <div style={{ marginTop: 10 }}>Tiền lãi = Hạn mức vay × Lãi suất/năm × (Kỳ hạn / 12)</div>
                <div style={{ color: "#f6465d" }}>
                  = {formatVND(loan.max_loan_amount)} × {formatPct(Number(loan.interest_rate) * 100, 1)} × ({loan.loan_term_months}/12) = <b>{formatVND(termInterest)}</b>
                </div>
                <div style={{ marginTop: 10 }}>Tổng hoàn trả = Hạn mức vay + Tiền lãi</div>
                <div style={{ color: "#f77f00" }}>
                  = {formatVND(loan.max_loan_amount)} + {formatVND(termInterest)} = <b>{formatVND(totalRepay)}</b>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <div className="caro-card">
              <div className="caro-section-title" style={{ marginBottom: 12 }}>KHOẢN VAY</div>
              <Row l="Tỉ lệ LTV" v={formatPct(ltv * 100, 1)} />
              <Row l="Lãi suất/năm (đã lưu khi tạo đơn)" v={formatPct(Number(loan.interest_rate) * 100, 1)} highlight="#B0E4CC" />
              <Row l="Hạn mức vay" v={formatVND(loan.max_loan_amount)} highlight="#B0E4CC" />
              <Row l="Tiền lãi" v={formatVND(termInterest)} highlight="#f6465d" />
              <Row l="Tổng hoàn trả" v={formatVND(totalRepay)} highlight="#f77f00" />
              <Row l="Kỳ hạn" v={`${loan.loan_term_months} tháng`} />
              <Row l="Thời gian tạo hồ sơ" v={formatDate(loan.created_at)} />
              <Row l="Trạng thái" v={s.label} highlight={s.color} />
              {loan.approved_at && <Row l="Thời gian phê duyệt" v={formatDate(loan.approved_at)} />}
              {loan.disbursed_at && <Row l="Thời gian giải ngân" v={formatDate(loan.disbursed_at)} highlight="#B0E4CC" />}
              {loan.disbursement_id && <Row l="Mã giải ngân" v={loan.disbursement_id} />}
              {loan.repaid_at && <Row l="Thời gian tất toán" v={formatDate(loan.repaid_at)} highlight="#487573" />}
              {loan.processed_by_name && <Row l="Xử lý bởi (Ngân hàng)" v={loan.processed_by_name} />}
            </div>

            {isRejected && (loan.rejection_reason || loan.admin_note) && (
              <div className="caro-card" style={{ borderColor: "rgba(246,70,93,0.3)" }}>
                <div className="caro-section-title" style={{ marginBottom: 10, color: "#f6465d" }}>LÝ DO TỪ CHỐI</div>
                <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.6 }}>{loan.rejection_reason || loan.admin_note}</div>
              </div>
            )}

            {canDecide && (
              <div className="caro-card" style={{ display: "flex", gap: 12 }}>
                <button className="caro-btn caro-btn-danger" style={{ flex: 1 }} onClick={() => setModal({ action: "reject" })}>Từ chối</button>
                <button className="caro-btn caro-btn-primary" style={{ flex: 1 }} onClick={() => setModal({ action: "approve" })}>Phê duyệt</button>
              </div>
            )}
            {canDisburse && (
              <div className="caro-card">
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>Khoản vay đã được phê duyệt — sẵn sàng giải ngân vào ví CaRo của Farmer.</div>
                <button className="caro-btn caro-btn-primary" style={{ width: "100%" }} onClick={() => setModal({ action: "disburse" })}>Giải ngân</button>
              </div>
            )}

            <div className="caro-card">
              <div className="caro-section-title" style={{ marginBottom: 12 }}>LỊCH SỬ XỬ LÝ</div>
              {history.length === 0 ? (
                <div style={{ fontSize: 13, color: "#64748b" }}>Chưa có hành động xử lý nào.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {history.map(h => (
                    <div key={h.id} style={{ fontSize: 12, padding: "8px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ fontWeight: 700, color: "#e2e8f0" }}>{h.action}</div>
                      <div style={{ color: "#94a3b8", marginTop: 2 }}>
                        Thực hiện bởi <b>{h.actor_name || h.actor_email || "—"}</b> · {formatDate(h.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <BankReviewModal
          open={!!modal}
          action={modal?.action}
          product="loan"
          item={loan}
          submitting={submitting}
          onConfirm={confirmReview}
          onClose={() => !submitting && setModal(null)}
        />
      </div>
    </DashboardLayout>
  );
}
