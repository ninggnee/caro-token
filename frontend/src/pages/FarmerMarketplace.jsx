import { useNavigate } from "react-router-dom";
import FarmerLayout from "../components/layout/FarmerLayout";
import MarketPageContent from "../components/market/MarketPageContent";

export default function FarmerMarketplace() {
  const navigate = useNavigate();
  return (
    <FarmerLayout title="Thị trường">
      <MarketPageContent onPlaceOrder={() => navigate("/farmer/orders")} />
    </FarmerLayout>
  );
}
