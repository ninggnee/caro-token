import DashboardLayout from "../components/layout/DashboardLayout";
import { useParams } from "react-router-dom";

export default function KycDetail() {
  const { id } = useParams();
  return (
    <DashboardLayout title={`KYC ${id}`}>
      <h2>Chi tiết KYC</h2>
      <p>Thông tin cá nhân, CCCD, OCR, VNeID (placeholder).</p>
    </DashboardLayout>
  );
}
