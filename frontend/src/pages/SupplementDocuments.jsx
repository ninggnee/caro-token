import DashboardLayout from "../components/layout/DashboardLayout";
import { useParams } from "react-router-dom";

export default function SupplementDocuments() {
  const { id } = useParams();
  return (
    <DashboardLayout title="Bổ sung hồ sơ">
      <h2>Bổ sung hồ sơ cho yêu cầu {id}</h2>
      <p>Upload tài liệu mới và gửi lại phê duyệt (placeholder).</p>
    </DashboardLayout>
  );
}
