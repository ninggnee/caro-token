import DashboardLayout from "../components/layout/DashboardLayout";
import { useParams } from "react-router-dom";

export default function TokenRequestDetail() {
  const { id } = useParams();

  return (
    <DashboardLayout title={`Yêu cầu ${id}`}>
      <h2>Chi tiết yêu cầu</h2>
      <p>Thông tin lô hàng, hồ sơ đính kèm, nhật ký xử lý (placeholder).</p>
    </DashboardLayout>
  );
}
