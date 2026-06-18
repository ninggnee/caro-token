import { useEffect, useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import axios from "../utils/axiosClient";
import { Link } from "react-router-dom";

function StatCard({ title, value, icon }) {
  return (
    <div
      style={{
        background: "#131b24",
        padding: 20,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.06)",
        transition: "0.2s",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            color: "#9ca3af",
            fontSize: 13,
          }}
        >
          {title}
        </span>

        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: "#fff",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function AdminHome() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);

      try {
        const res = await axios.get("/admin/summary");

        console.log("ADMIN SUMMARY:", res.data);

        setSummary(res.data?.summary || {});
      } catch (e) {
        console.error(e);

        // fallback mock data
        setSummary({
          totalFarmers: 128,
          totalTraders: 42,
          totalKyc: 150,
          totalTokens: 250000,
          totalKg: 120000,
          totalVolumeVnd: 4500000000,
          pendingKyc: 3,
          rejectedKyc: 1,
          pendingTokenRequests: 4,
          supplementRequests: 2,
          redeemProcessing: 1,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

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
                fontSize: 30,
                fontWeight: 800,
              }}
            >
              Admin Dashboard
            </h1>

            <div
              style={{
                marginTop: 6,
                color: "#9ca3af",
              }}
            >
              Theo dõi và quản trị toàn bộ hệ thống RWA Coffee Token
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
            👨‍💼 Administrator
          </div>
        </div>

        {/* Overview */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <StatCard
            title="Tổng Farmer"
            icon="🌱"
            value={loading ? "..." : summary?.totalFarmers || 0}
          />

          <StatCard
            title="Tổng Trader"
            icon="💼"
            value={loading ? "..." : summary?.totalTraders || 0}
          />

          <StatCard
            title="Tổng KYC"
            icon="✅"
            value={loading ? "..." : summary?.totalKyc || 0}
          />

          <StatCard
            title="Token lưu hành"
            icon="🪙"
            value={
              loading
                ? "..."
                : (summary?.totalTokens || 0).toLocaleString()
            }
          />
        </div>

        {/* Asset Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
            gap: 16,
          }}
        >
          <div
            style={{
              background: "#131b24",
              padding: 24,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              style={{
                color: "#9ca3af",
                fontSize: 14,
              }}
            >
              Tổng khối lượng token hóa
            </div>

            <div
              style={{
                marginTop: 12,
                fontSize: 32,
                fontWeight: 800,
              }}
            >
              {loading
                ? "..."
                : `${(summary?.totalKg || 0).toLocaleString()} kg`}
            </div>
          </div>

          <div
            style={{
              background: "#131b24",
              padding: 24,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              style={{
                color: "#9ca3af",
                fontSize: 14,
              }}
            >
              Tổng giá trị giao dịch
            </div>

            <div
              style={{
                marginTop: 12,
                fontSize: 32,
                fontWeight: 800,
              }}
            >
              {loading
                ? "..."
                : `${(summary?.totalVolumeVnd || 0).toLocaleString()} VNĐ`}
            </div>
          </div>
        </div>

        {/* Tasks + Charts */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "350px 1fr",
            gap: 16,
          }}
        >
          {/* Tasks */}
          <div
            style={{
              background: "#131b24",
              padding: 24,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              ⚠️ Công việc cần xử lý
            </h3>

            <div style={{ lineHeight: "32px" }}>
              <div>
                KYC chờ duyệt: <b>{summary?.pendingKyc || 0}</b>
              </div>

              <div>
                KYC từ chối: <b>{summary?.rejectedKyc || 0}</b>
              </div>

              <div>
                Yêu cầu Token hóa:{" "}
                <b>{summary?.pendingTokenRequests || 0}</b>
              </div>

              <div>
                Yêu cầu bổ sung:{" "}
                <b>{summary?.supplementRequests || 0}</b>
              </div>

              <div>
                Yêu cầu Redemption:{" "}
                <b>{summary?.redeemProcessing || 0}</b>
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <Link to="/admin/kyc">📄 Quản lý KYC</Link>

              <Link to="/admin/requests">
                🪙 Yêu cầu Token hóa
              </Link>

              <Link to="/admin/redeem-orders">
                🔄 Yêu cầu Redemption
              </Link>
            </div>
          </div>

          {/* Charts */}
          <div
            style={{
              background: "#131b24",
              padding: 24,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              📊 Activity Analytics
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 250px",
                gap: 12,
              }}
            >
              <div
                style={{
                  height: 220,
                  background: "#0b1113",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                Tokenization Chart
              </div>

              <div
                style={{
                  height: 220,
                  background: "#0b1113",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                Trading Volume Chart
              </div>

              <div
                style={{
                  height: 220,
                  background: "#0b1113",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                Grade Allocation
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}