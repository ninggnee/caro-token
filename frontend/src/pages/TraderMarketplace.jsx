import { useNavigate } from "react-router-dom";
import TraderLayout from "../components/layout/TraderLayout";
import MarketPageContent from "../components/market/MarketPageContent";

export default function TraderMarketplace() {
  const navigate = useNavigate();
  return (
    <TraderLayout title="Thị trường">
      <MarketPageContent onPlaceOrder={() => navigate("/trader/trading")} />
    </TraderLayout>
  );
}
