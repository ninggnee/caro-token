import { useEffect, useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";
import { CA_RO_CONTRACTS, ABI } from "../config/config";
import OrderBook from "../components/trading/OrderBook";
import "../styles/farmer.css";

export default function FarmerHome() {
  const { account, connect, provider, signer } = useWallet();

  const [ethBalance, setEthBalance] = useState("0");
  const [tokenBalance, setTokenBalance] = useState("0");

  const [cr1, setCr1] = useState("0");
  const [cr2, setCr2] = useState("0");
  const [cr3, setCr3] = useState("0");

  const [bids, setBids] = useState([
    { price: "0.95", amount: "100" },
    { price: "0.90", amount: "200" },
  ]);

  const [asks, setAsks] = useState([
    { price: "1.05", amount: "50" },
    { price: "1.10", amount: "120" },
  ]);

  const [side, setSide] = useState("buy");
  const [price, setPrice] = useState(1);
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    const loadBalances = async () => {
      if (!account || !provider) return;

      try {
        const balance = await provider.getBalance(account);
        setEthBalance(ethers.utils.formatEther(balance));

        const tokenContracts = [
          new ethers.Contract(CA_RO_CONTRACTS.CR1, ABI, provider),
          new ethers.Contract(CA_RO_CONTRACTS.CR2, ABI, provider),
          new ethers.Contract(CA_RO_CONTRACTS.CR3, ABI, provider),
        ];

        const [
          b1,
          b2,
          b3,
          d1,
          d2,
          d3,
        ] = await Promise.all([
          tokenContracts[0].balanceOf(account),
          tokenContracts[1].balanceOf(account),
          tokenContracts[2].balanceOf(account),
          tokenContracts[0].decimals(),
          tokenContracts[1].decimals(),
          tokenContracts[2].decimals(),
        ]);

        setCr1(ethers.utils.formatUnits(b1, d1));
        setCr2(ethers.utils.formatUnits(b2, d2));
        setCr3(ethers.utils.formatUnits(b3, d3));
      } catch (error) {
        console.error("Load balances failed:", error);
      }
    };

    loadBalances();
  }, [account, provider]);

  const placeOrder = async () => {
    if (!account) {
      await connect();
      return;
    }

  const order = {
    price: String(price),
    amount: String(amount),
  };

  if (side === "buy") {
    setBids((prev) => [order, ...prev]);
  } else {
    setAsks((prev) => [order, ...prev]);
  }
};

const executeSellOnChain = async () => {
  if (!signer) {
    alert("Connect wallet first");
    return;
  }

  if (!amount || Number(amount) <= 0) {
    alert("Please enter valid amount");
    return;
  }

  try {
    const token = new ethers.Contract(
      CA_RO_CONTRACTS.CR1,
      ABI,
      signer
    );

    const tx = await token.transfer(
      "0x0000000000000000000000000000000000000000",
      ethers.utils.parseUnits(String(amount), 18)
    );

    alert(`Transaction sent: ${tx.hash}`);

    await tx.wait();

    alert("Transaction confirmed");
  } catch (error) {
    console.error(error);
    alert("On-chain transfer failed");
  }
};

const totalAssetValue =
  Number(cr1 || 0) * 100000 +
  Number(cr2 || 0) * 85000 +
  Number(cr3 || 0) * 70000;

const walletStatus = account ? "Connected" : "Disconnected";

const shortAddress = account
  ? `${account.slice(0, 6)}...${account.slice(-4)}`
  : "Guest";

  return (
  <DashboardLayout title="Farmer Dashboard">
    <div style={{ display: "grid", gap: 20 }}>

      {/* HERO */}
      <div
        style={{
          background: "linear-gradient(135deg,#162028,#22313d)",
          borderRadius: 16,
          padding: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>
            Xin chào Farmer 👋
          </h2>

          <div
            style={{
              marginTop: 10,
              color: "#9fcfc6",
              fontSize: 14,
            }}
          >
            Ví:
            {" "}
            <b>{shortAddress}</b>
          </div>

          <div style={{ marginTop: 8 }}>
            KYC:
            {" "}
            <span style={{ color: "#22c55e" }}>
              Approved
            </span>
          </div>

          <div>
            Wallet:
            {" "}
            <span
              style={{
                color: account ? "#22c55e" : "#ef4444",
              }}
            >
              {walletStatus}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn"
            onClick={() =>
              (window.location.href =
                "/farmer/request/new")
            }
          >
            + Token hóa
          </button>

          <button
            className="btn"
            onClick={() =>
              (window.location.href =
                "/farmer/trading")
            }
          >
            + Mua Token
          </button>

          <button
            className="btn"
            onClick={() =>
              (window.location.href =
                "/farmer/redeem")
            }
          >
            + Quy đổi
          </button>
        </div>
      </div>

      {/* SUMMARY */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: 16,
        }}
      >
        <div className="dashboard-card">
          <div>Tổng tài sản</div>
          <h2>
            {totalAssetValue.toLocaleString()} VNĐ
          </h2>
        </div>

        <div className="dashboard-card">
          <div>Số dư ví</div>
          <h2>
            {(Number(ethBalance) * 2000).toFixed(2)}
            {" "}VNĐ
          </h2>
        </div>

        <div className="dashboard-card">
          <div>CaRo1</div>
          <h2>{Number(cr1).toFixed(2)}</h2>
        </div>

        <div className="dashboard-card">
          <div>CaRo2</div>
          <h2>{Number(cr2).toFixed(2)}</h2>
        </div>

        <div className="dashboard-card">
          <div>CaRo3</div>
          <h2>{Number(cr3).toFixed(2)}</h2>
        </div>
      </div>

      {/* TOKEN OVERVIEW */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(250px,1fr))",
          gap: 16,
        }}
      >
        {[
          {
            name: "CaRo1",
            amount: cr1,
            price: "100.000",
          },
          {
            name: "CaRo2",
            amount: cr2,
            price: "85.000",
          },
          {
            name: "CaRo3",
            amount: cr3,
            price: "70.000",
          },
        ].map((token) => (
          <div
            key={token.name}
            style={{
              background: "#141a1f",
              padding: 20,
              borderRadius: 12,
              border:
                "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <h3>{token.name}</h3>

            <div>
              Số lượng:
              {" "}
              <b>
                {Number(token.amount).toFixed(2)}
              </b>
            </div>

            <div>
              Giá tham chiếu:
              {" "}
              <b>{token.price} VNĐ</b>
            </div>
          </div>
        ))}
      </div>

      {/* CHART + REQUEST */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 16,
        }}
      >
        <div
          style={{
            background: "#141a1f",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h3>Biểu đồ thị trường</h3>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 15,
            }}
          >
            <button className="btn">1D</button>
            <button className="btn">7D</button>
            <button className="btn">1M</button>
            <button className="btn">3M</button>
          </div>

          <div
            style={{
              height: 300,
              borderRadius: 10,
              background: "#0b1113",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            📈 Market Chart
          </div>
        </div>

        <div
          style={{
            background: "#141a1f",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h3>Tình trạng yêu cầu</h3>

          <div style={{ display: "grid", gap: 12 }}>
            <div>🟡 Chờ duyệt: <b>2</b></div>
            <div>🟠 Bổ sung: <b>1</b></div>
            <div>🟢 Đã duyệt: <b>5</b></div>
            <div>🔵 Đã Mint: <b>12</b></div>
            <div>🔴 Từ chối: <b>0</b></div>
          </div>
        </div>
      </div>

      {/* RECENT TRANSACTIONS */}
      <div
        style={{
          background: "#141a1f",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h3>Giao dịch gần đây</h3>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th>STT</th>
              <th>Mã GD</th>
              <th>Loại</th>
              <th>Giá trị</th>
              <th>Ngày</th>
              <th>Trạng thái</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>1</td>
              <td>#TX1001</td>
              <td>Mint</td>
              <td>+100 CaRo1</td>
              <td>2026-06-05</td>
              <td style={{ color: "#22c55e" }}>
                Completed
              </td>
            </tr>

            <tr>
              <td>2</td>
              <td>#TX1002</td>
              <td>Buy</td>
              <td>-50 CaRo1</td>
              <td>2026-06-10</td>
              <td style={{ color: "#22c55e" }}>
                Completed
              </td>
            </tr>

            <tr>
              <td>3</td>
              <td>#TX1003</td>
              <td>Redeem</td>
              <td>-10 CaRo2</td>
              <td>2026-06-12</td>
              <td style={{ color: "#f59e0b" }}>
                Processing
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  </DashboardLayout>
);
}