import DashboardLayout from "../components/layout/DashboardLayout";

export default function TraderHome() {
  return (
    <DashboardLayout title="Trader Dashboard">
      <h2>📈 Trading Overview</h2>

      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ background: "#122622", padding: 20, flex: 1 }}>
          💰 Portfolio
        </div>

        <div style={{ background: "#122622", padding: 20, flex: 1 }}>
          📊 Market Watch
        </div>
      </div>
    </DashboardLayout>
  );
}