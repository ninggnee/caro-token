import { useEffect, useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";
import { CA_RO_CONTRACTS, ABI } from "../config/config";
import OrderBook from "../components/trading/OrderBook";

export default function TraderHome() {
  const { account, connect, provider, signer } = useWallet();
  const [ethBalance, setEthBalance] = useState("0");
  const [tokenBalance, setTokenBalance] = useState("0");
  const [cr1, setCr1] = useState('0');
  const [cr2, setCr2] = useState('0');
  const [cr3, setCr3] = useState('0');

  const [bids, setBids] = useState([
    { price: "0.92", amount: "150" },
    { price: "0.88", amount: "300" },
  ]);
  const [asks, setAsks] = useState([
    { price: "1.02", amount: "60" },
    { price: "1.08", amount: "90" },
  ]);

  const [side, setSide] = useState("buy");
  const [price, setPrice] = useState(1);
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    const loadBalances = async () => {
      if (!account || !provider) return;
      try {
        const bal = await provider.getBalance(account);
        setEthBalance(ethers.utils.formatEther(bal));

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
      } catch (err) {
        console.error(err);
      }
    };
    loadBalances();
  }, [account, provider]);

  const placeOrder = async () => {
    if (!account) {
      await connect();
      return;
    }
    const order = { price: String(price), amount: String(amount) };
    if (side === "buy") setBids((s) => [order, ...s]);
    else setAsks((s) => [order, ...s]);
  };

  const executeBuyOnChain = async () => {
    if (!signer) return alert("Connect wallet first");
    try {
      const token = new ethers.Contract(CA_RO_CONTRACTS.CR1, ABI, signer);
      // Demo: transfer tokens from signer to zero address to simulate a buy/sell
      const tx = await token.transfer("0x0000000000000000000000000000000000000000", ethers.utils.parseUnits(String(amount), 18));
      alert("Transaction sent: " + tx.hash);
    } catch (err) {
      console.error(err);
      alert("On-chain transfer failed");
    }
  };

  return (
    <DashboardLayout title="Trader Dashboard">
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div>
            <div>Account:</div>
            <div style={{ fontWeight: 700 }}>{account || "Not connected"}</div>
          </div>
          <div>
            <div>ETH Balance</div>
            <div style={{ fontWeight: 700 }}>{ethBalance}</div>
          </div>
          <div>
            <div>CaRo Token</div>
            <div style={{ fontWeight: 700 }}>{tokenBalance}</div>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div>Họ tên: <b>Trader demo</b></div>
            <div>Vai trò: <b>Trader</b></div>
            <div>KYC: <b>Verified</b></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => window.location.href = '/trader/marketplace'} className="btn">Xem thị trường</button>
            <button onClick={() => window.location.href = '/trader/trading'} className="btn">Giao dịch</button>
            <button onClick={() => window.location.href = '/trader/redeem'} className="btn">Đổi token lấy cà phê</button>
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#9fcfc6' }}>Tổng giá trị tài sản (VNĐ)</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{ (Number(cr1)*100000 + Number(cr2)*85000 + Number(cr3)*70000).toLocaleString() } VNĐ</div>
          </div>
          <div style={{ flex: 1, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#9fcfc6' }}>Số dư VND</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{ (Number(ethBalance)*2000).toFixed(2) } VNĐ</div>
          </div>
          <div style={{ flex: 1, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#9fcfc6' }}>Giá trị Token</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{ (Number(cr1)*100000 + Number(cr2)*85000 + Number(cr3)*70000).toLocaleString() } VNĐ</div>
          </div>
          <div style={{ flex: 1, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#9fcfc6' }}>P/L tạm tính</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>+{(Math.random()*500000).toFixed(0)} VNĐ</div>
          </div>
        </div>

        {/* Holdings and market */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 2, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
            <h3>Danh mục đầu tư</h3>
            <table style={{ width: '100%' }}>
              <thead><tr><th>Tài sản</th><th>Số lượng</th><th>Giá vốn</th><th>Giá hiện tại</th><th>Lãi/Lỗ</th></tr></thead>
              <tbody>
                <tr><td>CaRo1</td><td>{cr1}</td><td>90.000</td><td>100.000</td><td>+{(Number(cr1)*10000).toFixed(0)}</td></tr>
                <tr><td>CaRo2</td><td>{cr2}</td><td>80.000</td><td>85.000</td><td>+{(Number(cr2)*5000).toFixed(0)}</td></tr>
                <tr><td>CaRo3</td><td>{cr3}</td><td>65.000</td><td>70.000</td><td>+{(Number(cr3)*5000).toFixed(0)}</td></tr>
              </tbody>
            </table>
          </div>

          <div style={{ flex: 1, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
            <h3>Biểu đồ thị trường (CaRo1)</h3>
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Chart placeholder</div>
          </div>
        </div>

        {/* Recent trades */}
        <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
          <h3>Giao dịch gần đây</h3>
          <table style={{ width: '100%' }}>
            <thead><tr><th>Loại</th><th>Tài sản</th><th>Khối lượng</th><th>Giá</th><th>Thời gian</th></tr></thead>
            <tbody>
              <tr><td>Buy</td><td>CaRo1</td><td>50</td><td>100.000</td><td>2026-06-10</td></tr>
              <tr><td>Sell</td><td>CaRo2</td><td>10</td><td>85.000</td><td>2026-06-09</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}