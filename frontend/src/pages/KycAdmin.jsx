import { useEffect, useState } from "react";
import axios from "../utils/axiosClient";
import DashboardLayout from "../components/layout/DashboardLayout";

export default function KycAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { src, title }
  const [selectedItem, setSelectedItem] = useState(null); // For detailed modal

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/admin/kyc/pending`);
      setItems(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const review = async (id, action) => {
    const confirmMsg = action === "approve" 
      ? "Bạn có chắc chắn muốn DUYỆT yêu cầu KYC này?" 
      : "Bạn có chắc chắn muốn TỪ CHỐI yêu cầu KYC này?";
    if (!window.confirm(confirmMsg)) return;

    try {
      await axios.post(`/admin/kyc/${id}/review`, { action });
      alert(action === "approve" ? "Đã duyệt thành công" : "Đã từ chối yêu cầu");
      setSelectedItem(null);
      fetchPending();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || err.message);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <DashboardLayout title="Duyệt yêu cầu KYC">
      <div style={{ display: "grid", gap: 24, padding: "10px 0" }}>
        
        {/* HEADER PANEL */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#131b24",
          padding: "20px 24px",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Duyệt danh tính KYC</h1>
            <p style={{ color: "#9ca3af", margin: "4px 0 0 0", fontSize: 14 }}>
              Xác thực và phê duyệt hồ sơ CCCD của Farmers và Traders
            </p>
          </div>
          <div style={{
            background: "#1e293b",
            color: "#38bdf8",
            padding: "8px 16px",
            borderRadius: 12,
            fontWeight: 600,
            fontSize: 14,
            border: "1px solid rgba(56, 189, 248, 0.2)"
          }}>
            ⏳ Đang chờ duyệt: {items.length}
          </div>
        </div>

        {/* LOADING & EMPTY STATE */}
        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
            <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: 24 }}>🔄</span> Đang tải dữ liệu...
          </div>
        )}

        {!loading && items.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            background: "#131b24",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.06)",
            color: "#9ca3af",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h3 style={{ color: "#fff", margin: "0 0 8px 0" }}>Tất cả đã được xử lý!</h3>
            <p style={{ margin: 0, fontSize: 14 }}>Hiện tại không có yêu cầu KYC nào cần phê duyệt.</p>
          </div>
        )}

        {/* LIST TABLE */}
        {!loading && items.length > 0 && (
          <div style={{
            background: "#131b24",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#1a232d", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <th style={{ padding: "16px 20px", color: "#9ca3af", fontWeight: 600 }}>Khách hàng</th>
                  <th style={{ padding: "16px 20px", color: "#9ca3af", fontWeight: 600 }}>Số CCCD</th>
                  <th style={{ padding: "16px 20px", color: "#9ca3af", fontWeight: 600 }}>Thời gian gửi</th>
                  <th style={{ padding: "16px 20px", color: "#9ca3af", fontWeight: 600 }}>Hình ảnh CCCD</th>
                  <th style={{ padding: "16px 20px", color: "#9ca3af", fontWeight: 600, textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{it.full_name}</div>
                      <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>{it.email}</div>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <span style={{
                        background: it.id_number ? "rgba(56, 189, 248, 0.1)" : "rgba(239, 68, 68, 0.1)",
                        color: it.id_number ? "#38bdf8" : "#ef4444",
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 600,
                        border: it.id_number ? "1px solid rgba(56, 189, 248, 0.2)" : "1px solid rgba(239, 68, 68, 0.2)"
                      }}>
                        {it.id_number || "Không có số"}
                      </span>
                    </td>
                    <td style={{ padding: "16px 20px", color: "#e2e8f0", fontSize: 14 }}>
                      {formatDate(it.created_at)}
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", gap: 10 }}>
                        {it.front_path && (
                          <img
                            src={it.front_path}
                            alt="Front"
                            style={{ width: 60, height: 40, objectFit: "cover", borderRadius: 4, cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)" }}
                            onClick={() => setLightbox({ src: it.front_path, title: `Mặt trước CCCD - ${it.full_name}` })}
                          />
                        )}
                        {it.back_path && (
                          <img
                            src={it.back_path}
                            alt="Back"
                            style={{ width: 60, height: 40, objectFit: "cover", borderRadius: 4, cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)" }}
                            onClick={() => setLightbox({ src: it.back_path, title: `Mặt sau CCCD - ${it.full_name}` })}
                          />
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => setSelectedItem(it)}
                          style={{
                            background: "transparent",
                            color: "#e2e8f0",
                            border: "1px solid #475569",
                            padding: "6px 12px",
                            borderRadius: 8,
                            fontSize: 13,
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Chi tiết
                        </button>
                        <button
                          onClick={() => review(it.id, "approve")}
                          style={{
                            background: "#22c55e",
                            color: "#fff",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: 8,
                            fontSize: 13,
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Duyệt
                        </button>
                        <button
                          onClick={() => review(it.id, "reject")}
                          style={{
                            background: "#ef4444",
                            color: "#fff",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: 8,
                            fontSize: 13,
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Từ chối
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* LIGHTBOX MODAL */}
        {lightbox && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0, 0, 0, 0.85)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 9999,
              padding: 20
            }}
            onClick={() => setLightbox(null)}
          >
            <div style={{ color: "#fff", marginBottom: 16, fontSize: 18, fontWeight: 700 }}>
              {lightbox.title}
            </div>
            <img
              src={lightbox.src}
              alt="CCCD Zoom"
              style={{ maxWidth: "90%", maxHeight: "80%", objectFit: "contain", borderRadius: 8, boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}
            />
            <div style={{ color: "#9ca3af", marginTop: 16, fontSize: 13 }}>
              Nhấp vào bất kỳ đâu để đóng
            </div>
          </div>
        )}

        {/* DETAILED MODAL */}
        {selectedItem && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0, 0, 0, 0.7)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 9998,
              padding: 20
            }}
            onClick={() => setSelectedItem(null)}
          >
            <div
              style={{
                background: "#131b24",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.08)",
                width: 700,
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                padding: "20px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Chi tiết yêu cầu KYC</h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  style={{ background: "transparent", border: "none", color: "#9ca3af", fontSize: 20, cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: 24, display: "grid", gap: 20 }}>
                {/* User Info */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Tên khách hàng</label>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{selectedItem.full_name}</div>
                  </div>
                  <div>
                    <label style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Địa chỉ Email</label>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{selectedItem.email}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Số CCCD trích xuất</label>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, color: "#38bdf8" }}>
                      {selectedItem.id_number || "Không có dữ liệu"}
                    </div>
                  </div>
                  <div>
                    <label style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>Thời gian đăng ký</label>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                      {formatDate(selectedItem.created_at)}
                    </div>
                  </div>
                </div>

                {/* CCCD Documents */}
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 8 }}>
                    Hồ sơ ảnh CCCD
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginBottom: 4 }}>Mặt trước</div>
                      <img
                        src={selectedItem.front_path}
                        alt="Front card"
                        style={{ width: "100%", height: 180, objectFit: "contain", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", background: "#0b1113", cursor: "zoom-in" }}
                        onClick={() => setLightbox({ src: selectedItem.front_path, title: `Mặt trước CCCD - ${selectedItem.full_name}` })}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginBottom: 4 }}>Mặt sau</div>
                      <img
                        src={selectedItem.back_path}
                        alt="Back card"
                        style={{ width: "100%", height: 180, objectFit: "contain", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", background: "#0b1113", cursor: "zoom-in" }}
                        onClick={() => setLightbox({ src: selectedItem.back_path, title: `Mặt sau CCCD - ${selectedItem.full_name}` })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: "16px 24px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 12
              }}>
                <button
                  onClick={() => setSelectedItem(null)}
                  style={{
                    background: "transparent",
                    color: "#e2e8f0",
                    border: "1px solid #475569",
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 14,
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                >
                  Đóng
                </button>
                <button
                  onClick={() => review(selectedItem.id, "reject")}
                  style={{
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 14,
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                >
                  Từ chối
                </button>
                <button
                  onClick={() => review(selectedItem.id, "approve")}
                  style={{
                    background: "#22c55e",
                    color: "#fff",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 14,
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                >
                  Duyệt hồ sơ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
