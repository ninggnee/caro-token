import { useNavigate } from "react-router-dom";
import TraderLayout from "../components/layout/TraderLayout";
import MarketPageContent from "../components/market/MarketPageContent";

export default function TraderMarketplace() {
  const nav = useNavigate();

  return (
    <TraderLayout title="Thị trường — Tổng quan">
      <MarketPageContent onPlaceOrder={() => nav("/trader/market/trading")} />
    </TraderLayout>
  );
}
