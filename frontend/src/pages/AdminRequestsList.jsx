import { useEffect, useState } from 'react';
import DashboardLayout from "../components/layout/DashboardLayout";
import axios from '../utils/axiosClient';
import { toast } from 'react-toastify';
import { formatKg, formatToken } from '../utils/formatters';

export default function AdminRequestsList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/token/admin/requests');
      setItems(res.data.data || []);
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const review = async (id, action) => {
    try {
      let payload = { action };
      if (action === 'approve') {
        const t = window.prompt('Nhập mã token (CR1, CR2, CR3) để duyệt:', 'CR1');
        if (!t) return;
        payload.token_type = t;
      }
      await axios.post(`/token/admin/requests/${id}/review`, payload);
      toast.success(action === 'approve' ? "Đã duyệt yêu cầu!" : "Đã từ chối yêu cầu!");
      fetch();
    } catch (err) { 
      console.error(err); 
      alert(err?.response?.data?.message || err.message); 
    }
  };

  const mint = async (id) => {
    try {
      await axios.post(`/token/admin/requests/${id}/mint`, { tx_hash: null });
      toast.success("Mint token thành công!");
      fetch();
    } catch (err) { 
      console.error(err); 
      alert(err?.response?.data?.message || err.message); 
    }
  };

  return (
    <DashboardLayout title="Danh sách yêu cầu Token hóa">
      <div className="caro-page">
        <div className="caro-page-header">
          <div>
            <h1 className="caro-page-title">Yêu cầu Token hóa</h1>
            <p className="caro-page-subtitle">Quản lý và xét duyệt các yêu cầu mint token từ Farmer</p>
          </div>
        </div>

        <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="caro-table-wrap">
            <table className="caro-table">
              <thead>
                <tr>
                  <th>Mã Yêu Cầu</th>
                  <th>Mã Lô Hàng</th>
                  <th>Nông Dân</th>
                  <th>Khối Lượng</th>
                  <th>Số Token</th>
                  <th>Trạng Thái</th>
                  <th style={{ textAlign: "right" }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="caro-empty">
                        <span style={{ display: "inline-block", animation: "caro-spin 1s linear infinite", fontSize: 24 }}>🔄</span>
                        <div className="caro-empty-title" style={{ marginTop: 10 }}>Đang tải dữ liệu...</div>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="caro-empty" style={{ padding: "40px 20px" }}>
                        <div className="caro-empty-icon">📭</div>
                        <div className="caro-empty-title">Không có yêu cầu nào</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map(it => (
                    <tr key={it.id}>
                      <td style={{ fontWeight: 700, color: "#f8fafc" }}>#{it.id}</td>
                      <td style={{ color: "#408A71", fontFamily: "monospace" }}>{it.lot_id || 'Chưa đặt'}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: "#e2e8f0" }}>{it.full_name}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>{it.email}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatKg(it.kg_amount)}</td>
                      <td style={{ fontWeight: 600, color: "#B0E4CC" }}>{formatToken(it.token_amount)} CR</td>
                      <td>
                        <span className={`caro-badge ${
                          it.status === 'APPROVED' ? 'caro-badge-success' : 
                          it.status === 'REJECTED' ? 'caro-badge-danger' : 
                          it.status === 'MINTED' ? 'caro-badge-info' : 'caro-badge-warning'
                        }`}>
                          {it.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          {it.status === 'PENDING' && (
                            <>
                              <button onClick={() => review(it.id, 'approve')} className="caro-btn caro-btn-primary caro-btn-sm">Duyệt</button>
                              <button onClick={() => review(it.id, 'reject')} className="caro-btn caro-btn-danger caro-btn-sm">Từ chối</button>
                            </>
                          )}
                          {it.status === 'APPROVED' && (
                            <button onClick={() => mint(it.id)} className="caro-btn caro-btn-success caro-btn-sm">Mint Token</button>
                          )}
                          {it.status !== 'PENDING' && it.status !== 'APPROVED' && (
                            <span style={{ color: "#64748b", fontSize: 12 }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
