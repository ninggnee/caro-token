import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { MapContainer, TileLayer, Polygon, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import { updateProfile, changePassword } from "../services/orderApi";

function MapUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

const KYC_COLOR = { approved: "#B0E4CC", pending: "#f59e0b", rejected: "#ef4444" };
const KYC_LABEL = { approved: "✓ Đã xác minh", pending: "⏳ Đang chờ duyệt", rejected: "✗ Bị từ chối" };

function calculatePolygonArea(coordsString) {
  try {
    const coords = JSON.parse(coordsString);
    if (!Array.isArray(coords) || coords.length < 3) return 0;
    
    const lat0 = coords[0][0];
    const lng0 = coords[0][1];
    const rLat = (lat0 * Math.PI) / 180;
    const kx = 111320 * Math.cos(rLat);
    const ky = 111132;
    
    const pts = coords.map(c => ({
      x: (c[1] - lng0) * kx,
      y: (c[0] - lat0) * ky
    }));
    
    let area = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += pts[i].x * pts[j].y;
      area -= pts[j].x * pts[i].y;
    }
    const sqMeters = Math.abs(area) / 2;
    return Number((sqMeters / 10000).toFixed(2));
  } catch (e) {
    return 0;
  }
}

// DB stores farm_area as DECIMAL(12,4) (e.g. "5.4700"); strip it down to a clean
// display value with at most 2 decimals (e.g. "5.47") for the editable input.
function formatAreaValue(val) {
  if (val === null || val === undefined || val === "") return "";
  const n = Number(val);
  if (Number.isNaN(n)) return "";
  return String(Math.round(n * 100) / 100);
}

const TAY_NGUYEN_FARMS = [
  { 
    name: "Buôn Ma Thuột, Đắk Lắk", 
    coords: "[[12.6742, 107.9939], [12.6742, 108.0039], [12.6842, 108.0039], [12.6842, 107.9939]]", 
    area: 4.2, 
    soil: "Đất đỏ basalt" 
  },
  { 
    name: "Lâm Hà, Lâm Đồng", 
    coords: "[[11.9082, 108.4082], [11.9082, 108.4182], [11.9182, 108.4182], [11.9182, 108.4082]]", 
    area: 6.5, 
    soil: "Đất feralit mùn vàng" 
  },
  { 
    name: "Chư Sê, Gia Lai", 
    coords: "[[13.9222, 107.8992], [13.9222, 107.9092], [13.9322, 107.9092], [13.9322, 107.8992]]", 
    area: 7.8, 
    soil: "Đất đỏ basalt tơi xốp" 
  },
  { 
    name: "Đắk Mil, Đắk Nông", 
    coords: "[[12.4182, 107.5882], [12.4182, 107.5982], [12.4282, 107.5982], [12.4282, 107.5882]]", 
    area: 5.6, 
    soil: "Đất đỏ basalt phong hóa" 
  }
];

export default function FarmerProfile() {
  const { user, updateUser, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    phone:     user?.phone     || "",
    address:   user?.address   || "",
    farm_code:      user?.farm_code || "",
    farm_area:      formatAreaValue(user?.farm_area),
    farm_location:  user?.farm_location || "",
    farm_soil_type: user?.farm_soil_type || "",
    farm_coords:    user?.farm_coords || "",
  });
  
  const [selectedCerts, setSelectedCerts] = useState([]);
  const [pwd, setPwd] = useState({ current_password: "", new_password: "", confirm: "" });
  const [pwdErr, setPwdErr] = useState("");
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");

  useEffect(() => {
    refreshUser();
  }, []);

  useEffect(() => {
    let parsed = [];
    if (user?.certifications) {
      try {
        parsed = JSON.parse(user.certifications);
        if (!Array.isArray(parsed)) parsed = [];
      } catch (e) {
        parsed = user.certifications.split(",").map(c => c.trim()).filter(Boolean).map(c => ({
          name: c, file_name: "", ipfs_cid: ""
        }));
      }
    }

    setForm({
      full_name: user?.full_name || "",
      phone:     user?.phone     || "",
      address:   user?.address   || "",
      farm_code:      user?.farm_code || "",
      farm_area:      formatAreaValue(user?.farm_area),
      farm_location:  user?.farm_location || "",
      farm_soil_type: user?.farm_soil_type || "",
      farm_coords:    user?.farm_coords || "",
    });
    setSelectedCerts(parsed);
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

  // Diện tích: 1-10 ha, tối đa 2 chữ số thập phân. Chặn ký tự không hợp lệ ngay khi gõ,
  // phần range 1-10 được kiểm tra khi lưu (để không chặn việc gõ tuần tự, VD gõ "1" trước khi ra "10").
  const handleFarmAreaChange = (e) => {
    const raw = e.target.value;
    if (raw === "" || /^\d{0,2}(\.\d{0,2})?$/.test(raw)) {
      setForm(f => ({ ...f, farm_area: raw }));
    }
  };

  const validateFarmArea = () => {
    if (form.farm_area === "" || form.farm_area == null) return true;
    const areaStr = String(form.farm_area).trim();
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(areaStr)) {
      toast.error("Diện tích chỉ được nhập tối đa 2 chữ số thập phân");
      return false;
    }
    const area = Number(areaStr);
    if (area < 1 || area > 10) {
      toast.error("Diện tích phải trong khoảng 1 - 10 ha");
      return false;
    }
    return true;
  };

  const handleProfileSave = () => {
    if (!form.full_name.trim()) { toast.error("Họ tên không được để trống"); return; }
    if (!validateFarmArea()) return;
    profileMut.mutate({
      ...form,
      certifications: JSON.stringify(selectedCerts)
    });
  };

  const handleAnalyzePolygon = () => {
    setIsScanning(true);
    setScanStatus("Scanning satellite imagery...");
    
    setForm(f => ({
      ...f,
      farm_coords: "",
      farm_area: "",
      farm_location: "",
      farm_soil_type: ""
    }));

    setTimeout(() => { setScanStatus("Detecting boundaries..."); }, 500);
    setTimeout(() => { setScanStatus("Generating polygon..."); }, 1000);

    setTimeout(() => {
      const mockFarm = TAY_NGUYEN_FARMS[Math.floor(Math.random() * TAY_NGUYEN_FARMS.length)];
      setForm(f => ({
        ...f,
        farm_code: "",
        farm_coords: mockFarm.coords,
        farm_area: mockFarm.area,
        farm_location: mockFarm.name,
        farm_soil_type: mockFarm.soil
      }));
      setIsScanning(false);
      toast.success("GPS Polygon synchronized!");
    }, 1500);
  };

  const handlePasswordChange = () => {
    setPwdErr("");
    if (!pwd.current_password) { setPwdErr("Nhập mật khẩu hiện tại"); return; }
    if (!pwd.new_password || pwd.new_password.length < 6) { setPwdErr("Mật khẩu mới phải ít nhất 6 ký tự"); return; }
    if (pwd.new_password !== pwd.confirm) { setPwdErr("Mật khẩu xác nhận không khớp"); return; }
    pwdMut.mutate({ current_password: pwd.current_password, new_password: pwd.new_password });
  };

  const kycStatus = user?.kyc_status || "pending";
  const truncateWallet = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "Chưa kết nối";

  const province = form.farm_location ? form.farm_location.split(",")[1]?.trim() : "";
  const district = form.farm_location ? form.farm_location.split(",")[0]?.trim() : "";

  const renderMapEmbed = () => {
    let lat = 14.0583; // center vietnam approx (Tay Nguyen)
    let lng = 108.2772;
    let zoom = 6;
    let polygonPositions = [];

    if (form.farm_coords) {
      try {
        const coords = JSON.parse(form.farm_coords);
        if (coords && coords.length > 0) {
          polygonPositions = coords;
          lat = coords[0][0];
          lng = coords[0][1];
          zoom = 15;
        }
      } catch (e) {}
    }

    const center = [lat, lng];

    return (
      <div style={{ position: "relative", width: "100%", height: "260px", borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(72,117,115,0.3)", zIndex: 0 }}>
        <MapContainer center={center} zoom={zoom} style={{ width: '100%', height: '100%', zIndex: 1 }} zoomControl={false} scrollWheelZoom={true}>
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            maxZoom={18}
          />
          {polygonPositions.length > 0 && (
            <Polygon positions={polygonPositions} pathOptions={{ color: '#B0E4CC', fillColor: '#B0E4CC', fillOpacity: 0.3, weight: 2 }} />
          )}
          <MapUpdater center={center} zoom={zoom} />
        </MapContainer>
        
        {isScanning && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 20,
            background: "rgba(15,23,42,0.85)", backdropFilter: "blur(4px)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12
          }}>
            <span style={{ fontSize: 32, display: "inline-block", animation: "caro-spin 1s linear infinite" }}>🔄</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#B0E4CC", textTransform: "uppercase" }}>{scanStatus}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <FarmerLayout title="Thông tin cá nhân">
      <div className="caro-page">
        
        <div className="caro-page-header">
          <div>
            <h1 className="caro-page-title">Hồ sơ nhà nông (Farmer Profile)</h1>
            <p className="caro-page-subtitle">Quản lý thông tin cá nhân và định vị vùng trồng RWA</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span className="caro-badge caro-badge-info">Farmer</span>
            <span className="caro-badge caro-badge-success">✓ Verified</span>
          </div>
        </div>

        {/* Top metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          <div className="caro-card caro-card-sm" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 24, opacity: 0.8 }}>📐</div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>TỔNG DIỆN TÍCH</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc" }}>{form.farm_area ? `${form.farm_area} Ha` : "Chưa liên kết"}</div>
            </div>
          </div>
          <div className="caro-card caro-card-sm" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 24, opacity: 0.8 }}>🪪</div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>KYC STATUS</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: KYC_COLOR[kycStatus] }}>{KYC_LABEL[kycStatus]}</div>
            </div>
          </div>
          <div className="caro-card caro-card-sm" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 24, opacity: 0.8 }}>🪙</div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>SẢN LƯỢNG ƯỚC TÍNH</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#408A71" }}>{form.farm_area ? `${(form.farm_area * 1000).toLocaleString()} CR` : "0.00 CR"}</div>
            </div>
          </div>
        </div>

        {/* Two-Column Dashboard Layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 24, alignItems: "start" }}>
          
          {/* COLUMN 1: Personal Info + Password */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            <div className="caro-card" style={{ textAlign: "center", padding: "30px 20px" }}>
              <div style={{ 
                width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg, #B0E4CC, #408A71)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 800, color: "#0f172a",
                margin: "0 auto 16px"
              }}>
                {form.full_name ? form.full_name.charAt(0) : "F"}
              </div>
              <h3 style={{ margin: "0 0 4px", fontSize: 18, color: "#f8fafc" }}>{form.full_name || "Nông Dân CaRo"}</h3>
              <div style={{ color: "#408A71", fontSize: 13, fontWeight: 600 }}>Nhà sản xuất cà phê RWA</div>
              <div style={{ marginTop: 16, fontSize: 12, display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#64748b" }}>ID tài khoản</span> <strong>#{user?.id || "—"}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#64748b" }}>Ví External</span> <strong style={{ fontFamily: "monospace", color: "#f8fafc" }}>{truncateWallet(user?.wallet_address)}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#64748b" }}>Ngày tham gia</span> <strong>{user?.created_at ? new Date(user.created_at).toLocaleDateString("vi-VN") : "—"}</strong></div>
              </div>
            </div>

            <div className="caro-card">
              <div className="caro-section-header">
                <h3 className="caro-section-title">Thông tin cá nhân</h3>
              </div>
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="caro-field">
                    <label className="caro-label">Họ và tên *</label>
                    <input type="text" className="caro-input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Nguyễn Văn A" />
                  </div>
                  <div className="caro-field">
                    <label className="caro-label">Số điện thoại</label>
                    <input type="text" className="caro-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0901234567" />
                  </div>
                </div>

                <div className="caro-field">
                  <label className="caro-label">Địa chỉ</label>
                  <input type="text" className="caro-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Đắk Lắk, Việt Nam" />
                </div>
                
                <div className="caro-field">
                  <label className="caro-label">Email (Không thể sửa)</label>
                  <input type="email" className="caro-input" value={user?.email || ""} readOnly />
                </div>

                <div>
                  <button onClick={handleProfileSave} disabled={profileMut.isPending} className="caro-btn caro-btn-primary" style={{ width: "100%" }}>
                    {profileMut.isPending ? "Đang lưu..." : "Lưu thông tin cá nhân"}
                  </button>
                </div>
              </div>
            </div>

            <div className="caro-card">
              <div className="caro-section-header">
                <h3 className="caro-section-title" style={{ color: "#ef4444" }}>Đổi mật khẩu bảo mật</h3>
              </div>
              <div style={{ display: "grid", gap: 16 }}>
                <div className="caro-field">
                  <label className="caro-label">Mật khẩu hiện tại</label>
                  <input type="password" className="caro-input" value={pwd.current_password} onChange={e => { setPwdErr(""); setPwd(p => ({ ...p, current_password: e.target.value })); }} />
                </div>
                <div className="caro-field">
                  <label className="caro-label">Mật khẩu mới</label>
                  <input type="password" className="caro-input" value={pwd.new_password} onChange={e => { setPwdErr(""); setPwd(p => ({ ...p, new_password: e.target.value })); }} />
                </div>
                <div className="caro-field">
                  <label className="caro-label">Xác nhận mật khẩu</label>
                  <input type="password" className="caro-input" value={pwd.confirm} onChange={e => { setPwdErr(""); setPwd(p => ({ ...p, confirm: e.target.value })); }} />
                </div>
                
                {pwdErr && (
                  <div style={{ padding: "10px", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 13, borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)" }}>
                    {pwdErr}
                  </div>
                )}
                
                <div>
                  <button onClick={handlePasswordChange} disabled={pwdMut.isPending} className="caro-btn caro-btn-danger" style={{ width: "100%" }}>
                    {pwdMut.isPending ? "Đang xử lý..." : "Cập nhật mật khẩu"}
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* COLUMN 2: Farm Map + Info + Certifications */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            <div className="caro-card">
              <div className="caro-section-header">
                <h3 className="caro-section-title">Bản đồ vùng trồng</h3>
              </div>
              
              <div className="caro-field">
                <label className="caro-label">Tọa độ vệ tinh (GPS Polygon)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" className="caro-input" value={form.farm_coords ? "Đã liên kết dữ liệu GPS" : ""} placeholder="Chưa có dữ liệu" readOnly style={{ flex: 1, fontFamily: "monospace" }} />
                  <button onClick={handleAnalyzePolygon} disabled={isScanning} className="caro-btn caro-btn-success">
                    {isScanning ? "Đang quét..." : "Đọc GPS"}
                  </button>
                </div>
              </div>

              {renderMapEmbed()}
            </div>

            <div className="caro-card">
              <div className="caro-section-header">
                <h3 className="caro-section-title">Thông tin canh tác</h3>
              </div>
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="caro-field">
                    <label className="caro-label">Mã vùng trồng</label>
                    <input type="text" className="caro-input" value={form.farm_code} onChange={e => setForm(f => ({ ...f, farm_code: e.target.value }))} placeholder="VD: CARO-FARM-842" />
                  </div>
                  <div className="caro-field">
                    <label className="caro-label">Diện tích (ha)</label>
                    <input
                      type="number" className="caro-input" min="1" max="10" step="0.01"
                      value={form.farm_area}
                      onChange={handleFarmAreaChange}
                      placeholder="VD: 5.47"
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="caro-field">
                    <label className="caro-label">Loại đất</label>
                    <input type="text" className="caro-input" value={form.farm_soil_type} onChange={e => setForm(f => ({ ...f, farm_soil_type: e.target.value }))} placeholder="VD: Đất đỏ basalt" />
                  </div>
                  <div className="caro-field">
                    <label className="caro-label">Địa phương</label>
                    <input type="text" className="caro-input" value={form.farm_location} placeholder="Chưa có dữ liệu" readOnly />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="caro-field">
                    <label className="caro-label">Tỉnh thành</label>
                    <input type="text" className="caro-input" value={province} placeholder="Chưa có dữ liệu" readOnly />
                  </div>
                  <div className="caro-field">
                    <label className="caro-label">Quận huyện</label>
                    <input type="text" className="caro-input" value={district} placeholder="Chưa có dữ liệu" readOnly />
                  </div>
                </div>

                <div>
                  <button onClick={handleProfileSave} disabled={profileMut.isPending} className="caro-btn caro-btn-primary">
                    Lưu thông tin vùng trồng
                  </button>
                </div>
              </div>
            </div>

            <div className="caro-card">
              <div className="caro-section-header">
                <h3 className="caro-section-title">Chứng nhận nông nghiệp</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {["VietGAP", "4C", "Rainforest Alliance", "Organic", "UTZ"].map(c => {
                  const certObj = selectedCerts.find(x => x.name === c);
                  const isChecked = !!certObj;
                  
                  return (
                    <div key={c} style={{
                      padding: 12, background: isChecked ? "rgba(176, 228, 204,0.05)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${isChecked ? "rgba(176, 228, 204,0.4)" : "rgba(255,255,255,0.05)"}`,
                      borderRadius: 10, display: "flex", flexDirection: "column", gap: 8
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, color: isChecked ? "#f8fafc" : "#94a3b8" }}>
                          <input type="checkbox" checked={isChecked} onChange={() => {
                            if (isChecked) setSelectedCerts(prev => prev.filter(x => x.name !== c));
                            else setSelectedCerts(prev => [...prev, { name: c, file_name: "", ipfs_cid: "" }]);
                          }} style={{ width: 16, height: 16, accentColor: "#B0E4CC" }} />
                          {c}
                        </label>
                      </div>

                      {isChecked && (
                        <div style={{ marginLeft: 24 }}>
                          {certObj.file_name ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.2)", padding: "8px 12px", borderRadius: 8 }}>
                              <span style={{ fontSize: 13, color: "#f8fafc", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>📄 {certObj.file_name}</span>
                              <button onClick={() => setSelectedCerts(prev => prev.map(x => x.name === c ? { ...x, file_name: "", ipfs_cid: "" } : x))} className="caro-btn caro-btn-ghost caro-btn-sm" style={{ color: "#ef4444", padding: "4px 8px" }}>Xóa</button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <input
                                type="file" accept=".pdf,.jpg,.jpeg,.png" id={`file-input-${c}`}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const fd = new FormData(); fd.append("file", file);
                                  toast.info(`Đang tải lên ${c}...`);
                                  try {
                                    const response = await fetch('/api/auth/upload-cert', { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }, body: fd });
                                    const resData = await response.json();
                                    if (resData.success) {
                                      setSelectedCerts(prev => prev.map(x => x.name === c ? { ...x, file_name: resData.file_name, ipfs_cid: resData.ipfs_cid } : x));
                                      toast.success("Tải lên thành công!");
                                    } else toast.error("Tải lên thất bại");
                                  } catch (err) { toast.error("Lỗi khi tải lên file"); }
                                  e.target.value = "";
                                }}
                                style={{ display: "none" }}
                              />
                              <button onClick={() => document.getElementById(`file-input-${c}`)?.click()} className="caro-btn caro-btn-ghost caro-btn-sm" style={{ fontSize: 12 }}>
                                📤 Tải tài liệu (.pdf, .png)
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div style={{ marginTop: 8 }}>
                  <button onClick={handleProfileSave} disabled={profileMut.isPending} className="caro-btn caro-btn-primary">
                    Lưu chứng nhận canh tác
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </FarmerLayout>
  );
}
