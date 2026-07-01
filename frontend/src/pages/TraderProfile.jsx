import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import TraderLayout from "../components/layout/TraderLayout";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import axios from "../utils/axiosClient";

const C = {
  accent: "#487573", muted: "#6b7a99", green: "#0ecb81", red: "#f6465d",
  card: "#172524", border: "rgba(72,117,115,0.15)", tealLight: "#7fe0c9",
};

function inputStyle(disabled) {
  return {
    width: "100%", padding: "10px 12px", background: disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)",
    border: `1px solid ${C.border}`, borderRadius: 8, color: disabled ? C.muted : "#e2e8f0",
    fontSize: 13, boxSizing: "border-box", outline: "none",
  };
}
function Label({ children }) {
  return <label style={{ display: "block", fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 6 }}>{children}</label>;
}
function Field({ label, value, onChange, disabled, type = "text", placeholder }) {
  return (
    <div>
      <Label>{label}</Label>
      <input type={type} value={value} onChange={e => onChange?.(e.target.value)} disabled={disabled}
        placeholder={placeholder} style={inputStyle(disabled)} />
    </div>
  );
}
function Msg({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ padding: "10px 14px", background: msg.ok ? "rgba(14,203,129,0.1)" : "rgba(246,70,93,0.1)", border: `1px solid ${msg.ok ? "rgba(14,203,129,0.3)" : "rgba(246,70,93,0.3)"}`, borderRadius: 8, fontSize: 13, color: msg.ok ? C.green : C.red }}>
      {msg.text}
    </div>
  );
}
function SaveBtn({ onClick, loading, label = "Lưu thay đổi" }) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{ padding: "10px 24px", background: loading ? "rgba(72,117,115,0.4)" : C.accent, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: loading ? "not-allowed" : "pointer" }}>
      {loading ? "Đang lưu..." : label}
    </button>
  );
}

const KYC_STATUS_MAP = {
  approved: { label: "Đã xác thực KYC",  color: C.green,   icon: "✅" },
  pending:  { label: "Đang chờ xét duyệt", color: "#f0b90b", icon: "⏳" },
  rejected: { label: "Bị từ chối",         color: C.red,     icon: "❌" },
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

  const kyc = meUser?.kyc_status ? (KYC_STATUS_MAP[meUser.kyc_status] || { label: meUser.kyc_status, color: C.muted, icon: "❓" }) : null;

  const tabStyle = (t) => ({
    padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", borderRadius: 7,
    background: tab === t ? C.accent : "rgba(255,255,255,0.04)", color: tab === t ? "#fff" : C.muted,
  });

  const initials = (meUser?.full_name || meUser?.email || "T")[0].toUpperCase();

  return (
    <TraderLayout title="Hồ sơ cá nhân">
      <div style={{ display: "grid", gap: 18, width: "100%" }}>

        {/* Profile header */}
        <div style={{ background: `linear-gradient(135deg, #172524 0%, #1e302f 100%)`, borderRadius: 14, border: `1px solid ${C.border}`, padding: "22px 24px", display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{meUser?.full_name || "Chưa cập nhật"}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{meUser?.email}</div>
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(72,117,115,0.2)", color: C.tealLight, fontWeight: 700, textTransform: "uppercase" }}>
                Trader
              </span>
              {kyc && (
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: `rgba(0,0,0,0.15)`, color: kyc.color, fontWeight: 700, border: `1px solid ${kyc.color}44` }}>
                  {kyc.icon} {kyc.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8 }}>
          <button style={tabStyle("info")}     onClick={() => setTab("info")}>👤 Thông tin cá nhân</button>
          <button style={tabStyle("security")} onClick={() => setTab("security")}>🔒 Đổi mật khẩu</button>
          <button style={tabStyle("wallet")}   onClick={() => setTab("wallet")}>🔗 Ví blockchain</button>
        </div>

        {/* Tab: Info */}
        {tab === "info" && (
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "22px 24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 18 }}>Thông tin cá nhân</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Họ và tên" value={profile.full_name} onChange={v => setProfile(p => ({ ...p, full_name: v }))} placeholder="Nguyễn Văn A" />
              <Field label="Email (không thể thay đổi)" value={meUser?.email || ""} disabled />
              <Field label="Số điện thoại" value={profile.phone} onChange={v => setProfile(p => ({ ...p, phone: v }))} placeholder="0912345678" />
              <Field label="Địa chỉ" value={profile.address} onChange={v => setProfile(p => ({ ...p, address: v }))} placeholder="Hà Nội, Việt Nam" />
            </div>
            <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
              <Msg msg={infoMsg} />
              <div><SaveBtn onClick={handleSaveProfile} loading={profileMutation.isLoading} /></div>
            </div>
          </div>
        )}

        {/* Tab: Security */}
        {tab === "security" && (
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "22px 24px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 18 }}>Đổi mật khẩu</div>
            <div style={{ display: "grid", gap: 14 }}>
              <Field label="Mật khẩu hiện tại" type="password" value={pwd.current} onChange={v => setPwd(p => ({ ...p, current: v }))} placeholder="••••••••" />
              <Field label="Mật khẩu mới" type="password" value={pwd.newPwd} onChange={v => setPwd(p => ({ ...p, newPwd: v }))} placeholder="Ít nhất 6 ký tự" />
              <Field label="Xác nhận mật khẩu mới" type="password" value={pwd.confirm} onChange={v => setPwd(p => ({ ...p, confirm: v }))} placeholder="Nhập lại mật khẩu mới" />
              <Msg msg={pwdMsg} />
              <div><SaveBtn onClick={handleChangePwd} loading={pwdMutation.isLoading} label="Đổi mật khẩu" /></div>
            </div>
            <div style={{ marginTop: 20, padding: "12px 14px", background: "rgba(72,117,115,0.07)", borderRadius: 8, fontSize: 12, color: C.muted }}>
              ℹ Mật khẩu mới phải có ít nhất 6 ký tự. Sau khi đổi, bạn sẽ cần đăng nhập lại trên các thiết bị khác.
            </div>
          </div>
        )}

        {/* Tab: Wallet */}
        {tab === "wallet" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "22px 24px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>🦊 MetaMask — Ví blockchain</div>
              {!account ? (
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
                    Kết nối ví MetaMask để xem số dư token CR1, CR2, CR3 trực tiếp trên blockchain và thực hiện giao dịch on-chain.
                  </div>
                  <div>
                    <button onClick={connect}
                      style={{ padding: "11px 24px", background: "#f0b90b", color: "#000", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      🦊 Kết nối MetaMask
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "rgba(14,203,129,0.08)", border: `1px solid rgba(14,203,129,0.2)`, borderRadius: 9 }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: C.green, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Địa chỉ ví đang kết nối</div>
                      <div style={{ fontSize: 13, fontFamily: "monospace", color: "#e2e8f0", fontWeight: 600, wordBreak: "break-all" }}>{account}</div>
                    </div>
                  </div>
                  <div>
                    <button onClick={disconnect}
                      style={{ padding: "8px 18px", background: "rgba(246,70,93,0.12)", color: C.red, border: `1px solid rgba(246,70,93,0.3)`, borderRadius: 7, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                      Ngắt kết nối ví
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* KYC info */}
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "18px 24px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🪪 Trạng thái KYC</div>
              {kyc ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: `${kyc.color}14`, border: `1px solid ${kyc.color}33`, borderRadius: 9 }}>
                  <span style={{ fontSize: 20 }}>{kyc.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: kyc.color }}>{kyc.label}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {meUser?.kyc_status === "approved" ? "Tài khoản đã được xác minh danh tính" : meUser?.kyc_status === "pending" ? "Hồ sơ đang chờ xét duyệt từ hệ thống" : "Hồ sơ KYC bị từ chối — vui lòng liên hệ hỗ trợ"}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: C.muted }}>Chưa có thông tin KYC.</div>
              )}
            </div>

            {/* Account info */}
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "18px 24px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>ℹ Thông tin tài khoản</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "User ID",         value: meUser?.id || "—" },
                  { label: "Vai trò",          value: "Trader" },
                  { label: "Email",            value: meUser?.email || "—" },
                  { label: "Ngày đăng ký",     value: meUser?.created_at ? new Date(meUser.created_at).toLocaleDateString("vi-VN") : "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 7 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 13, color: "#e2e8f0", fontFamily: label.includes("ID") ? "monospace" : "inherit" }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </TraderLayout>
  );
}
