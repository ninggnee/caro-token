import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import axios from "../utils/axiosClient";
import { formatKg } from "../utils/formatters";

const STATUS_META = {
  PENDING_MINT_APPROVAL: { label: "Chờ duyệt", color: "#f0b90b", bg: "rgba(240,185,11,0.12)" },
  MINTED:                { label: "Đã Mint",   color: "#B0E4CC", bg: "rgba(176,228,204,0.12)" },
  REJECTED:              { label: "Từ chối",   color: "#f6465d", bg: "rgba(246,70,93,0.12)"   },
  APPROVED:              { label: "Đã duyệt",  color: "#408A71", bg: "rgba(64,138,113,0.12)"  },
};

const LOGISTICS_LABELS = {
  PENDING_PICKUP: "Chờ lấy hàng",
  IN_TRANSIT:     "Đang vận chuyển",
  DELIVERED:      "Đã đến nhà máy",
  STANDARDIZED:   "Đã chuẩn hóa",
  STORED:         "Đã nhập kho",
  INSPECTED:      "Đã kiểm định",
  MINTED:         "Đã đúc Token",
};

const DOC_TYPE_META = {
  harvest_certificate:       { label: "Giấy chứng nhận thu hoạch",        icon: "📋", color: "#B0E4CC" },
  quality_inspection:        { label: "Kiểm định chất lượng",              icon: "🔬", color: "#f0b90b" },
  coffee_photos:             { label: "Ảnh sản phẩm",                       icon: "🖼️", color: "#94a3b8" },
  additional_docs:           { label: "Tài liệu bổ sung",                   icon: "📎", color: "#94a3b8" },
  warehouse_license:         { label: "Giấy phép kho bãi",                  icon: "🏛️", color: "#f0b90b" },
  inspection_report:         { label: "Báo cáo kiểm định kho",             icon: "🔬", color: "#f0b90b" },
  warehouse_certificate:     { label: "Chứng nhận kho bãi",                icon: "📜", color: "#f0b90b" },
  warehouse_insurance:       { label: "Bảo hiểm kho bãi",                  icon: "🛡️", color: "#94a3b8" },
  warehouse_ownership_proof: { label: "Bằng chứng sở hữu kho",           icon: "🔑", color: "#94a3b8" },
  warehouse_photos:          { label: "Ảnh kho bãi",                         icon: "📸", color: "#94a3b8" },
  coffee_storage_report:     { label: "Báo cáo lưu trữ cà phê",           icon: "📊", color: "#408A71" },
  warehouse_receipt:         { label: "Biên bản bàn giao và nhập kho",      icon: "📦", color: "#408A71" },
  quality_audit:             { label: "Phiếu kiểm định (Oracle)",           icon: "⛓️", color: "#f0b90b" },
  other:                     { label: "Tài liệu khác",                      icon: "📄", color: "#64748b" },
};

// Vietnamese labels for display
const DOC_TYPE_LABELS_VI = {
  harvest_certificate:       "Giấy chứng nhận thu hoạch",
  quality_inspection:        "Kiểm định chất lượng",
  coffee_photos:             "Ảnh sản phẩm",
  additional_docs:           "Tài liệu bổ sung",
  warehouse_license:         "Giấy phép kho bãi",
  inspection_report:         "Báo cáo kiểm định kho",
  warehouse_certificate:     "Chứng nhận kho bãi",
  warehouse_insurance:       "Bảo hiểm kho bãi",
  warehouse_ownership_proof: "Bằng chứng sở hữu kho",
  warehouse_photos:          "Ảnh kho bãi",
  coffee_storage_report:     "Báo cáo lưu trữ cà phê",
  warehouse_receipt:         "Biên bản bàn giao và nhập kho",
  quality_audit:             "Phiếu kiểm định (Oracle)",
  other:                     "Tài liệu khác",
};

const DOC_TYPE_ORDER = [
  "harvest_certificate","coffee_photos","quality_inspection","quality_audit",
  "warehouse_receipt","coffee_storage_report","warehouse_license","inspection_report",
  "warehouse_certificate","warehouse_insurance","warehouse_ownership_proof",
  "warehouse_photos","additional_docs","other",
];

function fmtDate(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function StatusBadge({ batch }) {
  let meta;
  if (batch.status === "MINTED")    meta = STATUS_META.MINTED;
  else if (batch.status === "REJECTED") meta = STATUS_META.REJECTED;
  else if (batch.status === "APPROVED") meta = STATUS_META.APPROVED;
  else if (batch.logistics_status === "INSPECTED") meta = STATUS_META.PENDING_MINT_APPROVAL;
  else meta = { label: LOGISTICS_LABELS[batch.logistics_status] || "Dang xu ly", color: "#408A71", bg: "rgba(64,138,113,0.1)" };
  return (
    <span style={{ display:"inline-block", padding:"2px 9px", borderRadius:20, fontSize:11, fontWeight:700, color:meta.color, background:meta.bg, whiteSpace:"nowrap" }}>
      {meta.label}
    </span>
  );
}

function CidBadge({ cid }) {
  const [copied, setCopied] = useState(false);
  if (!cid) return null;
  const short = cid.slice(0,8) + "…" + cid.slice(-4);
  const copy = () => { try { navigator.clipboard.writeText(cid); } catch(_){} setCopied(true); setTimeout(()=>setCopied(false),1500); };
  return (
    <span onClick={copy} title={cid} style={{ display:"inline-flex", alignItems:"center", gap:4, fontFamily:"monospace", fontSize:11, cursor:"pointer", color:"#408A71", background:"rgba(64,138,113,0.08)", padding:"2px 7px", borderRadius:4, border:"1px solid rgba(64,138,113,0.2)", userSelect:"none" }}>
      IPFS: {short} {copied ? "✓" : "⎘"}
    </span>
  );
}

function DocCard({ doc }) {
  const type = doc.document_type || "other";
  const meta = DOC_TYPE_META[type] || DOC_TYPE_META.other;
  const labelVI = DOC_TYPE_LABELS_VI[type] || type;
  const name = doc.document_name || doc.file_name || "Tai lieu";
  const cid  = doc.cid || doc.ipfs_cid;
  const date = doc.created_at || doc.uploaded_at;
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, padding:"12px 16px", flexWrap:"wrap", transition:"border-color 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.borderColor="rgba(64,138,113,0.3)"}
      onMouseLeave={e => e.currentTarget.style.borderColor="rgba(255,255,255,0.06)"}>
      <div style={{ display:"flex", alignItems:"center", gap:12, flex:1, minWidth:0 }}>
        <div style={{ width:40, height:40, borderRadius:10, flexShrink:0, background:`${meta.color}15`, border:`1px solid ${meta.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
          {meta.icon}
        </div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#f8fafc", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</div>
          <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>
            <span style={{ color:meta.color }}>{labelVI}</span>
            {date && <span> · {fmtDate(date)}</span>}
          </div>
          {cid && <div style={{ marginTop:4 }}><CidBadge cid={cid} /></div>}
        </div>
      </div>
      <div style={{ display:"flex", gap:8, flexShrink:0 }}>
        {cid ? (
          <a href={`https://ipfs.io/ipfs/${cid}`} target="_blank" rel="noreferrer"
            style={{ padding:"6px 14px", background:"rgba(64,138,113,0.12)", border:"1px solid rgba(64,138,113,0.3)", borderRadius:7, color:"#B0E4CC", fontSize:12, fontWeight:700, textDecoration:"none", whiteSpace:"nowrap" }}>
            Xem ↗
          </a>
        ) : (
          <span style={{ padding:"6px 12px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:7, color:"#475569", fontSize:11 }}>Nội bộ</span>
        )}
      </div>
    </div>
  );
}

function DocGroup({ type, docs }) {
  const meta = DOC_TYPE_META[type] || DOC_TYPE_META.other;
  const labelVI = DOC_TYPE_LABELS_VI[type] || type;
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, paddingBottom:8, borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ fontSize:16 }}>{meta.icon}</span>
        <span style={{ fontSize:12, fontWeight:700, color:meta.color, textTransform:"uppercase", letterSpacing:"0.5px" }}>{labelVI}</span>
        <span style={{ marginLeft:"auto", fontSize:11, color:"#64748b", fontWeight:600 }}>({docs.length})</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {docs.map(doc => <DocCard key={doc.id} doc={doc} />)}
      </div>
    </div>
  );
}

function BatchDetailPanel({ batch, onClose }) {
  const grouped = useMemo(() => {
    const map = {};
    const add = (doc) => { const t=doc.document_type||"other"; if(!map[t]) map[t]=[]; map[t].push(doc); };
    (batch.documents||[]).forEach(add);
    (batch.warehouse_documents||[]).forEach(add);
    return map;
  }, [batch]);

  const sortedTypes = DOC_TYPE_ORDER.filter(t => grouped[t]);
  const extraTypes  = Object.keys(grouped).filter(t => !DOC_TYPE_ORDER.includes(t));
  const allTypes    = [...sortedTypes, ...extraTypes];
  const hasAny      = allTypes.length > 0;

  return (
    <div style={{ background:"var(--card-bg,#0f172a)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:520 }}>
      <div style={{ padding:"18px 20px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexShrink:0 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:10, color:"#64748b", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:4 }}>MÃ LÔ HÀNG</div>
          <div style={{ fontSize:15, fontWeight:800, color:"#408A71", fontFamily:"monospace" }}>{batch.batch_id}</div>
          <div style={{ fontSize:12, color:"#94a3b8", marginTop:4 }}>{formatKg(batch.quantity)} · {batch.coffee_type||"ROBUSTA"} · {fmtDate(batch.created_at)}</div>
          <div style={{ marginTop:6, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <StatusBadge batch={batch} />
            <span style={{ fontSize:11, color:"#64748b" }}>{batch.doc_count||0} tệp đã tải lên</span>
          </div>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#64748b", fontSize:18, padding:4, flexShrink:0, lineHeight:1 }}>✕</button>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
        {!hasAny ? (
          <div style={{ textAlign:"center", paddingTop:60 }}>
            <div style={{ fontSize:36, marginBottom:12 }}>📂</div>
            <div style={{ color:"#64748b", fontSize:14 }}>Chưa có tài liệu nào cho lô này</div>
          </div>
        ) : allTypes.map(type => <DocGroup key={type} type={type} docs={grouped[type]} />)}
      </div>
    </div>
  );
}

function BatchListItem({ batch, isActive, onClick }) {
  return (
    <div onClick={onClick}
      style={{ padding:"14px 16px", borderRadius:10, cursor:"pointer", marginBottom:8, transition:"all 0.15s", background:isActive?"rgba(64,138,113,0.12)":"rgba(255,255,255,0.02)", border:`1px solid ${isActive?"rgba(64,138,113,0.4)":"rgba(255,255,255,0.06)"}` }}
      onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.borderColor="rgba(64,138,113,0.2)"; }}
      onMouseLeave={e=>{ if(!isActive) e.currentTarget.style.borderColor="rgba(255,255,255,0.06)"; }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
        <div style={{ fontFamily:"monospace", fontSize:13, fontWeight:800, color:isActive?"#B0E4CC":"#408A71", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{batch.batch_id}</div>
        <StatusBadge batch={batch} />
      </div>
      <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>{formatKg(batch.quantity)} · {batch.coffee_type||"Robusta"} · {fmtDate(batch.created_at)}</div>
      {(batch.doc_count||0) > 0 && (
        <div style={{ fontSize:11, color:"#475569", marginTop:4 }}>📂 {batch.doc_count} tệp tài liệu</div>
      )}
    </div>
  );
}

export default function WarehouseDocuments() {
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["batches-with-docs"],
    queryFn:  () => axios.get("/batches/mine-with-docs").then(r => r.data),
    staleTime: 30_000,
    retry: 1,
  });

  const batches = data?.batches || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return batches;
    const q = search.trim().toLowerCase();
    return batches.filter(b => b.batch_id?.toLowerCase().includes(q) || (b.coffee_type||"").toLowerCase().includes(q));
  }, [batches, search]);

  const selectedBatch = selected ? batches.find(b => b.batch_id === selected) || null : null;

  return (
    <FarmerLayout title="Giay to luu kho">
      <div style={{ padding:"0 0 32px" }}>
        <div style={{ marginBottom:20 }}>
          <h2 style={{ margin:0, fontSize:20, fontWeight:800 }}>📁 Giấy tờ lưu kho</h2>
          <p style={{ margin:"4px 0 0", fontSize:13, color:"#64748b" }}>Quản lý các tài liệu liên kết với từng lô hàng</p>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:16, alignItems:"start", minHeight:520 }}>

          {/* Left panel */}
          <div style={{ background:"var(--card-bg,#0f172a)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ padding:"16px 16px 12px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <span style={{ fontSize:12, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.5px" }}>Danh sách lô hàng</span>
                <button onClick={()=>refetch()} style={{ background:"none", border:"none", cursor:"pointer", color:"#64748b", fontSize:14, padding:2 }} title="Tai lai">🔄</button>
              </div>
              <input type="text" placeholder="Tìm theo Mã lô (Batch ID)..." value={search} onChange={e=>setSearch(e.target.value)}
                style={{ width:"100%", padding:"8px 12px", borderRadius:8, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#f8fafc", fontSize:12, outline:"none", boxSizing:"border-box" }} />
              <div style={{ fontSize:11, color:"#475569", marginTop:6 }}>HIỂN THỊ {filtered.length} LÔ HÀNG</div>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:12, maxHeight:600 }}>
              {isLoading && <div style={{ textAlign:"center", paddingTop:40, color:"#64748b", fontSize:13 }}>Đang tải danh sách lô hàng…</div>}
              {isError && (
                <div style={{ textAlign:"center", paddingTop:40 }}>
                  <div style={{ color:"#f6465d", fontSize:13, marginBottom:8 }}>Không thể tải dữ liệu</div>
                  <button onClick={()=>refetch()} style={{ padding:"6px 14px", background:"rgba(64,138,113,0.12)", border:"1px solid rgba(64,138,113,0.3)", borderRadius:6, color:"#B0E4CC", cursor:"pointer", fontSize:12 }}>Thử lại</button>
                </div>
              )}
              {!isLoading && !isError && filtered.length === 0 && (
                <div style={{ textAlign:"center", paddingTop:40, color:"#64748b", fontSize:13 }}>{search ? "Không tìm thấy lô hàng phù hợp" : "Chưa có lô hàng nào"}</div>
              )}
              {filtered.map(batch => (
                <BatchListItem key={batch.batch_id} batch={batch} isActive={selected===batch.batch_id} onClick={()=>setSelected(batch.batch_id)} />
              ))}
            </div>
          </div>

          {/* Right panel */}
          {selectedBatch ? (
            <BatchDetailPanel batch={selectedBatch} onClose={()=>setSelected(null)} />
          ) : (
            <div style={{ background:"var(--card-bg,#0f172a)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"#64748b", textAlign:"center", padding:40, minHeight:300 }}>
              <div style={{ fontSize:48, marginBottom:16, opacity:0.5 }}>📁</div>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:8, color:"#94a3b8" }}>Chọn một lô hàng để xem tài liệu</div>
              <div style={{ fontSize:13, maxWidth:280, lineHeight:1.6 }}>Nhấn vào bất kỳ lô hàng nào ở bên trái để xem chi tiết tài liệu liên kết</div>
            </div>
          )}
        </div>
      </div>
    </FarmerLayout>
  );
}
