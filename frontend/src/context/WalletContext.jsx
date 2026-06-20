import { createContext, useContext, useState, useEffect } from "react";
import { ethers } from "ethers";
import { API_URL } from "../config/api";

const WalletContext = createContext();

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [lastConnected, setLastConnected] = useState(null);

  // Sync wallet address with backend database
  const syncWalletWithBackend = async (walletAddress) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      await fetch(`${API_URL}/auth/save-wallet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ wallet_address: walletAddress || null }),
      });
    } catch (err) {
      console.error("Failed to sync wallet with backend:", err);
    }
  };

  // Initialize and check connection on mount
  useEffect(() => {
    const init = async () => {
      const savedAddress = localStorage.getItem("farmer_wallet_address") || localStorage.getItem("trader_wallet_address");
      if (window.ethereum && savedAddress) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0 && accounts[0].toLowerCase() === savedAddress.toLowerCase()) {
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            const web3Signer = web3Provider.getSigner();
            setProvider(web3Provider);
            setSigner(web3Signer);
            setAccount(accounts[0]);
            setLastConnected(localStorage.getItem("wallet_last_connected"));
          }
        } catch (err) {
          console.error("Wallet init error:", err);
        }
      }
    };
    init();

    if (window.ethereum) {
      const handleAccounts = async (accounts) => {
        if (accounts.length > 0) {
          const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
          const web3Signer = web3Provider.getSigner();
          setProvider(web3Provider);
          setSigner(web3Signer);
          setAccount(accounts[0]);
          localStorage.setItem("farmer_wallet_address", accounts[0]);
          localStorage.setItem("trader_wallet_address", accounts[0]);
          await syncWalletWithBackend(accounts[0]);
        } else {
          setAccount(null);
          setProvider(null);
          setSigner(null);
          localStorage.removeItem("farmer_wallet_address");
          localStorage.removeItem("trader_wallet_address");
          await syncWalletWithBackend("");
        }
      };
      window.ethereum.on("accountsChanged", handleAccounts);
      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccounts);
      };
    }
  }, []);

  const connect = async () => {
    if (!window.ethereum) {
      alert("Vui lòng cài đặt MetaMask!");
      return;
    }

    try {
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      const web3Signer = web3Provider.getSigner();
      const address = await web3Signer.getAddress();

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(address);
      const now = new Date().toISOString();
      setLastConnected(now);
      localStorage.setItem("wallet_last_connected", now);
      localStorage.setItem("farmer_wallet_address", address);
      localStorage.setItem("trader_wallet_address", address);

      // Sync address with backend
      await syncWalletWithBackend(address);

      return address;
    } catch (err) {
      console.error(err);
    }
  };

  const disconnect = async () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    localStorage.removeItem("farmer_wallet_address");
    localStorage.removeItem("trader_wallet_address");
    localStorage.removeItem("wallet_last_connected");

    // Sync clear address with backend
    await syncWalletWithBackend("");
  };

  return (
    <WalletContext.Provider value={{ account, provider, signer, connect, disconnect, lastConnected }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);