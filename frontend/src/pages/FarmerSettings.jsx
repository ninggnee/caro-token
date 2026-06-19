import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import { changePassword } from "../services/orderApi";

const C = { accent: "#487573", muted: "#6b7a99", green: "#0ecb81", red: "#f6465d", card: "#172524", border: "rgba(72, 117, 115, 0.15)", tealLight: "#7fe0c9" };

function Section({ title, children }) {
  return (
    <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{title}</div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

function Toggle({ label, sub, checked, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 14, marginBottom: 14, borderBottom: `1px solid ${C.border}` }}>
      <div>
        <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>}
      </div>
      <div onClick={onChange}
        style={{ width: 42, height: 22, borderRadius: 11, background: checked ? C.tealLight : "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <div style={{ width: 18, height: 18, borderRadius: "50%", background: checked ? "#172524" : "#fff", position: "absolute", top: 2, left: checked ? 22 : 2, transition: "left 0.2s" }} />
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 14px",
  background: "rgba(255,255,255,0.03)", border: "1px solid " + C.border,
  borderRadius: 7, color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box",
};

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
      <div style={{ maxWidth: 680, margin: "0 auto", display: "grid", gap: 20 }}>

        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>⚙️ Cài Đặt</h2>

        {/* Account */}
        <Section title="Thông Tin Tài Khoản">
          <div style={{ display: "grid", gap: 14 }}>
            {[
              { label: "Email",          value: user?.email        || "—" },
              { label: "Họ và tên",      value: user?.full_name    || "—" },
              { label: "Vai trò",        value: "Farmer" },
              { label: "Trạng thái KYC", value: user?.kyc_status === "approved" ? "✓ Đã xác minh" : "⏳ Chờ duyệt" },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 13, color: C.muted }}>{r.label}</div>
                <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 500 }}>{r.value}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Security */}
        <Section title="Bảo Mật">
          <Toggle label="Cảnh báo đăng nhập"
            sub="Nhận thông báo khi tài khoản được truy cập từ thiết bị mới"
            checked={security.loginAlerts}
            onChange={() => toggle("security", "loginAlerts")} />

          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 12 }}>Đổi Mật Khẩu</div>
            <div style={{ display: "grid", gap: 10 }}>
              {[
                { key: "current", label: "Mật khẩu hiện tại" },
                { key: "next",    label: "Mật khẩu mới (tối thiểu 6 ký tự)" },
                { key: "confirm", label: "Xác nhận mật khẩu mới" },
              ].map(({ key, label }) => (
                <input key={key} type="password" placeholder={label} value={pwd[key]}
                  onChange={e => { setPwdErr(""); setPwd(p => ({ ...p, [key]: e.target.value })); }}
                  style={inputStyle} />
              ))}

              {pwdErr && (
                <div style={{ padding: "8px 12px", background: "rgba(246,70,93,0.08)", border: "1px solid rgba(246,70,93,0.2)", borderRadius: 6, fontSize: 12, color: C.red }}>
                  {pwdErr}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={handlePasswordSave} disabled={pwdMut.isPending}
                  style={{ padding: "10px 20px", background: pwdMut.isPending ? "rgba(255,255,255,0.03)" : "rgba(72,117,115,0.12)", border: `1px solid ${C.border}`, color: C.tealLight, borderRadius: 7, cursor: pwdMut.isPending ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.15s" }}>
                  {pwdMut.isPending ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
                </button>
                {pwdMut.isSuccess && <span style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>✓ Đã cập nhật</span>}
              </div>
            </div>
          </div>
        </Section>

        {/* Notifications */}
        <Section title="Tùy Chọn Thông Báo">
          <Toggle label="Cập nhật trạng thái batch"
            sub="Khi batch được duyệt, từ chối hoặc mint token"
            checked={notifs.batchUpdates} onChange={() => toggle("notifs", "batchUpdates")} />
          <Toggle label="Mint hoàn thành"
            sub="Khi token được mint thành công vào ví nội bộ"
            checked={notifs.mintComplete} onChange={() => toggle("notifs", "mintComplete")} />
          <Toggle label="Nạp & Rút tiền"
            sub="Khi giao dịch nạp/rút được xử lý"
            checked={notifs.deposits} onChange={() => toggle("notifs", "deposits")} />
          <div style={{ borderBottom: "none" }}>
            <Toggle label="Marketing & Cập nhật nền tảng"
              sub="Tin tức, tính năng mới và chương trình khuyến mãi"
              checked={notifs.marketing} onChange={() => toggle("notifs", "marketing")} />
          </div>
        </Section>

        {/* Display */}
        <Section title="Giao Diện">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 500 }}>Giao diện</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Chủ đề màu sắc của ứng dụng</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["Tối (Dark)", "Hệ thống"].map((t, i) => (
                <button key={t} style={{ padding: "6px 14px", background: i === 0 ? C.accent : "rgba(255,255,255,0.03)", border: `1px solid ${i === 0 ? C.tealLight : C.border}`, color: i === 0 ? "#fff" : C.muted, borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: i === 0 ? 700 : 400, transition: "all 0.15s" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <div style={{ padding: "12px 16px", background: "rgba(72,117,115,0.05)", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.muted }}>
          💡 Để thay đổi họ tên, số điện thoại và địa chỉ, vui lòng truy cập trang <strong style={{ color: C.tealLight }}>Hồ sơ cá nhân</strong>.
        </div>

      </div>
    </FarmerLayout>
  );
}
