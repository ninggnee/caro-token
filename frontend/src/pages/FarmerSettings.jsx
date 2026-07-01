import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import { changePassword } from "../services/orderApi";

function Section({ title, children }) {
  return (
    <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="caro-section-header">
        <h3 className="caro-section-title">{title}</h3>
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

function Toggle({ label, sub, checked, onChange, isLast }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: isLast ? 0 : 16, marginBottom: isLast ? 0 : 16, borderBottom: isLast ? "none" : "1px solid var(--border)" }}>
      <div>
        <div style={{ fontSize: 14, color: "#f8fafc", fontWeight: 700 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{sub}</div>}
      </div>
      <div onClick={onChange}
        style={{ width: 44, height: 24, borderRadius: 12, background: checked ? "#B0E4CC" : "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: checked ? "#0f172a" : "#cbd5e1", position: "absolute", top: 2, left: checked ? 22 : 2, transition: "left 0.2s" }} />
      </div>
    </div>
  );
}

export default function FarmerSettings() {
  const { user } = useAuth();

  const [notifs, setNotifs] = useState({ batchUpdates: true, mintComplete: true, deposits: true, marketing: false });
  const [security, setSecurity] = useState({ loginAlerts: true });

  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdErr, setPwdErr] = useState("");

  const toggle = (group, key) => {
    if (group === "notifs")   setNotifs(p   => ({ ...p, [key]: !p[key] }));
    if (group === "security") setSecurity(p => ({ ...p, [key]: !p[key] }));
  };

  // Password change — connected to backend
  const pwdMut = useMutation({
    mutationFn: (body) => changePassword(body),
    onSuccess: () => {
      toast.success("Mật khẩu đã được cập nhật!");
      setPwd({ current: "", next: "", confirm: "" });
      setPwdErr("");
    },
    onError: (e) => {
      const msg = e?.response?.data?.message || "Thay đổi mật khẩu thất bại";
      setPwdErr(msg);
      toast.error(msg);
    },
  });

  const handlePasswordSave = () => {
    setPwdErr("");
    if (!pwd.current)             { setPwdErr("Nhập mật khẩu hiện tại"); return; }
    if (pwd.next.length < 6)      { setPwdErr("Mật khẩu mới phải ít nhất 6 ký tự"); return; }
    if (pwd.next !== pwd.confirm) { setPwdErr("Mật khẩu xác nhận không khớp"); return; }
    pwdMut.mutate({ current_password: pwd.current, new_password: pwd.next });
  };

  return (
    <FarmerLayout title="Cài đặt">
      <div className="caro-page">

        <div className="caro-page-header">
          <div>
            <h2 className="caro-page-title">⚙️ Cài Đặt</h2>
            <p className="caro-page-subtitle">Quản lý bảo mật, thông báo và tùy chọn hiển thị</p>
          </div>
        </div>

        <div style={{ display: "grid", gap: 24 }}>

          {/* Account */}
          <Section title="Thông Tin Tài Khoản">
            <div style={{ display: "grid", gap: 16 }}>
              {[
                { label: "Email",          value: user?.email        || "—" },
                { label: "Họ và tên",      value: user?.full_name    || "—" },
                { label: "Vai trò",        value: "Farmer" },
                { label: "Trạng thái KYC", value: user?.kyc_status === "approved" ? "Đã xác minh" : "Chờ duyệt", isBadge: true, badgeColor: user?.kyc_status === "approved" ? "caro-badge-success" : "caro-badge-warning" },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>{r.label}</div>
                  {r.isBadge ? (
                    <div className={`caro-badge ${r.badgeColor}`}>{r.value}</div>
                  ) : (
                    <div style={{ fontSize: 14, color: "#f8fafc", fontWeight: 700 }}>{r.value}</div>
                  )}
                </div>
              ))}
            </div>
            
            <div style={{ marginTop: 24, padding: "12px 16px", background: "rgba(64, 138, 113,0.1)", borderRadius: 8, fontSize: 13, color: "#408A71", display: "flex", gap: 10 }}>
              <span>💡</span> Để thay đổi họ tên, số điện thoại và địa chỉ, vui lòng truy cập trang <strong>Hồ sơ cá nhân</strong>.
            </div>
          </Section>

          {/* Security */}
          <Section title="Bảo Mật">
            <Toggle label="Cảnh báo đăng nhập"
              sub="Nhận thông báo khi tài khoản được truy cập từ thiết bị mới"
              checked={security.loginAlerts}
              onChange={() => toggle("security", "loginAlerts")} />

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", marginBottom: 16 }}>Đổi Mật Khẩu</div>
              <div style={{ display: "grid", gap: 16 }}>
                {[
                  { key: "current", label: "Mật khẩu hiện tại" },
                  { key: "next",    label: "Mật khẩu mới (tối thiểu 6 ký tự)" },
                  { key: "confirm", label: "Xác nhận mật khẩu mới" },
                ].map(({ key, label }) => (
                  <div className="caro-field" key={key}>
                    <input type="password" placeholder={label} value={pwd[key]} className="caro-input"
                      onChange={e => { setPwdErr(""); setPwd(p => ({ ...p, [key]: e.target.value })); }}
                      />
                  </div>
                ))}

                {pwdErr && (
                  <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 13, color: "#ef4444" }}>
                    {pwdErr}
                  </div>
                )}

                <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
                  <button onClick={handlePasswordSave} disabled={pwdMut.isPending} className="caro-btn caro-btn-secondary">
                    {pwdMut.isPending ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
                  </button>
                  {pwdMut.isSuccess && <span style={{ fontSize: 13, color: "#B0E4CC", fontWeight: 700 }}>✓ Đã cập nhật thành công</span>}
                </div>
              </div>
            </div>
          </Section>

          {/* Notifications */}
          <Section title="Tùy Chọn Thông Báo">
            <Toggle label="Cập nhật trạng thái lô hàng"
              sub="Khi lô hàng được duyệt, từ chối hoặc mint token"
              checked={notifs.batchUpdates} onChange={() => toggle("notifs", "batchUpdates")} />
            <Toggle label="Mint hoàn thành"
              sub="Khi token được mint thành công vào ví nội bộ"
              checked={notifs.mintComplete} onChange={() => toggle("notifs", "mintComplete")} />
            <Toggle label="Nạp & Rút tiền"
              sub="Khi giao dịch nạp/rút được xử lý"
              checked={notifs.deposits} onChange={() => toggle("notifs", "deposits")} />
            <Toggle label="Tin tức & Cập nhật nền tảng"
              sub="Tin tức, tính năng mới và chương trình khuyến mãi"
              checked={notifs.marketing} onChange={() => toggle("notifs", "marketing")} isLast />
          </Section>

          {/* Display */}
          <Section title="Giao Diện">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, color: "#f8fafc", fontWeight: 700 }}>Chủ đề màu sắc</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Theme của ứng dụng (mặc định Navy Dark)</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {["Tối (Dark)", "Hệ thống"].map((t, i) => (
                  <button key={t} className={`caro-btn caro-btn-sm ${i === 0 ? "caro-btn-primary" : "caro-btn-ghost"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </Section>

        </div>
      </div>
    </FarmerLayout>
  );
}
