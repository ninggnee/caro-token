import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import DashboardLayout from "../components/layout/DashboardLayout";
import {
  useAllBatches,
  useApproveBatch,
  useRejectBatch,
  useUpdateGrade,
  useBatchDocuments,
} from "../hooks/useBatches";

const C = { green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", accent: "#7fe0c9", muted: "#6b7a99" };

const TABS = [
  { key: "ALL",                   label: "Tất cả" },
  { key: "PENDING_MINT_APPROVAL", label: "Chờ duyệt" },
  { key: "MINTED",                label: "Đã Mint" },
  { key: "REJECTED",              label: "Bị từ chối" },
];

const STATUS_META = {
  PENDING_MINT_APPROVAL: { label: "Chờ duyệt",  color: C.gold,   bg: "rgba(240,185,11,0.12)"  },
  APPROVED:              { label: "Đã duyệt", color: C.accent, bg: "rgba(127,224,201,0.12)"   },
  MINTED:                { label: "Đã Mint",   color: C.green,  bg: "rgba(14,203,129,0.12)"  },
  REJECTED:              { label: "Bị từ chối", color: C.red,    bg: "rgba(246,70,93,0.12)"   },
};

const QG_TO_GRADE = { CR1: "A", CR2: "B", CR3: "C" };
const GRADE_TO_QG = { A: "CR1", B: "CR2", C: "CR3" };

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: C.muted, bg: "rgba(255,255,255,0.06)" };
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

function GradeBadge({ qg }) {
  const g = QG_TO_GRADE[qg];
  if (!g) return <span style={{ color: C.muted, fontSize: 12 }}>—</span>;
  const colors = { A: C.green, B: C.accent, C: C.gold };
  return (
    <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: `${colors[g]}18`, color: colors[g] }}>
      {g}
    </span>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────────

function RejectModal({ batch, onClose, onConfirm, isPending }) {
  const [reason, setReason] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#172524", border: "1px solid rgba(72,117,115,0.2)", borderRadius: 12, padding: 28, width: 460, maxWidth: "90vw" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#7fe0c9" }}>Từ chối lô hàng — {batch.batch_id}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
          {batch.farmer_name} · {Number(batch.quantity).toLocaleString()} kg · {batch.quality_grade}
        </div>
        <label style={{ display: "block", fontSize: 12, color: C.accent, marginBottom: 6, fontWeight: 600 }}>Lý do từ chối *</label>
        <textarea
          value={reason} onChange={(e) => setReason(e.target.value)} rows={4}
          placeholder="VD: Tài liệu thiếu minh chứng · Sai lệch khối lượng thực tế · Kiểm định không đạt chuẩn chất lượng..."
          style={{ width: "100%", padding: "10px 12px", background: "#0d1413", border: "1px solid rgba(72,117,115,0.2)", borderRadius: 8, color: "#e2e8f0", fontSize: 13, resize: "vertical", boxSizing: "border-box", outline: "none" }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(72,117,115,0.15)", color: "#9aa5b4", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Hủy</button>
          <button onClick={() => reason.trim() && onConfirm(reason)} disabled={!reason.trim() || isPending}
            style={{ padding: "9px 20px", background: !reason.trim() || isPending ? "#555" : C.red, border: "none", color: "#fff", borderRadius: 8, fontWeight: 700, cursor: !reason.trim() || isPending ? "not-allowed" : "pointer", fontSize: 13 }}>
            {isPending ? "Đang xử lý…" : "Xác nhận từ chối"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ApproveModal({ batch, onClose, onConfirm, isPending }) {
  const [grade, setGrade] = useState(QG_TO_GRADE[batch.quality_grade] || "");
  const gradeColors = { A: C.green, B: C.accent, C: C.gold };
  const tokenType = GRADE_TO_QG[grade] || "—";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#172524", border: "1px solid rgba(72,117,115,0.2)", borderRadius: 12, padding: 28, width: 480, maxWidth: "90vw" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#7fe0c9" }}>Phê duyệt & Mint — {batch.batch_id}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>

        {/* Batch info */}
        <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(72,117,115,0.15)", borderRadius: 8, padding: "12px 14px", marginBottom: 18, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
            <span style={{ color: C.muted }}>Nông dân</span>
            <span style={{ fontWeight: 600 }}>{batch.farmer_name || "—"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
            <span style={{ color: C.muted }}>Địa chỉ ví</span>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: C.accent }}>
              {batch.farmer_wallet ? `${batch.farmer_wallet.slice(0,8)}…${batch.farmer_wallet.slice(-6)}` : "Chưa liên kết ví ⚠️"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: C.muted }}>Khối lượng cà phê</span>
            <span style={{ fontWeight: 600 }}>{Number(batch.quantity).toLocaleString()} kg</span>
          </div>
        </div>

        {/* Grade selector — REQUIRED */}
        <label style={{ display: "block", fontSize: 12, color: C.accent, fontWeight: 600, marginBottom: 8 }}>
          Phân loại Grade * <span style={{ color: C.muted, fontWeight: 400 }}>(bắt buộc chọn trước khi phê duyệt)</span>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
          {["A", "B", "C"].map((g) => (
            <button key={g} onClick={() => setGrade(g)}
              style={{ padding: "14px 8px", borderRadius: 8, border: grade === g ? `2px solid ${gradeColors[g]}` : "1px solid rgba(72,117,115,0.15)", background: grade === g ? `${gradeColors[g]}15` : "rgba(255,255,255,0.01)", color: grade === g ? gradeColors[g] : "#e2e8f0", cursor: "pointer", transition: "all 0.15s", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{g}</div>
              <div style={{ fontSize: 10, color: grade === g ? gradeColors[g] : C.muted, marginTop: 2 }}>
                {g === "A" ? "CR1 · Premium" : g === "B" ? "CR2 · Standard" : "CR3 · Basic"}
              </div>
            </button>
          ))}
        </div>

        {/* Mint preview */}
        {grade && (
          <div style={{ background: `${gradeColors[grade]}10`, border: `1px solid ${gradeColors[grade]}30`, borderRadius: 8, padding: "12px 14px", marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Sẽ phát hành (Mint)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: gradeColors[grade] }}>
              {Number(batch.quantity).toLocaleString()} token {tokenType}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>→ đến ví giao dịch nội bộ của nông dân</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(72,117,115,0.15)", color: "#9aa5b4", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Hủy</button>
          <button onClick={() => grade && onConfirm(grade)} disabled={!grade || isPending}
            style={{ padding: "9px 24px", background: !grade || isPending ? "#555" : C.green, border: "none", color: !grade || isPending ? C.muted : "#000", borderRadius: 8, fontWeight: 700, cursor: !grade || isPending ? "not-allowed" : "pointer", fontSize: 13 }}>
            {isPending ? "Đang Mint…" : "Duyệt & Mint Token"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentsPanel({ batchId }) {
  const { data, isLoading } = useBatchDocuments(batchId);
  const docs = data?.documents || [];
  if (isLoading) return <div style={{ padding: "10px 16px", color: C.muted, fontSize: 12 }}>Đang tải tài liệu…</div>;
  if (!docs.length)  return <div style={{ padding: "10px 16px", color: C.muted, fontSize: 12 }}>Không có tài liệu chứng minh</div>;

  const grouped = {};
  for (const d of docs) {
    if (!grouped[d.document_type]) grouped[d.document_type] = [];
    grouped[d.document_type].push(d);
  }
  return (
    <div style={{ padding: "12px 16px", background: "rgba(0,0,0,0.15)", borderRadius: 8, border: "1px solid rgba(72,117,115,0.1)" }}>
      {Object.entries(grouped).map(([type, files]) => (
        <div key={type} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: C.accent, fontWeight: 600, marginBottom: 4 }}>{type}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {files.map((f) => (
              <div key={f.id} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: "4px 8px", fontSize: 11, border: "1px solid rgba(72,117,115,0.1)" }}>
                {f.ipfs_cid
                  ? <a href={`https://ipfs.io/ipfs/${f.ipfs_cid}`} target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "none", fontWeight: 500 }}>📄 {f.file_name} ↗</a>
                  : <span style={{ color: C.muted }}>📄 {f.file_name}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: "1px solid rgba(72,117,115,0.1)" }}>
      {[60, 120, 100, 80, 70, 60, 60, 80, 90].map((w, i) => (
        <td key={i} style={{ padding: "14px 16px" }}>
          <div style={{ height: 12, background: "rgba(72,117,115,0.08)", borderRadius: 4, width: w, animation: "pulse 1.5s infinite" }} />
        </td>
      ))}
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminMintRequestsPage() {
  const nav = useNavigate();
  const [activeTab,     setActiveTab]     = useState("ALL");
  const [page,          setPage]          = useState(1);
  const [search,        setSearch]        = useState("");
  const [searchInput,   setSearchInput]   = useState("");
  const [rejectTarget,  setRejectTarget]  = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [expandedDocs,  setExpandedDocs]  = useState(null);
  const [gradeOverride, setGradeOverride] = useState({});

  const approve     = useApproveBatch();
  const reject      = useRejectBatch();
  const updateGrade = useUpdateGrade();

  const statusFilter = activeTab === "ALL" ? undefined : activeTab;

  const { data, isLoading, isError, refetch } = useAllBatches({
    status: statusFilter, search: search || undefined, page, limit: 10,
  });

  const batches = data?.batches || [];
  const total   = data?.total   || 0;

  const handleTabChange = (tab) => { setActiveTab(tab); setPage(1); setSearch(""); setSearchInput(""); };
  const handleSearch    = () => { setSearch(searchInput.trim()); setPage(1); };
  const handleClear     = () => { setSearch(""); setSearchInput(""); setPage(1); };

  const handleGradeChange = (batch, grade) => {
    setGradeOverride(prev => ({ ...prev, [batch.id]: grade }));
    updateGrade.mutate({ id: batch.id, grade });
  };

  const handleApproveConfirm = (grade) => {
    approve.mutate(
      { id: approveTarget.id, grade },
      { onSettled: () => setApproveTarget(null) }
    );
  };

  const handleRejectConfirm = (reason) => {
    reject.mutate(
      { id: rejectTarget.id, reason },
      { onSettled: () => setRejectTarget(null) }
    );
  };

  return (
    <DashboardLayout title="Lô hàng Farmer">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {rejectTarget && (
        <RejectModal batch={rejectTarget} onClose={() => setRejectTarget(null)}
          onConfirm={handleRejectConfirm} isPending={reject.isPending} />
      )}
      {approveTarget && (
        <ApproveModal batch={approveTarget} onClose={() => setApproveTarget(null)}
          onConfirm={handleApproveConfirm} isPending={approve.isPending} />
      )}

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>📦 Lô hàng từ Nông dân</h2>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>Tổng số: {total} lô hàng · Phê duyệt hồ sơ chất lượng và phát hành (Mint) token RWA</p>
      </div>

      {/* Tabs + search */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid rgba(72,117,115,0.15)", paddingBottom: 0, flexWrap: "wrap", alignItems: "flex-end" }}>
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => handleTabChange(tab.key)}
            style={{ padding: "9px 18px", background: "none", border: "none", borderBottom: activeTab === tab.key ? `2px solid ${C.accent}` : "2px solid transparent", color: activeTab === tab.key ? "#7fe0c9" : C.muted, fontWeight: activeTab === tab.key ? 700 : 400, cursor: "pointer", fontSize: 13, marginBottom: -1, transition: "all 0.15s" }}>
            {tab.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "center" }}>
          <div style={{ display: "flex", background: "#0d1413", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(72,117,115,0.2)" }}>
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Mã lô hàng, nông dân..."
              style={{ padding: "7px 12px", background: "none", border: "none", color: "#e2e8f0", fontSize: 13, outline: "none", width: 175 }} />
            {search && <button onClick={handleClear} style={{ padding: "0 8px", background: "none", border: "none", color: C.muted, cursor: "pointer" }}>✕</button>}
            <button onClick={handleSearch} style={{ padding: "7px 12px", background: "#487573", border: "none", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>🔍</button>
          </div>
          <button onClick={() => refetch()} style={{ padding: "7px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(72,117,115,0.15)", color: "#e2e8f0", borderRadius: 7, cursor: "pointer", fontSize: 12 }}>🔄</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#172524", borderRadius: 10, border: "1px solid rgba(72,117,115,0.15)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.01)", borderBottom: "1px solid rgba(72,117,115,0.15)" }}>
              {["Mã lô hàng", "Nông dân", "Địa chỉ ví", "Khối lượng", "Grade", "Ngày tạo", "Tài liệu", "Trạng thái", "Thao tác"].map((h) => (
                <th key={h} style={{ padding: "10px 16px", color: C.muted, fontWeight: 600, textAlign: "left", whiteSpace: "nowrap", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
              ))}
            </tr>
          </thead>

          {isLoading ? (
            <tbody>{[1,2,3,4].map(i => <SkeletonRow key={i} />)}</tbody>
          ) : isError ? (
            <tbody><tr><td colSpan={9} style={{ textAlign: "center", padding: 60, color: C.red }}>
              Không thể tải dữ liệu — <button onClick={() => refetch()} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", textDecoration: "underline" }}>Tải lại</button>
            </td></tr></tbody>
          ) : batches.length === 0 ? (
            <tbody><tr><td colSpan={9} style={{ textAlign: "center", padding: 60, color: C.muted }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
              <div>Không tìm thấy lô hàng nào trong tab này</div>
            </td></tr></tbody>
          ) : (
            <tbody>
              {batches.map((b) => {
                const isProcessing = (approve.isPending && approve.variables?.id === b.id) ||
                                     (reject.isPending  && reject.variables?.id  === b.id);
                const docsExpanded  = expandedDocs === b.id;
                const shortWallet   = b.farmer_wallet ? `${b.farmer_wallet.slice(0,6)}…${b.farmer_wallet.slice(-4)}` : "—";
                const currentGrade  = gradeOverride[b.id] || QG_TO_GRADE[b.quality_grade] || "";

                return (
                  <Fragment key={b.id}>
                    <tr style={{ borderBottom: docsExpanded ? "none" : "1px solid rgba(72,117,115,0.1)", transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(72,117,115,0.03)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>

                      {/* Batch ID */}
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: C.accent, whiteSpace: "nowrap" }}>
                        <div>{b.batch_id}</div>
                        <div style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>☕ Robusta</div>
                      </td>

                      {/* Farmer */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, color: "#e2e8f0" }}>{b.farmer_name || "—"}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{b.farmer_email}</div>
                      </td>

                      {/* Wallet */}
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: C.muted }}>{shortWallet}</span>
                      </td>

                      {/* Qty */}
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "#e2e8f0" }}>
                        {Number(b.quantity).toLocaleString()} kg
                      </td>

                      {/* Grade — editable for pending, badge for others */}
                      <td style={{ padding: "12px 16px" }}>
                        {b.status === "PENDING_MINT_APPROVAL" ? (
                          <select value={currentGrade}
                            onChange={(e) => handleGradeChange(b, e.target.value)}
                            style={{ padding: "5px 8px", background: "#0d1413", border: "1px solid rgba(72,117,115,0.2)", borderRadius: 6, color: currentGrade ? (currentGrade === "A" ? C.green : currentGrade === "B" ? C.accent : C.gold) : C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer", outline: "none", minWidth: 80 }}>
                            <option value="">— Chọn</option>
                            <option value="A">A · CR1</option>
                            <option value="B">B · CR2</option>
                            <option value="C">C · CR3</option>
                          </select>
                        ) : (
                          <GradeBadge qg={b.quality_grade} />
                        )}
                      </td>

                      {/* Date */}
                      <td style={{ padding: "12px 16px", color: C.muted, whiteSpace: "nowrap", fontSize: 12 }}>
                        {new Date(b.created_at).toLocaleDateString("vi-VN")}
                      </td>

                      {/* Docs */}
                      <td style={{ padding: "12px 16px" }}>
                        <button onClick={() => setExpandedDocs(docsExpanded ? null : b.id)}
                          style={{ padding: "4px 10px", background: `${C.accent}12`, border: `1px solid ${C.accent}30`, color: C.accent, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                          📂 {b.doc_count || 0} {docsExpanded ? "▲" : "▼"}
                        </button>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "12px 16px" }}>
                        <StatusBadge status={b.status} />
                        {b.status === "MINTED" && b.tx_hash && (
                          <div style={{ fontSize: 10, marginTop: 4 }}>
                            <a href={`https://sepolia.etherscan.io/tx/${b.tx_hash}`} target="_blank" rel="noreferrer"
                              style={{ color: C.accent, textDecoration: "none" }}>TX ↗</a>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 5, flexWrap: "nowrap" }}>
                          <button onClick={() => nav(`/admin/batch/${b.id}`)}
                            style={{ padding: "5px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(72,117,115,0.15)", color: "#e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>
                            Chi tiết
                          </button>
                          {b.status === "PENDING_MINT_APPROVAL" && (
                            <>
                              <button onClick={() => setApproveTarget(b)} disabled={isProcessing}
                                style={{ padding: "5px 12px", background: isProcessing ? "#555" : C.green, border: "none", color: isProcessing ? C.muted : "#000", borderRadius: 6, cursor: isProcessing ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                                {approve.isPending && approve.variables?.id === b.id ? "⏳" : "Duyệt"}
                              </button>
                              <button onClick={() => setRejectTarget(b)} disabled={isProcessing}
                                style={{ padding: "5px 10px", background: `${C.red}20`, border: `1px solid ${C.red}40`, color: C.red, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                                ✕
                              </button>
                            </>
                          )}
                          {b.status === "REJECTED" && b.rejection_reason && (
                            <span title={b.rejection_reason} style={{ fontSize: 11, color: C.red, cursor: "help" }}>⚠ Lý do</span>
                          )}
                        </div>
                      </td>
                    </tr>

                    {docsExpanded && (
                      <tr style={{ borderBottom: "1px solid rgba(72,117,115,0.1)" }}>
                        <td colSpan={9} style={{ padding: "0 16px 14px" }}>
                          <DocumentsPanel batchId={b.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          )}
        </table>
      </div>

      {/* Pagination */}
      {total > 10 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", marginTop: 20 }}>
          <button onClick={() => setPage(1)} disabled={page === 1}
            style={{ padding: "6px 12px", background: "#172524", border: "1px solid rgba(72,117,115,0.15)", color: page === 1 ? C.muted : "#e2e8f0", borderRadius: 6, cursor: page === 1 ? "default" : "pointer", fontSize: 12 }}>«</button>
          <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
            style={{ padding: "6px 14px", background: "#172524", border: "1px solid rgba(72,117,115,0.15)", color: page === 1 ? C.muted : "#e2e8f0", borderRadius: 6, cursor: page === 1 ? "default" : "pointer", fontSize: 12 }}> Trước</button>
          <span style={{ padding: "6px 14px", color: C.muted, fontSize: 13 }}>Trang {page} / {Math.ceil(total / 10)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={batches.length < 10}
            style={{ padding: "6px 14px", background: "#172524", border: "1px solid rgba(72,117,115,0.15)", color: batches.length < 10 ? C.muted : "#e2e8f0", borderRadius: 6, cursor: batches.length < 10 ? "default" : "pointer", fontSize: 12 }}>Sau »</button>
          <button onClick={() => setPage(Math.ceil(total / 10))} disabled={batches.length < 10}
            style={{ padding: "6px 12px", background: "#172524", border: "1px solid rgba(72,117,115,0.15)", color: batches.length < 10 ? C.muted : "#e2e8f0", borderRadius: 6, cursor: batches.length < 10 ? "default" : "pointer", fontSize: 12 }}>»</button>
        </div>
      )}
    </DashboardLayout>
  );
}
