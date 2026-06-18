import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Layout({ children }) {
  return (
    <div style={{ display: "flex", height: "100vh", background: "#0b0e11" }}>
      <Sidebar />

      <div style={{ flex: 1 }}>
        <Topbar />
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}