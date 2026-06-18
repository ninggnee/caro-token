import { useEffect, useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";
import { CA_RO_CONTRACTS, ABI } from "../config/config";

export default function TraderWallet() {
  const { account, connect, disconnect, provider, lastConnected } = useWallet();
  const [vnd, setVnd] = useState('0');
  const [cr1, setCr1] = useState('0');
  const [cr2, setCr2] = useState('0');
  const [cr3, setCr3] = useState('0');

  useEffect(() => {
    const load = async () => {
      if (!account || !provider) return;
      try {
        const bal = await provider.getBalance(account);
        const eth = Number(ethers.utils.formatEther(bal));
        setVnd((eth * 2000).toFixed(2));

        const t1 = new ethers.Contract(CA_RO_CONTRACTS.CR1, ABI, provider);
        const t2 = new ethers.Contract(CA_RO_CONTRACTS.CR2, ABI, provider);
        const t3 = new ethers.Contract(CA_RO_CONTRACTS.CR3, ABI, provider);
        const [b1, b2, b3, d1, d2, d3] = await Promise.all([
          t1.balanceOf(account), t2.balanceOf(account), t3.balanceOf(account),
          t1.decimals(), t2.decimals(), t3.decimals(),
        ]);
        setCr1(ethers.utils.formatUnits(b1, d1));
        setCr2(ethers.utils.formatUnits(b2, d2));
        setCr3(ethers.utils.formatUnits(b3, d3));
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, [account, provider]);

  const copy = async () => {
    if (!account) return;
    await navigator.clipboard.writeText(account);
    alert('Đã sao chép địa chỉ ví');
  }

  return (
    <DashboardLayout title="Trader Wallet">
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div>Trạng thái ví: <b>{account ? 'Connected' : 'Not connected'}</b></div>
            <div>Địa chỉ: <b>{account || '-'}</b></div>
            <div>Last connected: {lastConnected || '-'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!account ? <button onClick={connect} className="btn">Kết nối</button> : <>
              <button onClick={copy}>Copy</button>
              <button onClick={disconnect}>Disconnect</button>
            </>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
            <h4>Tổng tài sản</h4>
            <div>Tổng: {(Number(cr1)*100000 + Number(cr2)*85000 + Number(cr3)*70000 + Number(vnd)).toLocaleString()} VNĐ</div>
            <div>VND: {Number(vnd).toLocaleString()} VNĐ</div>
          </div>

          <div style={{ flex: 2, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
            <h4>Danh sách tài sản</h4>
            <table style={{ width: '100%' }}>
              <thead><tr><th>Tài sản</th><th>Số lượng</th><th>Giá hiện tại</th><th>Giá trị</th></tr></thead>
              <tbody>
                <tr><td>VND</td><td>-</td><td>1</td><td>{Number(vnd).toLocaleString()} VNĐ</td></tr>
                <tr><td>CaRo1</td><td>{cr1}</td><td>100.000</td><td>{(Number(cr1)*100000).toLocaleString()} VNĐ</td></tr>
                <tr><td>CaRo2</td><td>{cr2}</td><td>85.000</td><td>{(Number(cr2)*85000).toLocaleString()} VNĐ</td></tr>
                <tr><td>CaRo3</td><td>{cr3}</td><td>70.000</td><td>{(Number(cr3)*70000).toLocaleString()} VNĐ</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
