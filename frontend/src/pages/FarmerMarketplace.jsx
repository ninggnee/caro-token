import { Navigate } from "react-router-dom";

// Replaced by /farmer/market/overview and /farmer/market/trading
export default function FarmerMarketplace() {
  return <Navigate to="/farmer/market/overview" replace />;
}
