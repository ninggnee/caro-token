import { useEffect, useState } from "react";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useWallet } from "../context/WalletContext";
import { useAuth } from "../context/AuthContext";
import { ethers } from "ethers";
import { CA_RO_CONTRACTS, ABI } from "../config/config";

const C = { accent: "#487573", muted: "#6b7a99", green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", card: "#172524", border: "rgba(72, 117, 115, 0.15)", tealLight: "#7fe0c9" };

export default function FarmerWallet() {
  const { account, connect, disconnect, provider, lastConnected } = useWallet();
  const { user, updateUser } = useAuth();
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
    alert('Đã sao chép địa chỉ ví thành công!');
  };

  const handleConnect = async () => {
    try {
      const addr = await connect();
      if (addr) {
        updateUser({ ...user, wallet_address: addr });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDisconnect = async () => {
    if (window.confirm("Bạn có chắc chắn muốn hủy kết nối ví MetaMask?")) {
      await disconnect();
      updateUser({ ...user, wallet_address: null });
    }
  };

  return (
    <FarmerLayout title="Ví tài khoản (Thử nghiệm)">
      <div style={{ display: 'grid', gap: 16, width: "100%" }}>
        
        {/* Connection status card */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, color: '#e2e8f0', marginBottom: 6 }}>
              Trạng thái kết nối ví: <b style={{ color: account ? C.green : C.red }}>{account ? 'Đã kết nối (Connected)' : 'Chưa kết nối (Not connected)'}</b>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>
              Địa chỉ ví: <b style={{ color: account ? C.tealLight : '#e2e8f0', fontFamily: 'monospace' }}>{account || '-'}</b>
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              Ngày kết nối gần nhất: {lastConnected ? new Date(lastConnected).toLocaleString("vi-VN") : '-'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!account ? (
              <button onClick={handleConnect} style={{ padding: "8px 16px", background: C.accent, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                🦊 Kết nối ví
              </button>
            ) : (
              <>
                <button onClick={handleCopy} style={{ padding: "8px 16px", background: "rgba(72,117,115,0.12)", border: `1px solid ${C.border}`, color: C.tealLight, borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  Sao chép địa chỉ
                </button>
                <button onClick={handleDisconnect} style={{ padding: "8px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: C.red, borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  Ngắt kết nối
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          
          {/* Asset List */}
          <div style={{ flex: 1, minWidth: 320, background: C.card, padding: 20, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>☕ Danh mục tài sản (On-chain)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, color: C.muted }}>Token</th>
                  <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 12, color: C.muted }}>Số lượng</th>
                  <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 12, color: C.muted }}>Đơn giá</th>
                  <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 12, color: C.muted }}>Giá trị</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 0', fontSize: 13, color: '#e2e8f0' }}>VND (Mock)</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', fontSize: 13, color: C.muted }}>-</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', fontSize: 13, color: C.muted }}>1 ₫</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', fontSize: 13, fontWeight: 600, color: C.tealLight }}>{Number(vndBalance).toLocaleString("vi-VN")} ₫</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 0', fontSize: 13, color: '#e2e8f0' }}>CaRo1</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', fontSize: 13, fontWeight: 600, color: C.green }}>{Number(cr1).toLocaleString("vi-VN")} kg</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', fontSize: 13, color: C.muted }}>100.000 ₫</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', fontSize: 13, fontWeight: 600, color: C.tealLight }}>{(Number(cr1)*100000).toLocaleString("vi-VN")} ₫</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 0', fontSize: 13, color: '#e2e8f0' }}>CaRo2</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', fontSize: 13, fontWeight: 600, color: C.green }}>{Number(cr2).toLocaleString("vi-VN")} kg</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', fontSize: 13, color: C.muted }}>85.000 ₫</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', fontSize: 13, fontWeight: 600, color: C.tealLight }}>{(Number(cr2)*85000).toLocaleString("vi-VN")} ₫</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 0', fontSize: 13, color: '#e2e8f0' }}>CaRo3</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', fontSize: 13, fontWeight: 600, color: C.green }}>{Number(cr3).toLocaleString("vi-VN")} kg</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', fontSize: 13, color: C.muted }}>70.000 ₫</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', fontSize: 13, fontWeight: 600, color: C.tealLight }}>{(Number(cr3)*70000).toLocaleString("vi-VN")} ₫</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* History */}
          <div style={{ width: 360, background: C.card, padding: 20, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>📈 Lịch sử biến động</h3>
            <ul style={{ paddingLeft: 16, margin: 0, display: 'grid', gap: 12, fontSize: 13, color: '#e2e8f0' }}>
              <li>Nạp VND - <span style={{ color: C.green }}>+1.000.000 ₫</span> - 2026-06-01</li>
              <li>Mint Token - <span style={{ color: C.green }}>+100 CaRo1</span> - 2026-06-05</li>
              <li>Mua Token - <span style={{ color: C.red }}>-50 CaRo1</span> - 2026-06-10</li>
            </ul>
          </div>

        </div>
      </div>
    </FarmerLayout>
  );
}
