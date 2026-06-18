import DashboardLayout from "../components/layout/DashboardLayout";
import { useParams } from "react-router-dom";

export default function LotDetail() {
  const { id } = useParams();
  return (
    <DashboardLayout title={`Lô ${id}`}>
      <h2>Chi tiết lô cà phê</h2>
      <p>Thông tin Farmer, hồ sơ, hình ảnh lô hàng, kết quả kiểm định (placeholder).</p>
    </DashboardLayout>
  );
}
