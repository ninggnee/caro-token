import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../utils/axiosClient";
import DashboardLayout from "../components/layout/DashboardLayout";
import BankReviewModal from "../components/common/BankReviewModal";
import { getMarketStats } from "../services/marketApi";
import { formatVND, formatToken, formatPct } from "../utils/formatters";
import { DISCOUNT_STATUS, DISCOUNT_STATUS_LABELS, discountTokenStatus, discountTokenStatusLabel, discountLifecycleSteps } from "../utils/bankSimStatus";

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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 100 }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800,
              background: s.done ? "#B0E4CC" : "rgba(255,255,255,0.08)",
              color: s.done ? "#06251a" : "#64748b",
              border: s.done ? "none" : "1px solid rgba(255,255,255,0.15)",
            }}>
              {s.done ? "✓" : i + 1}
            </div>
            <div style={{ fontSize: 10, color: s.done ? "#B0E4CC" : "#64748b", textAlign: "center", marginTop: 6, fontWeight: s.done ? 700 : 500, maxWidth: 110 }}>
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

export default function AdminTokenDiscountingDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [td, setTd] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [oraclePrice, setOraclePrice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/finance/admin/token-discounting/${id}`);
      setTd(res.data?.data || null);
      setHistory(res.data?.history || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Không tải được chi tiết giao dịch chiết khấu");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!td?.token_type) return;
    getMarketStats().then((data) => {
      const row = (data?.stats || []).find((s) => s.token === td.token_type);
      if (row) setOraclePrice(Number(row.last_price));
    }).catch(() => {});
  }, [td?.token_type]);

  const confirmReview = async (reason) => {
    if (!modal) return;
    setSubmitting(true);
    try {
      await axios.patch(`/finance/admin/token-discounting/${id}`, {
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
    return <DashboardLayout title="Chi tiết chiết khấu"><div className="caro-page"><div className="caro-empty"><div className="caro-empty-title">Đang tải...</div></div></div></DashboardLayout>;
  }
  if (err || !td) {
    return <DashboardLayout title="Chi tiết chiết khấu"><div className="caro-page"><div className="caro-empty caro-card"><div className="caro-empty-title">{err || "Không tìm thấy giao dịch"}</div></div></div></DashboardLayout>;
  }

  const s = DISCOUNT_STATUS_LABELS[td.status] || { label: td.status, color: "#848e9c" };
  const canDecide = td.status === DISCOUNT_STATUS.PENDING;
  const isRejected = td.status === DISCOUNT_STATUS.REJECTED;
  const haircutAmt = Number(td.nominal_value) - Number(td.payment_amount);
  const qty = Number(td.quantity);
  const price = Number(td.market_price);

  return (
    <DashboardLayout title="Chi tiết chiết khấu">
      <div className="caro-page">

        <div className="caro-page-header">
          <div>
            <button className="caro-btn caro-btn-ghost caro-btn-sm" onClick={() => nav("/admin/bank-sim/discounting")} style={{ marginBottom: 10 }}>← Danh sách</button>
            <h1 className="caro-page-title">🏦 Giao dịch chiết khấu #{td.id}</h1>
            <p className="caro-page-subtitle">Ngân hàng mua Token của Farmer theo giá chiết khấu — không phải khoản vay</p>
          </div>
        </div>

        {/* ── Lifecycle stepper ── */}
        <div className="caro-card" style={{ marginBottom: 20, overflowX: "auto" }}>
          <div className="caro-section-title" style={{ marginBottom: 14 }}>VÒNG ĐỜI GIAO DỊCH</div>
          <LifecycleStepper steps={discountLifecycleSteps(td)} rejected={isRejected} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

          <div style={{ display: "grid", gap: 16 }}>
            <div className="caro-card">
              <div className="caro-section-title" style={{ marginBottom: 12 }}>THÔNG TIN FARMER</div>
              <Row l="Họ tên" v={td.farmer_name} />
              <Row l="Email" v={td.farmer_email} />
              <Row l="Điện thoại" v={td.farmer_phone || "—"} />
              <Row l="Khu vực canh tác" v={td.farmer_farm_location || "—"} />
            </div>

            <div className="caro-card">
              <div className="caro-section-title" style={{ marginBottom: 12 }}>TÀI SẢN CHIẾT KHẤU</div>
              <Row l="Batch" v={td.batch_id || "— (chiết khấu theo số dư Token, không gắn Batch)"} />
              <Row l="Token" v={td.token_type} />
              <Row l="Khối lượng" v={formatToken(td.quantity, td.token_type)} />
              <Row l="Giá Token tại thời điểm tạo hồ sơ" v={`${formatVND(td.market_price)}/${td.token_type}`} />
              <Row l="Giá Oracle hiện tại" v={oraclePrice != null ? `${formatVND(oraclePrice)}/${td.token_type}` : "Đang tải..."} highlight={oraclePrice != null && oraclePrice !== price ? "#f0b90b" : undefined} />
              <Row l="Trạng thái Token" v={discountTokenStatusLabel(td.status)} highlight={discountTokenStatus(td.status) === "TRANSFERRED" ? "#B0E4CC" : discountTokenStatus(td.status) === "AVAILABLE" ? "#94a3b8" : "#f0b90b"} />
            </div>

            {/* ── Formula breakdown ── */}
            <div className="caro-card">
              <div className="caro-section-title" style={{ marginBottom: 12 }}>CÔNG THỨC TÍNH</div>
              <div style={{ fontSize: 12.5, color: "#cbd5e1", lineHeight: 2, fontFamily: "monospace" }}>
                <div>Giá trị danh nghĩa = Số lượng Token × Giá thị trường</div>
                <div style={{ color: "#f0b90b" }}>
                  = {formatToken(qty, td.token_type)} × {formatVND(price)} = <b>{formatVND(td.nominal_value)}</b>
                </div>
                <div style={{ marginTop: 10 }}>Giá trị Haircut = Giá trị danh nghĩa × Haircut</div>
                <div style={{ color: "#f6465d" }}>
                  = {formatVND(td.nominal_value)} × {formatPct(Number(td.haircut) * 100, 0)} = <b>{formatVND(haircutAmt)}</b>
                </div>
                <div style={{ marginTop: 10 }}>Số tiền Ngân hàng thanh toán = Giá trị danh nghĩa − Giá trị Haircut</div>
                <div style={{ color: "#B0E4CC" }}>
                  = {formatVND(td.nominal_value)} − {formatVND(haircutAmt)} = <b>{formatVND(td.payment_amount)}</b>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <div className="caro-card">
              <div className="caro-section-title" style={{ marginBottom: 12 }}>THÔNG TIN CHIẾT KHẤU</div>
              <Row l="Ngân hàng" v={td.bank_name} />
              <Row l="Haircut" v={formatPct(Number(td.haircut) * 100, 0)} highlight="#f6465d" />
              <Row l="Tỷ lệ giải ngân" v={formatPct(Number(td.discount_ratio) * 100, 0)} highlight="#B0E4CC" />
              <Row l="Giá trị danh nghĩa" v={formatVND(td.nominal_value)} />
              <Row l="Giá trị Haircut" v={`− ${formatVND(haircutAmt)}`} highlight="#f6465d" />
              <Row l="Số tiền Ngân hàng thanh toán" v={formatVND(td.payment_amount)} highlight="#B0E4CC" />
              <Row l="Thời gian tạo hồ sơ" v={formatDate(td.created_at)} />
              <Row l="Trạng thái" v={s.label} highlight={s.color} />
              {td.completed_at && <Row l="Thời gian hoàn tất" v={formatDate(td.completed_at)} highlight="#B0E4CC" />}
              {td.processed_by_name && <Row l="Xử lý bởi (Ngân hàng)" v={td.processed_by_name} />}
              {td.ownership_transfer_tx && <Row l="Mã chuyển nhượng Token" v={td.ownership_transfer_tx} />}
            </div>

            {isRejected && (td.rejection_reason || td.admin_note) && (
              <div className="caro-card" style={{ borderColor: "rgba(246,70,93,0.3)" }}>
                <div className="caro-section-title" style={{ marginBottom: 10, color: "#f6465d" }}>LÝ DO TỪ CHỐI</div>
                <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.6 }}>{td.rejection_reason || td.admin_note}</div>
              </div>
            )}

            {canDecide && (
              <div className="caro-card" style={{ display: "flex", gap: 12 }}>
                <button className="caro-btn caro-btn-danger" style={{ flex: 1 }} onClick={() => setModal({ action: "reject" })}>Từ chối</button>
                <button className="caro-btn caro-btn-primary" style={{ flex: 1 }} onClick={() => setModal({ action: "approve" })}>Duyệt & Thanh toán</button>
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
          product="discount"
          item={td}
          submitting={submitting}
          onConfirm={confirmReview}
          onClose={() => !submitting && setModal(null)}
        />
      </div>
    </DashboardLayout>
  );
}
