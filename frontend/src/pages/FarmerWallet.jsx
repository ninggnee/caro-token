import { useEffect, useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";
import { CA_RO_CONTRACTS, ABI } from "../config/config";

export default function FarmerWallet() {
  const { account, connect, disconnect, provider, lastConnected } = useWallet();
  const [vndBalance, setVndBalance] = useState('0');
  const [cr1, setCr1] = useState('0');
  const [cr2, setCr2] = useState('0');
  const [cr3, setCr3] = useState('0');

  useEffect(() => {
    const load = async () => {
      if (!account || !provider) return;
      try {
        // VND balance is off-chain; mock by ETH balance * price
        const bal = await provider.getBalance(account);
        const eth = Number(ethers.utils.formatEther(bal));
        setVndBalance((eth * 2000).toFixed(2)); // mock conversion

        const t1 = new ethers.Contract(CA_RO_CONTRACTS.CR1, ABI, provider);
        const t2 = new ethers.Contract(CA_RO_CONTRACTS.CR2, ABI, provider);
        const t3 = new ethers.Contract(CA_RO_CONTRACTS.CR3, ABI, provider);
        const [b1, b2, b3, d1, d2, d3] = await Promise.all([
          t1.balanceOf(account),
          t2.balanceOf(account),
          t3.balanceOf(account),
          t1.decimals(),
          t2.decimals(),
          t3.decimals(),
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

  const handleCopy = async () => {
    if (!account) return;
    await navigator.clipboard.writeText(account);
    alert('Đã sao chép địa chỉ ví');
  };

  return (
    <DashboardLayout title="Farmer Wallet">
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div>Trạng thái kết nối ví: <b>{account ? 'Connected' : 'Not connected'}</b></div>
            <div>Địa chỉ ví: <b>{account || '-'}</b></div>
            <div>Ngày kết nối gần nhất: {lastConnected || '-'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!account ? (
              <button onClick={connect} className="btn">Kết nối ví</button>
            ) : (
              <>
                <button onClick={handleCopy}>Sao chép địa chỉ</button>
                <button onClick={disconnect}>Ngắt kết nối</button>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8 }}>
            <h3>Danh mục tài sản</h3>
            <table style={{ width: '100%' }}>
              <thead>
                <tr><th>Token</th><th>Số lượng</th><th>Giá hiện tại</th><th>Giá trị</th></tr>
              </thead>
              <tbody>
                <tr><td>VND</td><td>-</td><td>1</td><td>{vndBalance} VNĐ</td></tr>
                <tr><td>CaRo1</td><td>{cr1}</td><td>100.000 VNĐ</td><td>{(Number(cr1)*100000).toLocaleString()} VNĐ</td></tr>
                <tr><td>CaRo2</td><td>{cr2}</td><td>85.000 VNĐ</td><td>{(Number(cr2)*85000).toLocaleString()} VNĐ</td></tr>
                <tr><td>CaRo3</td><td>{cr3}</td><td>70.000 VNĐ</td><td>{(Number(cr3)*70000).toLocaleString()} VNĐ</td></tr>
              </tbody>
            </table>
          </div>

          <div style={{ width: 360, background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8 }}>
            <h3>Lịch sử biến động</h3>
            <ul>
              <li>Nạp VND - +1.000.000 VNĐ - 2026-06-01</li>
              <li>Mint Token - +100 CaRo1 - 2026-06-05</li>
              <li>Mua Token - -50 CaRo1 - 2026-06-10</li>
            </ul>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
