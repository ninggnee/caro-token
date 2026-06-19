import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import { updateProfile, changePassword } from "../services/orderApi";

const C = {
  accent: "#487573",
  muted: "#6b7a99",
  green: "#0ecb81",
  red: "#f6465d",
  card: "#172524",
  border: "rgba(72, 117, 115, 0.15)"
};

const KYC_COLOR = { approved: "#0ecb81", pending: "#f0b90b", rejected: "#f6465d" };
const KYC_LABEL = { approved: "✓ Đã xác minh", pending: "⏳ Đang chờ duyệt", rejected: "✗ Bị từ chối" };

function Field({ label, value, placeholder, onChange, type = "text", readOnly = false }) {
  return (
    <div style={{ display: "grid", gap: 5 }}>
      <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        style={{
          padding: "10px 14px",
          background: readOnly ? "rgba(255,255,255,0.02)" : "rgba(72,117,115,0.03)",
          border: `1px solid ${C.border}`,
          borderRadius: 7,
          color: readOnly ? C.muted : "#e2e8f0",
          fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box",
          cursor: readOnly ? "default" : "text",
        }}
      />
    </div>
  );
}

export default function FarmerProfile() {
  const { user, updateUser, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    phone:     user?.phone     || "",
    address:   user?.address   || "",
  });
  const [pwd, setPwd] = useState({ current_password: "", new_password: "", confirm: "" });
  const [pwdErr, setPwdErr] = useState("");

  useEffect(() => {
    refreshUser();
  }, []);

  useEffect(() => {
    setForm({
      full_name: user?.full_name || "",
      phone:     user?.phone     || "",
      address:   user?.address   || "",
    });
  }, [user]);

  const profileMut = useMutation({
    mutationFn: (body) => updateProfile(body),
    onSuccess: (data) => {
      if (data.user) updateUser({ ...user, ...data.user });
      toast.success("Hồ sơ đã được cập nhật!");
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Cập nhật thất bại"),
  });

  const pwdMut = useMutation({
    mutationFn: (body) => changePassword(body),
    onSuccess: () => {
      toast.success("Mật khẩu đã được thay đổi!");
      setPwd({ current_password: "", new_password: "", confirm: "" });
      setPwdErr("");
    },
    onError: (e) => {
      const msg = e?.response?.data?.message || "Thay đổi mật khẩu thất bại";
      setPwdErr(msg);
      toast.error(msg);
    },
  });

  const handleProfileSave = () => {
    if (!form.full_name.trim()) { toast.error("Họ tên không được để trống"); return; }
    profileMut.mutate(form);
  };

  const handlePasswordChange = () => {
    setPwdErr("");
    if (!pwd.current_password) { setPwdErr("Nhập mật khẩu hiện tại"); return; }
    if (!pwd.new_password || pwd.new_password.length < 6) { setPwdErr("Mật khẩu mới phải ít nhất 6 ký tự"); return; }
    if (pwd.new_password !== pwd.confirm) { setPwdErr("Mật khẩu xác nhận không khớp"); return; }
    pwdMut.mutate({ current_password: pwd.current_password, new_password: pwd.new_password });
  };

  const kycStatus = user?.kyc_status || "pending";

  return (
    <FarmerLayout title="Thông tin cá nhân">
      <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 20 }}>

        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>👤 Hồ Sơ Cá Nhân</h2>

        {/* Unified KYC Status & Documents Section */}
        <div style={{ 
          background: C.card, 
          borderRadius: 10, 
          border: `1px solid ${KYC_COLOR[kycStatus] || "#f0b90b"}40`, 
          overflow: "hidden" 
        }}>
          {/* Header Banner */}
          <div style={{ 
            padding: "16px 20px", 
            background: kycStatus === "approved" ? "rgba(14,203,129,0.04)" : kycStatus === "rejected" ? "rgba(246,70,93,0.04)" : "rgba(240,185,11,0.04)", 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            borderBottom: (user?.front_path || user?.back_path) ? `1px solid ${C.border}` : "none"
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>Trạng thái KYC</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Xác minh danh tính để thực hiện giao dịch đầy đủ</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {kycStatus === "rejected" && (
                <button 
                  onClick={() => navigate("/kyc-cccd")}
                  style={{ 
                    padding: "4px 10px", 
                    background: "rgba(246,70,93,0.1)", 
                    border: `1px solid ${C.red}`, 
                    color: C.red, 
                    borderRadius: 6, 
                    cursor: "pointer", 
                    fontSize: 11, 
                    fontWeight: 600 
                  }}
                >
                  Gửi lại yêu cầu
                </button>
              )}
              {(!user?.front_path && !user?.back_path && kycStatus !== "approved" && kycStatus !== "pending") && (
                <button 
                  onClick={() => navigate("/kyc-cccd")}
                  style={{ 
                    padding: "4px 10px", 
                    background: `${C.accent}15`, 
                    border: `1px solid ${C.accent}`, 
                    color: "#7fe0c9", 
                    borderRadius: 6, 
                    cursor: "pointer", 
                    fontSize: 11, 
                    fontWeight: 600 
                  }}
                >
                  Xác minh ngay
                </button>
              )}
              <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, background: `${KYC_COLOR[kycStatus] || "#f0b90b"}20`, color: KYC_COLOR[kycStatus] || "#f0b90b", fontWeight: 700 }}>
                {KYC_LABEL[kycStatus] || kycStatus}
              </span>
            </div>
          </div>

          {/* CCCD Documents */}
          {(user?.front_path || user?.back_path) && (
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: "#e2e8f0", marginBottom: 12, fontWeight: 700 }}>
                🪪 Ảnh CCCD Đã Gửi Xác Thực
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600, textTransform: "uppercase" }}>Ảnh Mặt Trước</div>
                  {user?.front_path ? (
                    <img 
                      src={user.front_path} 
                      alt="CCCD Mặt trước" 
                      style={{ width: "100%", maxHeight: 180, objectFit: "contain", borderRadius: 8, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)", padding: 4 }} 
                    />
                  ) : (
                    <div style={{ padding: "30px", background: "rgba(255,255,255,0.01)", textAlign: "center", borderRadius: 8, color: C.muted, fontSize: 12, border: `1px dashed ${C.border}` }}>Không có ảnh</div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600, textTransform: "uppercase" }}>Ảnh Mặt Sau</div>
                  {user?.back_path ? (
                    <img 
                      src={user.back_path} 
                      alt="CCCD Mặt sau" 
                      style={{ width: "100%", maxHeight: 180, objectFit: "contain", borderRadius: 8, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)", padding: 4 }} 
                    />
                  ) : (
                    <div style={{ padding: "30px", background: "rgba(255,255,255,0.01)", textAlign: "center", borderRadius: 8, color: C.muted, fontSize: 12, border: `1px dashed ${C.border}` }}>Không có ảnh</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Account Info (readonly) */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <div style={{ padding: "13px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700 }}>
            📋 Thông Tin Tài Khoản
          </div>
          <div style={{ padding: 20, display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Email" value={user?.email || ""} readOnly />
              <Field label="Vai trò" value="Farmer" readOnly />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="ID tài khoản" value={user?.id ? `#${user.id}` : "—"} readOnly />
              <Field label="Số CCCD" value={user?.id_number || "Chưa xác minh"} readOnly />
            </div>
          </div>
        </div>

        {/* Editable Profile */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <div style={{ padding: "13px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700 }}>
            ✏️ Chỉnh Sửa Hồ Sơ
          </div>
          <div style={{ padding: 20, display: "grid", gap: 14 }}>
            <Field label="Họ và tên *" value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Nguyễn Văn A" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Số điện thoại" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="0901234567" />
              <Field label="Địa chỉ" value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="TP.HCM" />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={handleProfileSave} disabled={profileMut.isPending}
                style={{ padding: "10px 24px", background: profileMut.isPending ? "#555" : C.accent, border: "none", borderRadius: 7, color: "#fff", fontWeight: 700, cursor: profileMut.isPending ? "not-allowed" : "pointer", fontSize: 13 }}>
                {profileMut.isPending ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
              {profileMut.isSuccess && <span style={{ color: C.green, fontSize: 13, fontWeight: 600 }}>✓ Đã lưu</span>}
            </div>
          </div>
        </div>

        {/* Wallet Address */}
        {user?.wallet_address && (
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ padding: "13px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700 }}>
              🔑 Địa Chỉ Ví External (MetaMask)
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "#e2e8f0", background: "rgba(255,255,255,0.03)", padding: "10px 14px", borderRadius: 7, border: `1px solid ${C.border}`, wordBreak: "break-all" }}>
                {user.wallet_address}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Dùng để rút token về blockchain Sepolia</div>
            </div>
          </div>
        )}

        {/* Change Password */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <div style={{ padding: "13px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700 }}>
            🔒 Đổi Mật Khẩu
          </div>
          <div style={{ padding: 20, display: "grid", gap: 12 }}>
            {[
              { key: "current_password", label: "Mật khẩu hiện tại" },
              { key: "new_password",     label: "Mật khẩu mới (tối thiểu 6 ký tự)" },
              { key: "confirm",          label: "Xác nhận mật khẩu mới" },
            ].map(({ key, label }) => (
              <Field key={key} label={label} type="password" value={pwd[key]}
                onChange={e => { setPwdErr(""); setPwd(p => ({ ...p, [key]: e.target.value })); }}
                placeholder="••••••••" />
            ))}

            {pwdErr && (
              <div style={{ padding: "8px 12px", background: "rgba(246,70,93,0.08)", border: "1px solid rgba(246,70,93,0.2)", borderRadius: 6, fontSize: 12, color: C.red }}>
                {pwdErr}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={handlePasswordChange} disabled={pwdMut.isPending}
                style={{ padding: "10px 24px", background: pwdMut.isPending ? "#555" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#e2e8f0", fontWeight: 700, cursor: pwdMut.isPending ? "not-allowed" : "pointer", fontSize: 13 }}>
                {pwdMut.isPending ? "Đang xử lý..." : "Cập nhật mật khẩu"}
              </button>
              {pwdMut.isSuccess && <span style={{ color: C.green, fontSize: 13, fontWeight: 600 }}>✓ Đã cập nhật</span>}
            </div>
          </div>
        </div>

      </div>
    </FarmerLayout>
  );
}
