import { Link } from "react-router-dom";
import WalletButton from "../wallet/WalletButton";

export default function Topbar() {
  return (
    <div style={{
      height: 60,
      background: "#11161c",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0 16px",
      borderBottom: "1px solid rgba(255,255,255,0.05)"
    }}>
      <div style={{ color: "#8aa3a3", display: 'flex', gap: 12, alignItems: 'center' }}>
        <Link to="/landing" style={{ color: '#8aa3a3', textDecoration: 'none' }}>Home</Link>
        <div>Market: CR1 / VND</div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <WalletButton />
      </div>
    </div>
  );
}