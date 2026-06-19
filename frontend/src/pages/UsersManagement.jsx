import { useEffect, useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import axios from "../utils/axiosClient";

export default function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");

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

  useEffect(() => {
    fetchUsers();
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
    const bg = role === "admin" ? "rgba(246,70,93,0.12)" : role === "farmer" ? "rgba(14,203,129,0.12)" : "rgba(56,189,248,0.12)";
    const color = role === "admin" ? "#f6465d" : role === "farmer" ? "#0ecb81" : "#38bdf8";
    const text = role === "admin" ? "Admin" : role === "farmer" ? "Farmer" : "Trader";

    return (
      <span style={{ background: bg, color, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
        {text}
      </span>
    );
  };

  const kycBadge = (status) => {
    const bg = status === "approved" ? "rgba(14,203,129,0.12)" : status === "rejected" ? "rgba(246,70,93,0.12)" : "rgba(240,185,11,0.12)";
    const color = status === "approved" ? "#0ecb81" : status === "rejected" ? "#f6465d" : "#f0b90b";
    const text = status === "approved" ? "Đã duyệt" : status === "rejected" ? "Bị từ chối" : "Chờ duyệt";

    return (
      <span style={{ background: bg, color, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
        {text}
      </span>
    );
  };

  return (
    <DashboardLayout title="Quản lý người dùng">
      <div style={{ display: "grid", gap: 20 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Quản lý người dùng</h1>
            <div style={{ color: "#9ca3af", marginTop: 6, fontSize: 13 }}>
              Quản lý và cập nhật thông tin toàn bộ thành viên trong hệ thống
            </div>
          </div>

          <div style={{ background: "#172524", padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(72,117,115,0.15)", fontSize: 13, color: "#9aa5b4" }}>
            👥 Tổng số người dùng: {users.length}
          </div>
        </div>

        {/* Filter */}
        <div style={{ background: "#172524", padding: 16, borderRadius: 16, border: "1px solid rgba(72,117,115,0.15)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#9ca3af", fontWeight: 600, fontSize: 13 }}>
            Lọc theo vai trò:
          </span>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ background: "#0d1413", color: "#fff", border: "1px solid rgba(72,117,115,0.2)", borderRadius: 8, padding: "8px 12px", outline: "none", fontSize: 13 }}
          >
            <option value="all">Tất cả</option>
            <option value="farmer">Farmer (Nông dân)</option>
            <option value="trader">Trader (Nhà giao dịch)</option>
            <option value="admin">Admin (Quản trị viên)</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ background: "#172524", padding: 20, borderRadius: 16, border: "1px solid rgba(72,117,115,0.15)", overflowX: "auto" }}>
          {loading ? (
            <div style={{ color: "#9aa5b4", fontSize: 14 }}>Đang tải người dùng...</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(72,117,115,0.15)" }}>
                  <th style={thStyle}>STT</th>
                  <th style={thStyle}>Họ và tên</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Số điện thoại</th>
                  <th style={thStyle}>Vai trò</th>
                  <th style={thStyle}>Trạng thái KYC</th>
                  <th style={thStyle}>Hoạt động</th>
                  <th style={thStyle}>Ví MetaMask</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {users.map((u, index) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid rgba(72,117,115,0.1)" }}>
                    <td style={tdStyle}>{index + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{u.full_name || "—"}</td>
                    <td style={tdStyle}>{u.email}</td>
                    <td style={tdStyle}>{u.phone || "—"}</td>
                    <td style={tdStyle}>{roleBadge(u.role)}</td>
                    <td style={tdStyle}>{kycBadge(u.kyc_status)}</td>
                    <td style={tdStyle}>
                      {u.is_active === 0 ? (
                        <span style={{ color: "#f6465d", fontSize: 12, fontWeight: 600 }}>🔒 Khóa</span>
                      ) : (
                        <span style={{ color: "#0ecb81", fontSize: 12, fontWeight: 600 }}>🟢 Hoạt động</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 12 }}>
                      {u.wallet_address || "—"}
                    </td>

                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={() => handleEdit(u)} style={editBtnStyle}>
                          ✏️ Sửa
                        </button>
                        {u.role !== "admin" && (
                          <button onClick={() => handleDelete(u.id)} style={deleteBtnStyle}>
                            🗑 Xóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {users.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: 30, color: "#9ca3af", fontSize: 14 }}>
                      Không tìm thấy người dùng nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* EDIT MODAL POPUP */}
      {editingUser && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0, 0, 0, 0.75)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, padding: 20 }}>
          <div style={{ background: "#172524", borderRadius: 16, border: "1px solid rgba(72,117,115,0.2)", width: 500, maxWeight: "90vw", overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(72,117,115,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#7fe0c9" }}>Chỉnh sửa thông tin thành viên</h3>
              <button onClick={() => setEditingUser(null)} style={{ background: "transparent", border: "none", color: "#9ca3af", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            
            <form onSubmit={handleUpdate} style={{ padding: 20, display: "grid", gap: 14 }}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Họ và tên</label>
                <input 
                  type="text" 
                  value={editForm.full_name} 
                  onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} 
                  style={inputStyle} 
                />
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Email</label>
                <input 
                  type="email" 
                  value={editForm.email} 
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })} 
                  style={inputStyle} 
                />
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Số điện thoại</label>
                <input 
                  type="text" 
                  value={editForm.phone} 
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })} 
                  style={inputStyle} 
                />
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Địa chỉ</label>
                <input 
                  type="text" 
                  value={editForm.address} 
                  onChange={e => setEditForm({ ...editForm, address: e.target.value })} 
                  style={inputStyle} 
                />
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Vai trò</label>
                <select 
                  value={editForm.role} 
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })} 
                  style={selectStyle}
                >
                  <option value="farmer">Farmer</option>
                  <option value="trader">Trader</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Trạng thái tài khoản</label>
                <select 
                  value={editForm.is_active} 
                  onChange={e => setEditForm({ ...editForm, is_active: Number(e.target.value) })} 
                  style={selectStyle}
                >
                  <option value={1}>🟢 Hoạt động</option>
                  <option value={0}>🔒 Khóa tài khoản</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setEditingUser(null)} style={cancelBtnStyle}>Hủy</button>
                <button type="submit" style={saveBtnStyle}>Lưu thay đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "14px 12px",
  color: "#9ca3af",
  fontWeight: 600,
  fontSize: 13
};

const tdStyle = {
  padding: "14px 12px",
  fontSize: 13,
  color: "#e2e8f0"
};

const editBtnStyle = {
  background: "transparent",
  border: "1px solid rgba(72,117,115,0.3)",
  color: "#7fe0c9",
  padding: "6px 12px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
  transition: "0.2s"
};

const deleteBtnStyle = {
  background: "transparent",
  border: "1px solid rgba(246,70,93,0.3)",
  color: "#f6465d",
  padding: "6px 12px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
  transition: "0.2s"
};

const formGroupStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 6
};

const labelStyle = {
  fontSize: 12,
  color: "#6b7a99",
  fontWeight: 600,
  textTransform: "uppercase"
};

const inputStyle = {
  background: "#0d1413",
  border: "1px solid rgba(72,117,115,0.2)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#fff",
  fontSize: 13,
  outline: "none"
};

const selectStyle = {
  background: "#0d1413",
  border: "1px solid rgba(72,117,115,0.2)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#fff",
  fontSize: 13,
  outline: "none",
  width: "100%"
};

const cancelBtnStyle = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(72,117,115,0.15)",
  color: "#9aa5b4",
  padding: "8px 16px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13
};

const saveBtnStyle = {
  background: "#487573",
  border: "none",
  color: "#fff",
  padding: "8px 16px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13
};