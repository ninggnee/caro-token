import { useEffect, useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import axios from "../utils/axiosClient";
import { useNavigate } from "react-router-dom";

export default function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");

  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);

      try {
        const roleParam =
          filter === "all"
            ? ""
            : `?role=${filter}`;

        const res = await axios.get(
          `/admin/users${roleParam}`
        );

        const sortedUsers = [...(res.data.users || [])].sort(
          (a, b) => b.id - a.id
        );

        setUsers(sortedUsers);
      } catch (err) {
        console.error(err);
        alert("Failed to load users");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [filter]);

  const handleEdit = (user) => {
    navigate(`/admin/users/${user.id}/edit`);
  };

  const handleDelete = async (userId) => {
    const confirmed = window.confirm(
      "Bạn có chắc chắn muốn xóa người dùng này?"
    );

    if (!confirmed) return;

    try {
      await axios.delete(`/admin/users/${userId}`);

      setUsers((prev) =>
        prev.filter((u) => u.id !== userId)
      );

      alert("Xóa thành công");
    } catch (err) {
      console.error(err);
      alert("Xóa thất bại");
    }
  };

  const roleBadge = (role) => {
    const styles = {
      admin: "#ef4444",
      farmer: "#22c55e",
      trader: "#3b82f6",
    };

    return (
      <span
        style={{
          background: styles[role] || "#6b7280",
          padding: "4px 10px",
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {role}
      </span>
    );
  };

  const kycBadge = (status) => {
    let color = "#6b7280";

    if (status === "approved") color = "#22c55e";
    if (status === "pending") color = "#f59e0b";
    if (status === "rejected") color = "#ef4444";

    return (
      <span
        style={{
          background: color,
          padding: "4px 10px",
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {status || "pending"}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div
        style={{
          display: "grid",
          gap: 20,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 800,
              }}
            >
              Users Management
            </h1>

            <div
              style={{
                color: "#9ca3af",
                marginTop: 6,
              }}
            >
              Quản lý toàn bộ người dùng hệ thống
            </div>
          </div>

          <div
            style={{
              background: "#131b24",
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            👥 Tổng người dùng: {users.length}
          </div>
        </div>

        {/* Filter */}
        <div
          style={{
            background: "#131b24",
            padding: 16,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              color: "#9ca3af",
              fontWeight: 600,
            }}
          >
            Lọc Role:
          </span>

          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value)
            }
            style={{
              background: "#0b1113",
              color: "#fff",
              border: "1px solid #374151",
              borderRadius: 8,
              padding: "8px 12px",
            }}
          >
            <option value="all">Tất cả</option>
            <option value="farmer">Farmer</option>
            <option value="trader">Trader</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {/* Table */}
        <div
          style={{
            background: "#131b24",
            padding: 20,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.06)",
            overflowX: "auto",
          }}
        >
          {loading ? (
            <div>Loading users...</div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom:
                      "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <th style={thStyle}>STT</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Họ tên</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>KYC</th>
                  <th style={thStyle}>Wallet</th>
                  <th style={thStyle}>Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {users.map((u, index) => (
                  <tr
                    key={u.id}
                    style={{
                      borderBottom:
                        "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <td style={tdStyle}>
                      {index + 1}
                    </td>

                    <td style={tdStyle}>
                      {u.email}
                    </td>

                    <td style={tdStyle}>
                      {u.full_name || "-"}
                    </td>

                    <td style={tdStyle}>
                      {roleBadge(u.role)}
                    </td>

                    <td style={tdStyle}>
                      {kycBadge(u.kyc_status)}
                    </td>

                    <td
                      style={{
                        ...tdStyle,
                        maxWidth: 180,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {u.wallet_address ||
                        u.wallet_farmer ||
                        u.wallet_trader ||
                        "-"}
                    </td>

                    <td style={tdStyle}>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                        }}
                      >
                        <button
                          onClick={() =>
                            handleEdit(u)
                          }
                          style={editBtn}
                        >
                          ✏️ Sửa
                        </button>

                        <button
                          onClick={() =>
                            handleDelete(u.id)
                          }
                          style={deleteBtn}
                        >
                          🗑 Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        textAlign: "center",
                        padding: 30,
                        color: "#9ca3af",
                      }}
                    >
                      Không có dữ liệu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "14px 12px",
  color: "#9ca3af",
  fontWeight: 600,
};

const tdStyle = {
  padding: "14px 12px",
};

const editBtn = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "8px 12px",
  borderRadius: 8,
  cursor: "pointer",
};

const deleteBtn = {
  background: "#dc2626",
  color: "#fff",
  border: "none",
  padding: "8px 12px",
  borderRadius: 8,
  cursor: "pointer",
};