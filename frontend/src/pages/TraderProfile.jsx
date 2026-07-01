import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import TraderLayout from "../components/layout/TraderLayout";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import axios from "../utils/axiosClient";

function Msg({ msg }) {
  if (!msg) return null;
  return (
    <div className={`caro-badge ${msg.ok ? "caro-badge-success" : "caro-badge-danger"}`} style={{ display: "flex", padding: "10px 14px", fontSize: 13, borderRadius: 8, marginTop: 8 }}>
      {msg.text}
    </div>
  );
}

function SaveBtn({ onClick, loading, label = "Lưu thay đổi" }) {
  return (
    <button onClick={onClick} disabled={loading} className="caro-btn caro-btn-primary" style={{ marginTop: 12 }}>
      {loading ? "Đang lưu..." : label}
    </button>
  );
}

const KYC_STATUS_MAP = {
  approved: { label: "Đã xác thực KYC",  color: "caro-badge-success", icon: "✅" },
  pending:  { label: "Đang chờ xét duyệt", color: "caro-badge-warning", icon: "⏳" },
  rejected: { label: "Bị từ chối",         color: "caro-badge-danger",  icon: "❌" },
};

export default function TraderProfile() {
  const { user, updateUser } = useAuth();
  const { account, connect, disconnect } = useWallet();
  const qc = useQueryClient();

  const [tab,     setTab]     = useState("info");
  const [profile, setProfile] = useState({ full_name: "", phone: "", address: "" });
  const [pwd,     setPwd]     = useState({ current: "", newPwd: "", confirm: "" });
  const [infoMsg, setInfoMsg] = useState(null);
  const [pwdMsg,  setPwdMsg]  = useState(null);

  // Load latest user data
  const { data: meData } = useQuery({
    queryKey: ["auth-me"],
    queryFn:  () => axios.get("/auth/me").then(r => r.data),
    staleTime: 30_000,
  });
  const meUser = meData?.user || user;

  useEffect(() => {
    if (meUser) {
      setProfile({
        full_name: meUser.full_name || "",
        phone:     meUser.phone    || "",
        address:   meUser.address  || "",
      });
    }
  }, [meUser?.id]);

  // Profile mutation
  const profileMutation = useMutation({
    mutationFn: (body) => axios.put("/auth/profile", body).then(r => r.data),
    onSuccess:  (data) => {
      setInfoMsg({ ok: true, text: "Cập nhật hồ sơ thành công!" });
      if (data.user) updateUser(data.user);
      qc.invalidateQueries({ queryKey: ["auth-me"] });
    },
    onError: (e) => setInfoMsg({ ok: false, text: e?.response?.data?.message || "Cập nhật thất bại." }),
  });

  // Password mutation
  const pwdMutation = useMutation({
    mutationFn: (body) => axios.put("/auth/password", body).then(r => r.data),
    onSuccess:  () => {
      setPwdMsg({ ok: true, text: "Đổi mật khẩu thành công!" });
      setPwd({ current: "", newPwd: "", confirm: "" });
    },
    onError: (e) => setPwdMsg({ ok: false, text: e?.response?.data?.message || "Đổi mật khẩu thất bại." }),
  });

  const handleSaveProfile = () => {
    setInfoMsg(null);
    profileMutation.mutate(profile);
  };

  const handleChangePwd = () => {
    setPwdMsg(null);
    if (pwd.newPwd !== pwd.confirm) { setPwdMsg({ ok: false, text: "Mật khẩu xác nhận không khớp." }); return; }
    if (pwd.newPwd.length < 6)       { setPwdMsg({ ok: false, text: "Mật khẩu mới phải có ít nhất 6 ký tự." }); return; }
    pwdMutation.mutate({ current_password: pwd.current, new_password: pwd.newPwd });
  };

  const kyc = meUser?.kyc_status ? (KYC_STATUS_MAP[meUser.kyc_status] || { label: meUser.kyc_status, color: "caro-badge-muted", icon: "❓" }) : null;
  const initials = (meUser?.full_name || meUser?.email || "T")[0].toUpperCase();

  return (
    <TraderLayout title="Hồ sơ cá nhân">
      <div className="caro-page">

        {/* Profile header */}
        <div className="caro-card" style={{ background: "linear-gradient(135deg, rgba(176, 228, 204,0.05), rgba(64, 138, 113,0.05))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div className="caro-avatar caro-avatar-xl caro-avatar-ring">
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc" }}>{meUser?.full_name || "Chưa cập nhật"}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>{meUser?.email}</div>
              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span className="caro-badge caro-badge-info">Trader</span>
                {kyc && (
                  <span className={`caro-badge ${kyc.color}`}>
                    <span style={{ fontSize: 12 }}>{kyc.icon}</span> {kyc.label}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { id: "info", icon: "👤", label: "Thông tin cá nhân" },
            { id: "security", icon: "🔒", label: "Đổi mật khẩu" },
            { id: "wallet", icon: "🔗", label: "Ví blockchain" },
          ].map(t => (
            <button key={t.id} className={`caro-btn ${tab === t.id ? "caro-btn-primary" : "caro-btn-ghost"}`} onClick={() => setTab(t.id)}>
              <span style={{ fontSize: 14 }}>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Info */}
        {tab === "info" && (
          <div className="caro-card">
            <div className="caro-section-header">
              <h3 className="caro-section-title">Thông tin cá nhân</h3>
            </div>
            <div className="caro-grid-2">
              <div className="caro-field">
                <label className="caro-label">Họ và tên</label>
                <input type="text" className="caro-input" value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} placeholder="Nguyễn Văn A" />
              </div>
              <div className="caro-field">
                <label className="caro-label">Email (không thể thay đổi)</label>
                <input type="text" className="caro-input" value={meUser?.email || ""} disabled />
              </div>
              <div className="caro-field">
                <label className="caro-label">Số điện thoại</label>
                <input type="text" className="caro-input" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="0912345678" />
              </div>
              <div className="caro-field">
                <label className="caro-label">Địa chỉ</label>
                <input type="text" className="caro-input" value={profile.address} onChange={e => setProfile(p => ({ ...p, address: e.target.value }))} placeholder="Hà Nội, Việt Nam" />
              </div>
            </div>
            <Msg msg={infoMsg} />
            <SaveBtn onClick={handleSaveProfile} loading={profileMutation.isLoading} />
          </div>
        )}

        {/* Tab: Security */}
        {tab === "security" && (
          <div className="caro-card">
            <div className="caro-section-header">
              <h3 className="caro-section-title">Đổi mật khẩu</h3>
            </div>
            <div style={{ maxWidth: 500 }}>
              <div className="caro-field">
                <label className="caro-label">Mật khẩu hiện tại</label>
                <input type="password" className="caro-input" value={pwd.current} onChange={e => setPwd(p => ({ ...p, current: e.target.value }))} placeholder="••••••••" />
              </div>
              <div className="caro-field">
                <label className="caro-label">Mật khẩu mới</label>
                <input type="password" className="caro-input" value={pwd.newPwd} onChange={e => setPwd(p => ({ ...p, newPwd: e.target.value }))} placeholder="Ít nhất 6 ký tự" />
              </div>
              <div className="caro-field">
                <label className="caro-label">Xác nhận mật khẩu mới</label>
                <input type="password" className="caro-input" value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} placeholder="Nhập lại mật khẩu mới" />
              </div>
              <Msg msg={pwdMsg} />
              <SaveBtn onClick={handleChangePwd} loading={pwdMutation.isLoading} label="Đổi mật khẩu" />
            </div>
            <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(64, 138, 113,0.1)", borderRadius: 8, fontSize: 13, color: "#408A71", display: "flex", gap: 10 }}>
              <span>ℹ️</span> Mật khẩu mới phải có ít nhất 6 ký tự. Sau khi đổi, bạn sẽ cần đăng nhập lại trên các thiết bị khác.
            </div>
          </div>
        )}

        {/* Tab: Wallet */}
        {tab === "wallet" && (
          <div className="caro-grid-2">
            
            <div className="caro-card">
              <div className="caro-section-header">
                <h3 className="caro-section-title">🦊 MetaMask — Ví blockchain</h3>
              </div>
              {!account ? (
                <div>
                  <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 16 }}>
                    Kết nối ví MetaMask để xem số dư token CR1, CR2, CR3 trực tiếp trên blockchain và thực hiện giao dịch on-chain.
                  </p>
                  <button onClick={connect} className="caro-btn caro-btn-success">
                    🦊 Kết nối MetaMask
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "rgba(176, 228, 204,0.1)", border: "1px solid rgba(176, 228, 204,0.3)", borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#B0E4CC", flexShrink: 0, boxShadow: "0 0 8px #B0E4CC" }} />
                    <div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Địa chỉ ví đang kết nối</div>
                      <div style={{ fontSize: 14, fontFamily: "monospace", color: "#f8fafc", fontWeight: 700, wordBreak: "break-all" }}>{account}</div>
                    </div>
                  </div>
                  <button onClick={disconnect} className="caro-btn caro-btn-danger">
                    Ngắt kết nối ví
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* KYC info */}
              <div className="caro-card">
                <div className="caro-section-header">
                  <h3 className="caro-section-title">🪪 Trạng thái KYC</h3>
                </div>
                {kyc ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ fontSize: 32 }}>{kyc.icon}</div>
                    <div>
                      <div className={`caro-badge ${kyc.color}`} style={{ marginBottom: 6 }}>{kyc.label}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>
                        {meUser?.kyc_status === "approved" ? "Tài khoản đã được xác minh danh tính" : meUser?.kyc_status === "pending" ? "Hồ sơ đang chờ xét duyệt từ hệ thống" : "Hồ sơ KYC bị từ chối — vui lòng liên hệ hỗ trợ"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>Chưa có thông tin KYC.</div>
                )}
              </div>

              {/* Account info */}
              <div className="caro-card">
                <div className="caro-section-header">
                  <h3 className="caro-section-title">ℹ️ Thông tin tài khoản</h3>
                </div>
                <div className="caro-grid-2">
                  {[
                    { label: "User ID",         value: meUser?.id || "—" },
                    { label: "Vai trò",          value: "Trader" },
                    { label: "Email",            value: meUser?.email || "—" },
                    { label: "Ngày đăng ký",     value: meUser?.created_at ? new Date(meUser.created_at).toLocaleDateString("vi-VN") : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 7 }}>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: 13, color: "#e2e8f0", fontFamily: label.includes("ID") ? "monospace" : "inherit" }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </TraderLayout>
  );
}
