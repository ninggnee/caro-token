import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "../utils/axiosClient";
import { useAuth } from "../context/AuthContext";
import "../styles/kyc.css";

export default function KycCccd() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);

  const [ocr, setOcr] = useState({
    fullname: "",
    id: "",
    dob: "",
    gender: "",
    nationality: "",
    address: "",
  });

  const role = auth.user?.role || "farmer";
  const [loading, setLoading] = useState(false);

  const handleFile = async (e, setter, isFront = false) => {
    const f = e.target.files[0];

    if (f) {
      const updatedFile = Object.assign(f, {
        preview: URL.createObjectURL(f),
      });
      setter(updatedFile);

      const currentFront = isFront ? updatedFile : front;
      const currentBack = !isFront ? updatedFile : back;

      if (currentFront && currentBack) {
        setLoading(true);
        try {
          const fd = new FormData();
          fd.append("front", currentFront);
          fd.append("back", currentBack);

          const res = await axios.post("/kyc/ocr", fd, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });

          if (res.data?.success && res.data?.data) {
            const info = res.data.data;
            setOcr({
              fullname: info.name !== "N/A" ? info.name || "" : "",
              id: info.id !== "N/A" ? info.id || "" : "",
              dob: info.dob !== "N/A" ? info.dob || "" : "",
              gender: info.sex !== "N/A" ? info.sex || "" : "",
              nationality: info.nationality !== "N/A" ? info.nationality || "Việt Nam" : "Việt Nam",
              address: info.address !== "N/A" ? info.address || "" : "",
            });
          } else {
            alert(res.data?.message || "Không thể nhận dạng OCR của CCCD");
          }
        } catch (err) {
          console.error("OCR Error:", err);
          alert(err?.response?.data?.message || "Lỗi khi nhận dạng OCR của CCCD");
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const handleSubmit = async () => {
    if (!front || !back) {
      return alert(
        "Vui lòng tải lên cả mặt trước và mặt sau CCCD"
      );
    }

    setLoading(true);

    try {
      const fd = new FormData();

      fd.append("front", front);
      fd.append("back", back);
      fd.append("id_number", ocr.id);
      fd.append("full_name", ocr.fullname);

      const res = await axios.post(
        "/kyc/submit",
        fd,
        {
          headers: {
            "Content-Type":
              "multipart/form-data",
          },
        }
      );

      if (res.data?.success) {
        alert("KYC đã gửi. Trạng thái: Chờ duyệt");

        if (auth.refreshUser) {
          try {
            await auth.refreshUser();
          } catch (e) {
            console.error("Refresh user error:", e);
          }
        }

        navigate("/register-wallet");
      } else {
        alert(
          res.data?.message ||
            "Lỗi khi gửi KYC"
        );
      }
    } catch (err) {
      console.error(err);

      alert(
        err?.response?.data?.message ||
          err.message ||
          "Lỗi mạng"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="kyc-page">
      {/* LEFT */}

      <div className="kyc-left">
        <div className="hero-badge">
          Real World Asset • Coffee Tokenization
        </div>

        <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
          <h1>CaRo Exchange</h1>
        </Link>

        <p style={{ marginTop: 8 }}>
          Xác thực danh tính bằng CCCD để tham gia giao dịch tài sản số hóa trên CaRo Exchange.
        </p>

        <div className="kyc-features">
          <div>
            🪪 Đối chiếu thông tin CCCD
          </div>
          <div>
            🛡️ Xác thực danh tính số
          </div>
          <div>
            🌱 Phê duyệt tham gia hệ sinh thái
          </div>
          <div>
            ⚖️ Tuân thủ quy định KYC/AML
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="kyc-right">
        <div className="kyc-card">
          {/* STEPPER */}

          <div className="stepper">
            <div className="step-item">
              <div className="step">1</div>
              <span>Tài khoản</span>
            </div>

            <div className="line"></div>

            <div className="step-item">
              <div className="step active">2</div>
              <span>KYC</span>
            </div>

            <div className="line"></div>

            <div className="step-item">
              <div className="step">3</div>
              <span>Kết nối ví</span>
            </div>
          </div>

          <h2>Xác minh CCCD</h2>

          <div className="kyc-subtitle">
            Tải ảnh CCCD để hệ thống nhận diện thông tin
          </div>

          {/* UPLOAD */}

          <div className="upload-grid">
            <label className="upload-box">
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => handleFile(e, setFront, true)}
              />

              {front ? (
                <img src={front.preview} alt="front" />
              ) : (
                <>
                  <div className="upload-icon">📷</div>
                  <div className="upload-label">CCCD mặt trước</div>
                  <div className="upload-note">JPG, PNG tối đa 5MB</div>
                </>
              )}
            </label>

            <label className="upload-box">
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => handleFile(e, setBack)}
              />

              {back ? (
                <img src={back.preview} alt="back" />
              ) : (
                <>
                  <div className="upload-icon">📷</div>
                  <div className="upload-label">CCCD mặt sau</div>
                  <div className="upload-note">JPG, PNG tối đa 5MB</div>
                </>
              )}
            </label>
          </div>

          {/* OCR */}

          <div className="ocr-section">
            <div className="ocr-title">Thông tin OCR</div>

            <div className="ocr-card">
              <div className="ocr-grid">
                <div className="form-group">
                  <label>Họ và tên</label>
                  <input
                    value={ocr.fullname}
                    onChange={(e) =>
                      setOcr({
                        ...ocr,
                        fullname: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Số CCCD</label>
                  <input
                    value={ocr.id}
                    onChange={(e) =>
                      setOcr({
                        ...ocr,
                        id: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Ngày sinh</label>
                  <input
                    value={ocr.dob}
                    onChange={(e) =>
                      setOcr({
                        ...ocr,
                        dob: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Giới tính</label>
                  <input
                    value={ocr.gender}
                    onChange={(e) =>
                      setOcr({
                        ...ocr,
                        gender: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Quốc tịch</label>
                  <input
                    value={ocr.nationality}
                    onChange={(e) =>
                      setOcr({
                        ...ocr,
                        nationality: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Địa chỉ thường trú</label>
                  <input
                    value={ocr.address}
                    onChange={(e) =>
                      setOcr({
                        ...ocr,
                        address: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="kyc-role-card">
                🌱 Vai trò đăng ký:
                <strong>{role}</strong>
              </div>
            </div>
          </div>

          {/* BUTTONS */}

          <div className="action-buttons">
            <button className="secondary-btn" onClick={() => navigate("/register")}>
              Quay lại
            </button>

            <button className="secondary-btn" onClick={() => alert("Lưu nháp (placeholder)")}>
              Lưu nháp
            </button>

            <button className="primary-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? "Đang gửi..." : "Gửi xác thực"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}