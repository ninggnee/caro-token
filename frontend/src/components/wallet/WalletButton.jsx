import { useState } from "react";
import { useWallet } from "../../context/WalletContext";
import { useAuth } from "../../context/AuthContext";
import axios from "../../utils/axiosClient";

export default function WalletButton() {
  const { account, connect, disconnect, lastConnected } = useWallet();
  const { user, updateUser } = useAuth();
  const [open, setOpen] = useState(false);

  const handleConnect = async () => {
    const addr = await connect();
    if (addr) {
      try {
        const res = await axios.post('/auth/save-wallet', { wallet_address: addr });
        const returnedRole = res.data.role || user?.role;
        const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
        if (storedUser) {
          storedUser.wallet_address = addr;
          if (returnedRole) storedUser[`wallet_${returnedRole}`] = addr;
          updateUser(storedUser);
        }
      } catch (e) {
        // ignore save failure
        console.warn('save-wallet failed', e?.message || e);
      }
    }
  };

  const handleDisconnect = () => {
    disconnect();
    const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
    if (storedUser) {
      delete storedUser.wallet_address;
      if (storedUser.role) delete storedUser[`wallet_${storedUser.role}`];
      updateUser(storedUser);
    }
    setOpen(false);
  };

  if (!account) {
    return <button className="btn" onClick={handleConnect}>Connect Wallet</button>;
  }

  const short = `${account.slice(0,6)}...${account.slice(-4)}`;

  return (
    <div style={{ position: 'relative' }}>
      <button className="wallet-btn" onClick={() => setOpen(s => !s)}>{short}</button>
      {open && (
        <div style={{ position: 'absolute', right: 0, marginTop: 8, background: '#11161c', padding: 8, borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.6)' }}>
          <div style={{ marginBottom: 8 }}>Address: {short}</div>
          <div style={{ marginBottom: 8, fontSize: 12 }}>Last: {lastConnected || '-'}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { navigator.clipboard.writeText(account); alert('Copied'); }}>Copy</button>
            <button onClick={handleDisconnect}>Disconnect</button>
          </div>
        </div>
      )}
    </div>
  );
}
