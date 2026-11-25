import { useEffect, useState } from "react";
import axios from "../utils/axiosClient";
import DashboardLayout from "../components/layout/DashboardLayout";
import SecureImage from "../components/SecureImage";

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
    if (!dateStr) return "—";
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
      <div className="caro-page">

        {/* ── HEADER PANEL ── */}
        <div className="caro-page-header">
          <div>
            <h1 className="caro-page-title">Duyệt danh tính KYC</h1>
            <p className="caro-page-subtitle">
              Xác thực và phê duyệt hồ sơ CCCD của Farmers và Traders
            </p>
          </div>
          <div className="caro-badge caro-badge-warning" style={{ fontSize: 13, padding: "8px 16px" }}>
            <span className="caro-badge-dot"></span> Đang chờ duyệt: {items.length}
          </div>
        </div>

        {/* ── LOADING & EMPTY STATE ── */}
        {loading && (
          <div className="caro-empty">
            <span style={{ display: "inline-block", animation: "caro-spin 1s linear infinite", fontSize: 24 }}>🔄</span>
            <div className="caro-empty-title" style={{ marginTop: 10 }}>Đang tải dữ liệu...</div>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="caro-empty caro-card">
            <div className="caro-empty-icon">🎉</div>
            <h3 className="caro-empty-title" style={{ color: "#fff", fontSize: 18, marginTop: 10 }}>Tất cả đã được xử lý!</h3>
            <p className="caro-empty-desc" style={{ marginTop: 4 }}>Hiện tại không có yêu cầu KYC nào cần phê duyệt.</p>
          </div>
        )}

        {/* ── LIST TABLE ── */}
        {!loading && items.length > 0 && (
          <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="caro-table-wrap">
              <table className="caro-table">
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th>Số CCCD</th>
                    <th>Thời gian gửi</th>
                    <th>Hình ảnh CCCD</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#f8fafc", marginBottom: 3 }}>{it.full_name}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>{it.email}</div>
                      </td>
                      <td>
                        {it.id_number ? (
                          <span className="caro-badge caro-badge-info" style={{ fontFamily: "monospace", fontSize: 12 }}>
                            {it.id_number}
                          </span>
                        ) : (
                          <span className="caro-badge caro-badge-danger" style={{ fontSize: 12 }}>
                            Không có số
                          </span>
                        )}
                      </td>
                      <td style={{ color: "#94a3b8", fontSize: 13 }}>
                        {formatDate(it.created_at)}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 10 }}>
                          {it.front_url && (
                            <div style={{ position: "relative", cursor: "pointer", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", width: 60, height: 40 }}
                                 onClick={() => setLightbox({ src: it.front_url, title: `Mặt trước CCCD - ${it.full_name}` })}>
                              <SecureImage path={it.front_url} alt="Front" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }}
                                   onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                                🔍
                              </div>
                            </div>
                          )}
                          {it.back_url && (
                            <div style={{ position: "relative", cursor: "pointer", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", width: 60, height: 40 }}
                                 onClick={() => setLightbox({ src: it.back_url, title: `Mặt sau CCCD - ${it.full_name}` })}>
                              <SecureImage path={it.back_url} alt="Back" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }}
                                   onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                                🔍
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button className="caro-btn caro-btn-ghost caro-btn-sm" onClick={() => setSelectedItem(it)}>
                            Chi tiết
                          </button>
                          <button className="caro-btn caro-btn-primary caro-btn-sm" onClick={() => review(it.id, "approve")}>
                            Duyệt
                          </button>
                          <button className="caro-btn caro-btn-danger caro-btn-sm" onClick={() => review(it.id, "reject")}>
                            Từ chối
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── LIGHTBOX MODAL ── */}
        {lightbox && (
          <div
            style={{
              position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
              background: "rgba(15, 23, 42, 0.9)", backdropFilter: "blur(4px)",
              display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
              zIndex: 9999, padding: 20
            }}
            onClick={() => setLightbox(null)}
          >
            <div style={{ color: "#fff", marginBottom: 16, fontSize: 18, fontWeight: 700, fontFamily: "'Manrope',sans-serif" }}>
              {lightbox.title}
            </div>
            <SecureImage
              path={lightbox.src}
              alt="CCCD Zoom"
              style={{ maxWidth: "90%", maxHeight: "80%", objectFit: "contain", borderRadius: 12, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}
            />
            <div style={{ color: "#94a3b8", marginTop: 16, fontSize: 13, background: "rgba(255,255,255,0.05)", padding: "8px 16px", borderRadius: 20 }}>
              Nhấp vào bất kỳ đâu để đóng
            </div>
          </div>
        )}

        {/* ── DETAILED MODAL ── */}
        {selectedItem && (
          <div
            style={{
              position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
              background: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(4px)",
              display: "flex", justifyContent: "center", alignItems: "center",
              zIndex: 9998, padding: 20
            }}
            onClick={() => setSelectedItem(null)}
          >
            <div
              className="caro-card"
              style={{
                width: 700, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto",
                padding: 0, display: "flex", flexDirection: "column",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="caro-section-header">
                <h3 className="caro-section-title" style={{ fontSize: 16 }}>Chi tiết yêu cầu KYC</h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: 24, display: "grid", gap: 24 }}>
                {/* User Info */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, background: "rgba(255,255,255,0.02)", padding: 16, borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div>
                    <label className="caro-label">Tên khách hàng</label>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc" }}>{selectedItem.full_name}</div>
                  </div>
                  <div>
                    <label className="caro-label">Địa chỉ Email</label>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc" }}>{selectedItem.email}</div>
                  </div>
                  <div>
                    <label className="caro-label">Số CCCD trích xuất</label>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#408A71", fontFamily: "monospace" }}>
                      {selectedItem.id_number || "Không có dữ liệu"}
                    </div>
                  </div>
                  <div>
                    <label className="caro-label">Thời gian đăng ký</label>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>
                      {formatDate(selectedItem.created_at)}
                    </div>
                  </div>
                </div>

                {/* CCCD Documents */}
                <div>
                  <label className="caro-label" style={{ marginBottom: 12 }}>
                    Hồ sơ ảnh CCCD
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 10 }}>
                      <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginBottom: 10, fontWeight: 600, textTransform: "uppercase" }}>Mặt trước</div>
                      <SecureImage
                        path={selectedItem.front_url}
                        alt="Front card"
                        style={{ width: "100%", height: 180, objectFit: "contain", borderRadius: 8, cursor: "zoom-in", background: "#0f172a" }}
                        onClick={() => setLightbox({ src: selectedItem.front_url, title: `Mặt trước CCCD - ${selectedItem.full_name}` })}
                      />
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 10 }}>
                      <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginBottom: 10, fontWeight: 600, textTransform: "uppercase" }}>Mặt sau</div>
                      <SecureImage
                        path={selectedItem.back_url}
                        alt="Back card"
                        style={{ width: "100%", height: 180, objectFit: "contain", borderRadius: 8, cursor: "zoom-in", background: "#0f172a" }}
                        onClick={() => setLightbox({ src: selectedItem.back_url, title: `Mặt sau CCCD - ${selectedItem.full_name}` })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
                background: "rgba(255,255,255,0.01)"
              }}>
                <button className="caro-btn caro-btn-ghost" onClick={() => setSelectedItem(null)}>
                  Đóng
                </button>
                <button className="caro-btn caro-btn-danger" onClick={() => review(selectedItem.id, "reject")}>
                  Từ chối
                </button>
                <button className="caro-btn caro-btn-primary" onClick={() => review(selectedItem.id, "approve")}>
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
