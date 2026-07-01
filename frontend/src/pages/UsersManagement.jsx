import { useEffect, useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import axios from "../utils/axiosClient";

export default function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [abnormalActivities, setAbnormalActivities] = useState([]);
  const [loadingAbnormal, setLoadingAbnormal] = useState(false);

  // Edit Modal State
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    address: "",
    role: "trader",
    kyc_status: "pending",
    is_active: 1
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const roleParam = filter === "all" ? "" : `?role=${filter}`;
      const res = await axios.get(`/admin/users${roleParam}`);
      const sortedUsers = [...(res.data.users || [])].sort((a, b) => b.id - a.id);
      setUsers(sortedUsers);
    } catch (err) {
      console.error(err);
      alert("Không thể tải danh sách người dùng");
    } finally {
      setLoading(false);
    }
  };

  const fetchAbnormal = async () => {
    setLoadingAbnormal(true);
    try {
      const res = await axios.get("/admin/users/abnormal");
      setAbnormalActivities(res.data.activities || []);
    } catch (err) {
      console.error("fetchAbnormal error", err);
    } finally {
      setLoadingAbnormal(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAbnormal();
  }, [filter]);

  const handleEdit = (user) => {
    setEditingUser(user);
    setEditForm({
      full_name: user.full_name || "",
      email: user.email || "",
      phone: user.phone || "",
      address: user.address || "",
      role: user.role || "trader",
      kyc_status: user.kyc_status || "pending",
      is_active: user.is_active !== undefined ? user.is_active : 1
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editForm.full_name.trim()) return alert("Họ tên không được để trống");
    if (!editForm.email.trim()) return alert("Email không được để trống");

    try {
      const { kyc_status, ...updateData } = editForm;
      const res = await axios.put(`/admin/users/${editingUser.id}`, updateData);
      if (res.data.success) {
        alert("Cập nhật tài khoản thành công!");
        setEditingUser(null);
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Cập nhật thất bại");
    }
  };

  const handleDelete = async (userId) => {
    const confirmed = window.confirm("Bạn có chắc chắn muốn xóa người dùng này? Thao tác này không thể hoàn tác!");
    if (!confirmed) return;

    try {
      await axios.delete(`/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      alert("Xóa người dùng thành công");
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Xóa thất bại");
    }
  };

  const roleBadge = (role) => {
    let className = "caro-badge ";
    let text = role;
    if (role === "admin") { className += "caro-badge-danger"; text = "Admin"; }
    else if (role === "farmer") { className += "caro-badge-success"; text = "Farmer"; }
    else if (role === "trader") { className += "caro-badge-info"; text = "Trader"; }
    else { className += "caro-badge-muted"; }

    return (
      <span className={className}>
        <span className="caro-badge-dot"></span>
        {text}
      </span>
    );
  };

  const kycBadge = (status) => {
    let className = "caro-badge ";
    let text = status;
    if (status === "approved") { className += "caro-badge-success"; text = "Đã duyệt"; }
    else if (status === "rejected") { className += "caro-badge-danger"; text = "Từ chối"; }
    else { className += "caro-badge-warning"; text = "Chờ duyệt"; }

    return (
      <span className={className}>
        {text}
      </span>
    );
  };

  return (
    <DashboardLayout title="Quản lý người dùng">
      <div className="caro-page">
        {/* ── Header ── */}
        <div className="caro-page-header">
          <div>
            <h1 className="caro-page-title">Quản lý người dùng</h1>
            <div className="caro-page-subtitle">
              Quản lý và cập nhật thông tin toàn bộ thành viên trong hệ thống
            </div>
          </div>
          <div className="caro-badge caro-badge-muted" style={{ fontSize: 13, padding: "8px 16px" }}>
            👥 Tổng số: {users.length}
          </div>
        </div>

        {/* ── Filter ── */}
        <div className="caro-card caro-card-sm" style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px" }}>
          <span className="caro-label" style={{ margin: 0, fontSize: 13 }}>
            Lọc theo vai trò:
          </span>
          <div style={{ position: "relative", width: 200 }}>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="caro-input caro-select"
              style={{ padding: "8px 14px", height: "auto" }}
            >
              <option value="all">Tất cả</option>
              <option value="farmer">Farmer (Nông dân)</option>
              <option value="trader">Trader (Nhà giao dịch)</option>
              <option value="admin">Admin (Quản trị viên)</option>
            </select>
          </div>
        </div>

        {/* ── Users Table ── */}
        <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="caro-table-wrap">
            {loading ? (
              <div className="caro-empty">
                <span style={{ display: "inline-block", animation: "caro-spin 1s linear infinite", fontSize: 24 }}>🔄</span>
                <div className="caro-empty-title" style={{ marginTop: 10 }}>Đang tải người dùng...</div>
              </div>
            ) : (
              <table className="caro-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Họ và tên</th>
                    <th>Email</th>
                    <th>Số điện thoại</th>
                    <th>Vai trò</th>
                    <th>Trạng thái KYC</th>
                    <th>Hoạt động</th>
                    <th>Ví MetaMask</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, index) => (
                    <tr key={u.id}>
                      <td style={{ color: "#64748b" }}>{index + 1}</td>
                      <td style={{ fontWeight: 700, color: "#f8fafc" }}>{u.full_name || "—"}</td>
                      <td>{u.email}</td>
                      <td>{u.phone || "—"}</td>
                      <td>{roleBadge(u.role)}</td>
                      <td>{kycBadge(u.kyc_status)}</td>
                      <td>
                        {u.is_active === 0 ? (
                          <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                            🔒 Khóa
                          </span>
                        ) : (
                          <span style={{ color: "#B0E4CC", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                            🟢 Mở
                          </span>
                        )}
                      </td>
                      <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#94a3b8" }}>
                        {u.wallet_address && u.wallet_address.toLowerCase() !== "0x0ecbecfdb336a1b56d8f9cfd634844d0efd70cf4" ? u.wallet_address : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button onClick={() => handleEdit(u)} className="caro-btn caro-btn-ghost caro-btn-sm" style={{ color: "#408A71" }}>
                            Sửa
                          </button>
                          {u.role !== "admin" && (
                            <button onClick={() => handleDelete(u.id)} className="caro-btn caro-btn-ghost caro-btn-sm" style={{ color: "#ef4444" }}>
                              Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={9}>
                        <div className="caro-empty" style={{ padding: "40px 20px" }}>
                          <div className="caro-empty-icon">👥</div>
                          <div className="caro-empty-title">Không tìm thấy người dùng nào</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Abnormal Activities Section ── */}
        <div style={{ marginTop: 8 }}>
          <h2 style={{ margin: "0 0 6px 0", fontSize: 18, fontWeight: 800, color: "#ef4444", display: "flex", alignItems: "center", gap: 8 }}>
            ⚠️ Cảnh báo hành vi bất thường
          </h2>
          <div className="caro-page-subtitle" style={{ marginBottom: 16 }}>
            Các tài khoản phát hiện tần suất rút token quá nhanh (đúc & chuyển nhiều lần trong thời gian ngắn)
          </div>

          <div className="caro-card" style={{ padding: 0, overflow: "hidden", borderColor: "rgba(239,68,68,0.3)" }}>
            <div className="caro-table-wrap">
              {loadingAbnormal ? (
                <div style={{ color: "#9aa5b4", fontSize: 14, padding: 24, textAlign: "center" }}>Đang tải danh sách cảnh báo...</div>
              ) : (
                <table className="caro-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Thành viên</th>
                      <th>Email</th>
                      <th>Vai trò</th>
                      <th>Hành vi phát hiện</th>
                      <th>Thời gian phát hiện</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abnormalActivities.map((act, index) => (
                      <tr key={act.id}>
                        <td style={{ color: "#64748b" }}>{index + 1}</td>
                        <td style={{ fontWeight: 700, color: "#f8fafc" }}>{act.full_name || "—"}</td>
                        <td>{act.email}</td>
                        <td>{roleBadge(act.role)}</td>
                        <td style={{ color: "#ef4444", fontWeight: 600 }}>{act.description}</td>
                        <td style={{ color: "#94a3b8" }}>
                          {new Date(act.created_at).toLocaleString("vi-VN")}
                        </td>
                      </tr>
                    ))}
                    {abnormalActivities.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          <div className="caro-empty" style={{ padding: "30px 20px" }}>
                            <div className="caro-empty-icon" style={{ fontSize: 24, color: "#B0E4CC", opacity: 1 }}>✅</div>
                            <div className="caro-empty-title" style={{ marginTop: 8 }}>Chưa phát hiện hành vi bất thường nào</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── EDIT MODAL POPUP ── */}
      {editingUser && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
            background: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(4px)",
            display: "flex", justifyContent: "center", alignItems: "center",
            zIndex: 9999, padding: 20
          }}
        >
          <div
            className="caro-card"
            style={{ width: 500, maxWidth: "100%", padding: 0, display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)" }}
          >
            <div className="caro-section-header">
              <h3 className="caro-section-title" style={{ fontSize: 16 }}>Chỉnh sửa thông tin thành viên</h3>
              <button
                onClick={() => setEditingUser(null)}
                style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdate} style={{ padding: 24, display: "grid", gap: 16 }}>
              <div className="caro-field">
                <label className="caro-label">Họ và tên</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="caro-input"
                />
              </div>

              <div className="caro-field">
                <label className="caro-label">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="caro-input"
                />
              </div>

              <div className="caro-field">
                <label className="caro-label">Số điện thoại</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  className="caro-input"
                />
              </div>

              <div className="caro-field">
                <label className="caro-label">Địa chỉ</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                  className="caro-input"
                />
              </div>

              <div className="caro-field">
                <label className="caro-label">Vai trò</label>
                <div style={{ position: "relative" }}>
                  <select
                    value={editForm.role}
                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                    className="caro-input caro-select"
                  >
                    <option value="farmer">Farmer</option>
                    <option value="trader">Trader</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="caro-field">
                <label className="caro-label">Trạng thái tài khoản</label>
                <div style={{ position: "relative" }}>
                  <select
                    value={editForm.is_active}
                    onChange={e => setEditForm({ ...editForm, is_active: Number(e.target.value) })}
                    className="caro-input caro-select"
                  >
                    <option value={1}>🟢 Hoạt động</option>
                    <option value={0}>🔒 Khóa tài khoản</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setEditingUser(null)} className="caro-btn caro-btn-ghost">
                  Hủy
                </button>
                <button type="submit" className="caro-btn caro-btn-primary">
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}