import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import { createDeposit, getMyDeposits } from "../services/walletApi";

const C = { accent: "#00d4aa", muted: "#6b7a99", green: "#0ecb81", gold: "#f0b90b", red: "#f6465d", card: "#141f2e" };

const STATUS_COLOR = { pending: C.gold, approved: C.green, rejected: C.red };
const STATUS_LABEL = { pending: "⏳ Chờ duyệt", approved: "✓ Đã duyệt", rejected: "✗ Từ chối" };

function fmt(n) { return Number(n || 0).toLocaleString("vi-VN"); }

export default function FarmerDepositPage() {
  const nav = useNavigate();
  const qc  = useQueryClient();
  const { user } = useAuth();
  const fileRef = useRef(null);

  const addr = user?.wallet_address || "Chưa kết nối ví";

  const [amount, setAmount] = useState("");
  const [file,   setFile]   = useState(null);
  const [tab,    setTab]    = useState("form"); // "form" | "history" | "guide"

  // Fetch deposit history
  const { data: depData, isLoading: depLoading } = useQuery({
    queryKey: ["my-deposits"],
    queryFn: getMyDeposits,
    enabled: tab === "history",
  });
  const deposits = depData?.data || [];

  // Submit deposit
  const depositMut = useMutation({
    mutationFn: (fd) => createDeposit(fd),
    onSuccess: () => {
      toast.success("Yêu cầu nạp tiền đã được gửi! Admin sẽ xác nhận trong vòng 24h.");
      setAmount("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["my-deposits"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Gửi yêu cầu thất bại"),
  });

  const handleSubmit = () => {
    const num = Number(amount);
    if (!num || num <= 0) { toast.error("Số tiền phải lớn hơn 0"); return; }
    if (!file)            { toast.error("Vui lòng đính kèm ảnh biên lai"); return; }

    const fd = new FormData();
    fd.append("amount",      num);
    fd.append("proof_image", file);
    depositMut.mutate(fd);
  };

  const copy = () => {
    if (user?.wallet_address) {
      navigator.clipboard.writeText(user.wallet_address);
      toast.info("Đã copy địa chỉ ví!");
    }
  };

  return (
    <FarmerLayout title="Deposit — Nạp Tiền">
      <div style={{ maxWidth: 720, display: "grid", gap: 16 }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>⬇️ Nạp Tiền VND</h2>
          <div style={{ display: "flex", gap: 0, background: "#0b1117", borderRadius: 8, padding: 3, border: "1px solid rgba(255,255,255,0.07)" }}>
            {[
              { key: "form",    label: "Nạp tiền" },
              { key: "history", label: "Lịch sử" },
              { key: "guide",   label: "Hướng dẫn" },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ padding: "6px 16px", borderRadius: 6, background: tab === t.key ? C.accent : "transparent", color: tab === t.key ? "#000" : C.muted, border: "none", cursor: "pointer", fontSize: 12, fontWeight: tab === t.key ? 700 : 400 }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── TAB: Form ───────────────────────────────────────────────────── */}
        {tab === "form" && (
          <>
            {/* Wallet address */}
            <div style={{ background: C.card, borderRadius: 10, border: "1px solid rgba(0,212,170,0.2)", padding: 18 }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Địa chỉ ví nội bộ của bạn</div>
              <div style={{ fontFamily: "monospace", fontSize: 13, color: "#e2e8f0", background: "rgba(255,255,255,0.03)", padding: "10px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.07)", marginBottom: 12, wordBreak: "break-all" }}>
                {addr}
              </div>
              <button onClick={copy} style={{ padding: "7px 18px", background: C.accent, color: "#000", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                Copy địa chỉ
              </button>
            </div>

            {/* Deposit Form */}
            <div style={{ background: C.card, borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <div style={{ padding: "13px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 700 }}>
                📋 Gửi yêu cầu nạp tiền
              </div>
              <div style={{ padding: 20, display: "grid", gap: 16 }}>

                <div>
                  <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>SỐ TIỀN (VND) *</label>
                  <input type="number" min="10000" step="1000" value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="VD: 1000000"
                    style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                  {amount && Number(amount) > 0 && (
                    <div style={{ marginTop: 6, fontSize: 12, color: C.muted }}>
                      = <strong style={{ color: C.accent }}>{fmt(amount)} ₫</strong>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>ẢNH BIÊN LAI CHUYỂN KHOẢN *</label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    style={{ border: `1px dashed ${file ? C.green : "rgba(255,255,255,0.15)"}`, borderRadius: 8, padding: "16px 20px", cursor: "pointer", background: file ? "rgba(14,203,129,0.04)" : "rgba(255,255,255,0.02)", textAlign: "center" }}>
                    {file ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                        <span style={{ color: C.green, fontSize: 18 }}>✓</span>
                        <div>
                          <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{file.name}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{(file.size / 1024).toFixed(0)} KB — click để đổi</div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 22, marginBottom: 6 }}>🖼️</div>
                        <div style={{ fontSize: 13, color: C.muted }}>Click để chọn ảnh biên lai</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>JPG, PNG, WebP — tối đa 5MB</div>
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }}
                    onChange={e => setFile(e.target.files[0] || null)} />
                </div>

                <div style={{ padding: "10px 14px", background: "rgba(0,212,170,0.05)", border: "1px solid rgba(0,212,170,0.12)", borderRadius: 8, fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
                  💡 Chuyển khoản đúng số tiền + đính kèm biên lai. Admin sẽ xác nhận và cộng số dư trong vòng <strong style={{ color: "#e2e8f0" }}>24 giờ</strong>.
                </div>

                <button onClick={handleSubmit} disabled={depositMut.isPending}
                  style={{ padding: "11px 28px", background: depositMut.isPending ? "#555" : C.accent, border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 14, cursor: depositMut.isPending ? "not-allowed" : "pointer", width: "fit-content" }}>
                  {depositMut.isPending ? "Đang gửi..." : "📤 Gửi yêu cầu nạp tiền"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── TAB: History ─────────────────────────────────────────────────── */}
        {tab === "history" && (
          <div style={{ background: C.card, borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "13px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 700 }}>
              📋 Lịch Sử Nạp Tiền
            </div>
            {depLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Đang tải...</div>
            ) : deposits.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: C.muted }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
                <div>Chưa có yêu cầu nạp tiền nào</div>
              </div>
            ) : (
              <div>
                {deposits.map(d => (
                  <div key={d.id} style={{ padding: "13px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>+{fmt(d.amount)} VND</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                        {new Date(d.created_at).toLocaleString("vi-VN")}
                        {d.note && <span style={{ marginLeft: 8, color: "rgba(255,255,255,0.4)" }}>• {d.note}</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: `${STATUS_COLOR[d.status] || C.muted}18`, color: STATUS_COLOR[d.status] || C.muted, fontWeight: 700 }}>
                      {STATUS_LABEL[d.status] || d.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Guide ───────────────────────────────────────────────────── */}
        {tab === "guide" && (
          <div style={{ background: C.card, borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 18 }}>Hướng Dẫn Nạp Tiền VND</div>
            <div style={{ display: "grid", gap: 16 }}>
              {[
                { n: "1", icon: "🏦", title: "Chuyển khoản ngân hàng", desc: "Chuyển VND đến tài khoản ngân hàng của CaRo Platform (thông tin liên hệ admin)." },
                { n: "2", icon: "📸", title: "Chụp biên lai", desc: "Chụp ảnh hoặc screenshot màn hình xác nhận giao dịch từ ngân hàng của bạn." },
                { n: "3", icon: "📤", title: "Gửi yêu cầu", desc: "Điền số tiền đã chuyển, đính kèm biên lai và nhấn gửi yêu cầu trong tab Nạp tiền." },
                { n: "4", icon: "✅", title: "Chờ xác nhận", desc: "Admin kiểm tra và duyệt trong vòng 24h. Số dư VND sẽ được cộng vào ví nội bộ của bạn." },
              ].map(s => (
                <div key={s.n} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(0,212,170,0.12)", border: "1px solid rgba(0,212,170,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.6 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => nav("/farmer/wallet")} style={{ padding: "8px 18px", background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 13 }}>
            ← Quay lại ví
          </button>
        </div>

      </div>
    </FarmerLayout>
  );
}
