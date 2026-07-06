import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../utils/axiosClient";
import DashboardLayout from "../components/layout/DashboardLayout";
import LCReviewModal from "../components/common/LCReviewModal";
import { formatVND, formatKg } from "../utils/formatters";
import {
  LC_STATUS, LC_STATUS_LABELS, LC_PAYMENT_METHOD, LC_PAYMENT_METHOD_LABELS,
  LC_PAYMENT_STATUS, LC_PAYMENT_STATUS_LABELS, LC_DELIVERY_STATUS, LC_DELIVERY_STATUS_LABELS,
  LC_ORACLE_COMPLETION_STATUS_LABELS, LC_ORACLE_CATEGORY, LC_ORACLE_CATEGORY_LABELS,
  LC_ORACLE_EVENTS, LC_ONBOARD_CODE, LC_REQUIRED_DOCUMENT_TYPES,
  lcDocumentTypeLabel, lcLifecycleSteps, lcCompletionBlockers, formatDueDate,
} from "../utils/lcStatus";

const CheckItem = ({ ok, label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 12.5, color: ok ? "#B0E4CC" : "#94a3b8" }}>
    <span style={{
      width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 9, fontWeight: 800, flexShrink: 0,
      background: ok ? "#B0E4CC" : "rgba(255,255,255,0.08)",
      color: ok ? "#06251a" : "#64748b",
      border: ok ? "none" : "1px solid rgba(255,255,255,0.15)",
    }}>{ok ? "✓" : ""}</span>
    <span style={{ fontWeight: ok ? 700 : 500 }}>{label}</span>
  </div>
);

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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 110 }}>
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
            {s.done && s.at && <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{formatDate(s.at)}</div>}
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 28, height: 2, background: steps[i + 1].done ? "#B0E4CC" : "rgba(255,255,255,0.1)", marginBottom: 24 }} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function AdminLCContractDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [c, setC] = useState(null);
  const [events, setEvents] = useState([]);
  const [tokenLocks, setTokenLocks] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Oracle event form state
  const [evCategory, setEvCategory] = useState(LC_ORACLE_CATEGORY.WAREHOUSE);
  const [evCode, setEvCode] = useState(LC_ORACLE_EVENTS[LC_ORACLE_CATEGORY.WAREHOUSE][0].code);
  const [evNote, setEvNote] = useState("");
  const [evSubmitting, setEvSubmitting] = useState(false);
  const [evMsg, setEvMsg] = useState(null);

  // Document upload form state
  const [docType, setDocType] = useState(LC_REQUIRED_DOCUMENT_TYPES[0].value);
  const [docFile, setDocFile] = useState(null);
  const [docSubmitting, setDocSubmitting] = useState(false);
  const [docMsg, setDocMsg] = useState(null);
  const [documents, setDocuments] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/lc/admin/contracts/${id}`);
      setC(res.data?.data || null);
      setEvents(res.data?.events || []);
      setTokenLocks(res.data?.tokenLocks || []);
      setHistory(res.data?.history || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Không tải được chi tiết hợp đồng");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadDocuments = useCallback(async () => {
    try {
      const res = await axios.get("/warehouse-documents", { params: { lc_contract_id: id } });
      setDocuments(res.data?.documents || []);
    } catch { /* no documents yet */ }
  }, [id]);

  useEffect(() => { load(); loadDocuments(); }, [load, loadDocuments]);

  const confirmAction = async (reason) => {
    if (!modal) return;
    setSubmitting(true);
    try {
      const { action } = modal;
      if (action === "approve" || action === "reject") {
        await axios.patch(`/lc/admin/contracts/${id}/review`, { action, note: action === "reject" ? reason : undefined });
      } else if (action === "gather_lock") {
        await axios.post(`/lc/admin/contracts/${id}/gather-lock`);
      } else if (action === "settle_credit") {
        await axios.post(`/lc/admin/contracts/${id}/settle-credit`);
      } else if (action === "complete") {
        await axios.post(`/lc/admin/contracts/${id}/complete`);
      }
      setModal(null);
      load();
    } catch (e) {
      alert(e?.response?.data?.message || "Xử lý thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const submitOracleEvent = async () => {
    setEvSubmitting(true);
    setEvMsg(null);
    try {
      await axios.post(`/lc/admin/contracts/${id}/oracle-events`, {
        category: evCategory,
        status_code: evCode,
        note: evNote || undefined,
      });
      setEvNote("");
      setEvMsg({ ok: true, text: "Đã ghi nhận cập nhật Oracle." });
      load();
    } catch (e) {
      setEvMsg({ ok: false, text: e?.response?.data?.message || "Ghi nhận thất bại" });
    } finally {
      setEvSubmitting(false);
    }
  };

  const submitDocument = async () => {
    if (!docFile) { setDocMsg({ ok: false, text: "Vui lòng chọn tệp cần tải lên" }); return; }
    setDocSubmitting(true);
    setDocMsg(null);
    try {
      const form = new FormData();
      form.append("file", docFile);
      form.append("document_type", docType);
      form.append("lc_contract_id", id);
      await axios.post("/warehouse-documents/upload", form);
      setDocFile(null);
      setDocMsg({ ok: true, text: "Đã tải lên chứng từ." });
      loadDocuments();
    } catch (e) {
      setDocMsg({ ok: false, text: e?.response?.data?.message || "Tải lên thất bại" });
    } finally {
      setDocSubmitting(false);
    }
  };

  if (loading) {
    return <DashboardLayout title="Chi tiết hợp đồng L/C"><div className="caro-page"><div className="caro-empty"><div className="caro-empty-title">Đang tải...</div></div></div></DashboardLayout>;
  }
  if (err || !c) {
    return <DashboardLayout title="Chi tiết hợp đồng L/C"><div className="caro-page"><div className="caro-empty caro-card"><div className="caro-empty-title">{err || "Không tìm thấy hợp đồng"}</div></div></div></DashboardLayout>;
  }

  const s = LC_STATUS_LABELS[c.status] || { label: c.status, color: "#848e9c" };
  const isRejected = c.status === LC_STATUS.REJECTED;
  const canDecide = c.status === LC_STATUS.PENDING_BANK_APPROVAL;
  const canGatherLock = c.status === LC_STATUS.BANK_APPROVED;
  const canOracle = c.status === LC_STATUS.ACTIVE;
  const canSettleCredit = c.status === LC_STATUS.ACTIVE && c.payment_method === LC_PAYMENT_METHOD.DEFERRED && c.payment_status === LC_PAYMENT_STATUS.AWAITING_PAYMENT;
  const canComplete = c.status === LC_STATUS.READY_TO_CLOSE;
  const completionBlockers = lcCompletionBlockers(c);

  // Granular breakdown of what "Oracle Completed" actually requires — shown
  // so the Admin can see exactly which item is still missing, instead of
  // just a generic "Chưa hoàn tất Oracle" message.
  const hasWarehouseEvent = events.some(e => e.category === "warehouse");
  const hasQualityEvent = events.some(e => e.category === "quality");
  const logisticsEvents = events.filter(e => e.category === "logistics");
  const isOnboard = logisticsEvents.length > 0 && logisticsEvents[logisticsEvents.length - 1].status_code === LC_ONBOARD_CODE;
  const uploadedDocTypes = new Set(documents.map(d => d.document_type));
  const missingDocs = LC_REQUIRED_DOCUMENT_TYPES.filter(t => !uploadedDocTypes.has(t.value));

  return (
    <DashboardLayout title="Chi tiết hợp đồng L/C">
      <div className="caro-page">

        <div className="caro-page-header">
          <div>
            <button className="caro-btn caro-btn-ghost caro-btn-sm" onClick={() => nav("/admin/bank-sim/lc-contracts")} style={{ marginBottom: 10 }}>← Danh sách</button>
            <h1 className="caro-page-title">🏦 Hợp đồng L/C #{c.id}</h1>
            <p className="caro-page-subtitle">Ngân hàng tài trợ, gom & khóa Token, giám sát Oracle và xác nhận tất toán/hoàn tất theo phương thức thanh toán của Trader</p>
          </div>
        </div>

        {/* ── Lifecycle stepper ── */}
        <div className="caro-card" style={{ marginBottom: 20, overflowX: "auto" }}>
          <div className="caro-section-title" style={{ marginBottom: 14 }}>VÒNG ĐỜI HỢP ĐỒNG</div>
          <LifecycleStepper steps={lcLifecycleSteps(c)} rejected={isRejected} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

          <div style={{ display: "grid", gap: 16 }}>
            <div className="caro-card">
              <div className="caro-section-title" style={{ marginBottom: 12 }}>THÔNG TIN TRADER</div>
              <Row l="Họ tên" v={c.trader_name} />
              <Row l="Email" v={c.trader_email} />
              <Row l="Điện thoại" v={c.trader_phone || "—"} />
            </div>

            <div className="caro-card">
              <div className="caro-section-title" style={{ marginBottom: 12 }}>THÔNG TIN HỢP ĐỒNG</div>
              <Row l="Khối lượng yêu cầu" v={formatKg(c.requested_weight_kg)} />
              <Row l="Đơn giá tham chiếu" v={`${formatVND(c.unit_price)}/kg`} />
              <Row l="Giá trị hợp đồng" v={formatVND(c.contract_value)} highlight="#f0b90b" />
              <Row l="Tỷ lệ ký quỹ" v={`${(Number(c.deposit_rate) * 100).toFixed(2)}%`} />
              <Row l="Ký quỹ (Trader)" v={formatVND(c.deposit_amount)} />
              <Row l="Ngân hàng tài trợ" v={formatVND(c.bank_funding_amount)} highlight="#B0E4CC" />
              <Row l="Trạng thái" v={s.label} highlight={s.color} />
              <Row l="Ngày tạo yêu cầu" v={formatDate(c.created_at)} />
              {c.processed_by_name && <Row l="Xử lý bởi (Ngân hàng)" v={c.processed_by_name} />}
            </div>

            {c.payment_method && (
              <div className="caro-card">
                <div className="caro-section-title" style={{ marginBottom: 12 }}>THÔNG TIN THANH TOÁN</div>
                <Row l="Phương thức" v={LC_PAYMENT_METHOD_LABELS[c.payment_method] || c.payment_method} />
                {c.payment_method === LC_PAYMENT_METHOD.DEFERRED && (
                  <>
                    <Row l="Ngân hàng đối tác" v={c.partner_bank} />
                    <Row l="Gói tài trợ" v={c.financing_plan} />
                    <Row l="Hạn thanh toán" v={formatDueDate(c.due_date)} />
                  </>
                )}
                <Row l="Trạng thái thanh toán" v={LC_PAYMENT_STATUS_LABELS[c.payment_status]?.label} highlight={LC_PAYMENT_STATUS_LABELS[c.payment_status]?.color} />
                <Row l="Trạng thái nhận hàng" v={LC_DELIVERY_STATUS_LABELS[c.delivery_status]?.label} highlight={LC_DELIVERY_STATUS_LABELS[c.delivery_status]?.color} />
                <Row l="Trạng thái Oracle (tổng thể)" v={LC_ORACLE_COMPLETION_STATUS_LABELS[c.oracle_completion_status]?.label} highlight={LC_ORACLE_COMPLETION_STATUS_LABELS[c.oracle_completion_status]?.color} />
              </div>
            )}

            {isRejected && c.rejection_reason && (
              <div className="caro-card" style={{ borderColor: "rgba(246,70,93,0.3)" }}>
                <div className="caro-section-title" style={{ marginBottom: 10, color: "#f6465d" }}>LÝ DO TỪ CHỐI</div>
                <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.6 }}>{c.rejection_reason}</div>
              </div>
            )}

            {/* Token gathered from multiple circulating holders */}
            <div className="caro-card">
              <div className="caro-section-title" style={{ marginBottom: 12 }}>TOKEN GOM TỪ CÁC VÍ LƯU HÀNH</div>
              {tokenLocks.length === 0 ? (
                <div style={{ fontSize: 13, color: "#64748b" }}>Ngân hàng chưa gom Token cho hợp đồng này.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {tokenLocks.map(tl => (
                    <div key={tl.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", fontSize: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{tl.source_user_name || tl.source_user_email}</div>
                        <div style={{ color: "#64748b", fontSize: 10.5 }}>{tl.token_type}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "monospace", fontWeight: 700 }}>{formatKg(tl.quantity)}</div>
                        <div style={{ color: "#B0E4CC", fontSize: 10.5, fontFamily: "monospace" }}>{formatVND(tl.payment_amount)}</div>
                      </div>
                    </div>
                  ))}
                  <Row l="Tổng Token đã khóa" v={formatKg(c.total_token_locked)} highlight="#B0E4CC" />
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gap: 16 }}>

            {/* Bank actions */}
            {(canDecide || canGatherLock || canSettleCredit) && (
              <div className="caro-card" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {canDecide && (
                  <>
                    <button className="caro-btn caro-btn-danger" style={{ flex: 1 }} onClick={() => setModal({ action: "reject" })}>Từ chối</button>
                    <button className="caro-btn caro-btn-primary" style={{ flex: 1 }} onClick={() => setModal({ action: "approve" })}>Phê duyệt</button>
                  </>
                )}
                {canGatherLock && (
                  <button className="caro-btn caro-btn-primary" style={{ flex: 1 }} onClick={() => setModal({ action: "gather_lock" })}>Gom & Khóa Token</button>
                )}
                {canSettleCredit && (
                  <button className="caro-btn caro-btn-primary" style={{ flex: 1 }} onClick={() => setModal({ action: "settle_credit" })}>Xác nhận tất toán tín dụng</button>
                )}
              </div>
            )}

            {/* Final completion — deliberately a separate confirmation step
                from the three conditions becoming true (see LC_STATUS.READY_TO_CLOSE) */}
            {(c.status === LC_STATUS.ACTIVE || c.status === LC_STATUS.READY_TO_CLOSE || c.status === LC_STATUS.CLOSED) && (
              <div className="caro-card">
                {c.status === LC_STATUS.CLOSED ? (
                  <button className="caro-btn caro-btn-ghost" disabled style={{ width: "100%", opacity: 0.6, cursor: "default" }}>Đã hoàn tất</button>
                ) : (
                  <>
                    <button
                      className="caro-btn caro-btn-primary"
                      style={{ width: "100%" }}
                      disabled={!canComplete}
                      onClick={() => setModal({ action: "complete" })}
                    >Hoàn tất hợp đồng</button>
                    {!canComplete && completionBlockers.length > 0 && (
                      <div style={{ marginTop: 10, fontSize: 12, color: "#f0b90b", fontWeight: 700 }}>
                        {completionBlockers.join(' · ')}
                      </div>
                    )}
                    {!canComplete && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 700, letterSpacing: "0.05em", marginBottom: 4, textTransform: "uppercase" }}>Chi tiết điều kiện còn thiếu</div>
                        <CheckItem ok={hasWarehouseEvent} label="Đã ghi nhận sự kiện Kho vận (Warehouse)" />
                        <CheckItem ok={hasQualityEvent} label="Đã ghi nhận sự kiện Kiểm định (Quality)" />
                        <CheckItem ok={isOnboard} label="Vận chuyển đã đến On-board (Logistics)" />
                        <CheckItem ok={missingDocs.length === 0} label={`Đủ chứng từ bắt buộc (${LC_REQUIRED_DOCUMENT_TYPES.length - missingDocs.length}/${LC_REQUIRED_DOCUMENT_TYPES.length})`} />
                        {missingDocs.length > 0 && (
                          <div style={{ fontSize: 11, color: "#64748b", marginLeft: 24, marginBottom: 4 }}>
                            Còn thiếu: {missingDocs.map(d => d.label).join(', ')}
                          </div>
                        )}
                        <CheckItem ok={c.payment_status === LC_PAYMENT_STATUS.COMPLETED} label="Đã hoàn tất thanh toán" />
                        <CheckItem ok={c.delivery_status === LC_DELIVERY_STATUS.DELIVERED} label="Đã xác nhận giao hàng" />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Oracle monitoring */}
            {canOracle && (
              <div className="caro-card">
                <div className="caro-section-title" style={{ marginBottom: 12 }}>GIÁM SÁT ORACLE — GHI NHẬN CẬP NHẬT</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <select value={evCategory} onChange={(e) => { const cat = e.target.value; setEvCategory(cat); setEvCode(LC_ORACLE_EVENTS[cat][0].code); }}
                    style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.03)", color: "#e2e8f0", fontSize: 12.5 }}>
                    {Object.values(LC_ORACLE_CATEGORY).map(cat => (
                      <option key={cat} value={cat}>{LC_ORACLE_CATEGORY_LABELS[cat]}</option>
                    ))}
                  </select>
                  <select value={evCode} onChange={(e) => setEvCode(e.target.value)}
                    style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.03)", color: "#e2e8f0", fontSize: 12.5 }}>
                    {LC_ORACLE_EVENTS[evCategory].map(ev => (
                      <option key={ev.code} value={ev.code}>{ev.label}</option>
                    ))}
                  </select>
                </div>
                <textarea value={evNote} onChange={(e) => setEvNote(e.target.value)} rows={2} placeholder="Ghi chú (tùy chọn)..."
                  style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.03)", color: "#e2e8f0", fontSize: 12.5, fontFamily: "inherit", resize: "vertical", marginBottom: 10 }} />
                <button className="caro-btn caro-btn-primary caro-btn-sm" disabled={evSubmitting} onClick={submitOracleEvent}>
                  {evSubmitting ? "Đang ghi nhận..." : "Ghi nhận cập nhật"}
                </button>
                {evMsg && <div style={{ marginTop: 8, fontSize: 12, color: evMsg.ok ? "#B0E4CC" : "#f6465d" }}>{evMsg.text}</div>}

                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginBottom: 8 }}>TẢI LÊN CHỨNG TỪ</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <select value={docType} onChange={(e) => setDocType(e.target.value)}
                      style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.03)", color: "#e2e8f0", fontSize: 12.5 }}>
                      {LC_REQUIRED_DOCUMENT_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                      style={{ fontSize: 11.5, color: "#94a3b8" }} />
                  </div>
                  <button className="caro-btn caro-btn-ghost caro-btn-sm" disabled={docSubmitting} onClick={submitDocument}>
                    {docSubmitting ? "Đang tải lên..." : "Tải lên chứng từ"}
                  </button>
                  {docMsg && <div style={{ marginTop: 8, fontSize: 12, color: docMsg.ok ? "#B0E4CC" : "#f6465d" }}>{docMsg.text}</div>}

                  {documents.length > 0 && (
                    <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                      {documents.map(doc => (
                        <div key={doc.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#94a3b8" }}>
                          <span>{lcDocumentTypeLabel(doc.document_type)}</span>
                          {doc.cid && <a href={`https://ipfs.io/ipfs/${doc.cid}`} target="_blank" rel="noreferrer" style={{ color: "#408A71" }}>Xem</a>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Oracle timeline */}
            <div className="caro-card">
              <div className="caro-section-title" style={{ marginBottom: 12 }}>NHẬT KÝ ORACLE (TIMELINE)</div>
              {events.length === 0 ? (
                <div style={{ fontSize: 13, color: "#64748b" }}>Chưa có cập nhật nào.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {events.map(ev => (
                    <div key={ev.id} style={{ fontSize: 12, padding: "8px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontWeight: 700, color: "#e2e8f0" }}>{ev.status_label}</span>
                        <span style={{ fontSize: 10, color: "#408A71" }}>{LC_ORACLE_CATEGORY_LABELS[ev.category] || ev.category}</span>
                      </div>
                      {ev.note && <div style={{ color: "#94a3b8", marginTop: 2 }}>{ev.note}</div>}
                      <div style={{ color: "#64748b", marginTop: 2, fontSize: 10.5 }}>{ev.created_by_name || "—"} · {formatDate(ev.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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

        <LCReviewModal
          open={!!modal}
          action={modal?.action}
          item={c}
          submitting={submitting}
          onConfirm={confirmAction}
          onClose={() => !submitting && setModal(null)}
        />
      </div>
    </DashboardLayout>
  );
}
