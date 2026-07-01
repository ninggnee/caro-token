import { useRef, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import { createDeposit, getMyDeposits } from "../services/walletApi";
import { formatVND, formatNumber } from '../utils/formatters';
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";
import { CA_RO_CONTRACTS, ABI } from "../config/config";
import axios from "../utils/axiosClient";

const STATUS_COLOR = { pending: "caro-badge-warning", approved: "caro-badge-success", rejected: "caro-badge-danger" };
const STATUS_LABEL = { pending: "⏳ Chờ duyệt", approved: "✓ Đã duyệt", rejected: "✗ Từ chối" };

export default function FarmerDepositPage() {
  const nav = useNavigate();
  const qc  = useQueryClient();
  const { user } = useAuth();
  const { account, connect, provider } = useWallet();
  const fileRef = useRef(null);

  const [depType, setDepType] = useState("vnd"); // "vnd" | "token"

  // VND fields
  const [amount, setAmount] = useState("");
  const [file,   setFile]   = useState(null);
  const [tab,    setTab]    = useState("form"); // "form" | "history" | "guide"
  const [historyFilter, setHistoryFilter] = useState("all"); // "all" | "vnd" | "token"
  const [guideFilter, setGuideFilter] = useState("vnd"); // "vnd" | "token"

  // Token fields
  const [token, setToken] = useState("CR1");
  const [tokAmount, setTokAmount] = useState("");
  const [tokSubmitting, setTokSubmitting] = useState(false);
  const [metaMaskBal, setMetaMaskBal] = useState("0");

  // Load MetaMask balance of the selected token
  useEffect(() => {
    if (!account || !provider) return;
    let cancelled = false;
    (async () => {
      try {
        const c = new ethers.Contract(CA_RO_CONTRACTS[token], ABI, provider);
        const [b, d] = await Promise.all([c.balanceOf(account), c.decimals()]);
        if (!cancelled) {
          setMetaMaskBal(ethers.utils.formatUnits(b, d));
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [account, provider, token]);

  const avail = Number(metaMaskBal || 0);
  const amt = Number(tokAmount) || 0;
  const canSubmitToken = amt > 0 && amt <= avail && account && !tokSubmitting;

  // Fetch deposit history
  const { data: depData, isLoading: depLoading } = useQuery({
    queryKey: ["my-deposits"],
    queryFn: getMyDeposits,
    enabled: tab === "history",
  });
  const deposits = depData?.data || [];

  // Submit deposit
  const depositMut = useMutation({
    mutationFn: (fd) => createDeposit(fd),
    onSuccess: () => {
      toast.success("Yêu cầu nạp đã được gửi! Admin sẽ xác nhận trong vòng 24h.");
      setAmount("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["my-deposits"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Gửi yêu cầu thất bại"),
  });

  const handleSubmit = () => {
    const num = Number(amount);
    if (!num || num <= 0) { toast.error("Số tiền phải lớn hơn 0"); return; }
    if (!file)            { toast.error("Vui lòng đính kèm ảnh biên lai"); return; }

    const fd = new FormData();
    fd.append("amount",      num);
    fd.append("proof_image", file);
    depositMut.mutate(fd);
  };

  const handleTokenDeposit = async () => {
    if (!account) { toast.error("Vui lòng kết nối ví MetaMask"); return; }
    const amt = Number(tokAmount);
    if (!amt || amt <= 0) { toast.error("Số lượng phải lớn hơn 0"); return; }
    if (amt > Number(metaMaskBal)) { toast.error("Số dư MetaMask không đủ"); return; }

    setTokSubmitting(true);
    try {
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CA_RO_CONTRACTS[token], ABI, signer);
      const decimals = await contract.decimals().catch(() => 18);
      const amountWei = ethers.utils.parseUnits(String(tokAmount), decimals);

      const treasuryAddress = "0x0EcBEcFDb336A1B56D8f9cFD634844d0Efd70Cf4";
      const tx = await contract.transfer(treasuryAddress, amountWei);
      toast.info("Đang xử lý giao dịch trên blockchain...");
      
      const receipt = await tx.wait();
      if (receipt.status === 0) {
        throw new Error("Giao dịch blockchain bị đảo ngược (reverted).");
      }

      await axios.post("/wallet/deposit-token", {
        token_type: token,
        amount: amt,
        tx_hash: tx.hash
      });

      toast.success(`Nạp ${tokAmount} ${token} thành công!`);
      setTokAmount("");
      qc.invalidateQueries({ queryKey: ["my-deposits"] });
      qc.invalidateQueries({ queryKey: ["farmer-token-holdings-wallet"] });
      qc.invalidateQueries({ queryKey: ["vnd-wallet"] });
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || e.message || "Nạp token thất bại");
    } finally {
      setTokSubmitting(false);
    }
  };

  return (
    <FarmerLayout title="Nạp">
      <div className="caro-page">

        <div className="caro-page-header" style={{ marginBottom: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 className="caro-page-title">⬇️ Nạp</h2>
            <p className="caro-page-subtitle" style={{ margin: 0 }}>Nạp VND hoặc Token vào ví nội bộ</p>
          </div>
          <div style={{ display: "flex", gap: 8, background: "var(--card-bg)", borderRadius: 12, padding: 6, border: "1px solid var(--border)" }}>
            {[
              { key: "form",    label: "Nạp" },
              { key: "history", label: "Lịch sử" },
              { key: "guide",   label: "Hướng dẫn" },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`caro-btn caro-btn-sm ${tab === t.key ? "caro-btn-primary" : "caro-btn-ghost"}`}
                style={{ padding: "8px 20px" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── TAB: Form ────────────────────────────────────────────────────── */}
        {tab === "form" && (
          <div style={{ display: "grid", gap: 24 }}>
            {/* Sub-tabs for selecting Token or VND deposit */}
            <div style={{ display: "flex", gap: 12, background: "rgba(0,0,0,0.2)", padding: 6, borderRadius: 12, width: "fit-content" }}>
              <button 
                onClick={() => setDepType("vnd")} 
                className={`caro-btn caro-btn-sm ${depType === "vnd" ? "caro-btn-secondary" : "caro-btn-ghost"}`}
                style={{ padding: "10px 24px", fontSize: 13 }}
              >
                💵 Nạp VND
              </button>
              <button 
                onClick={() => setDepType("token")} 
                className={`caro-btn caro-btn-sm ${depType === "token" ? "caro-btn-secondary" : "caro-btn-ghost"}`}
                style={{ padding: "10px 24px", fontSize: 13 }}
              >
                🪙 Nạp Token
              </button>
            </div>

            {depType === "vnd" ? (
              <div style={{ display: "grid", gap: 24 }}>
                {/* Guide box */}
                <div className="caro-card" style={{ padding: 24, background: "rgba(64, 138, 113,0.05)", borderColor: "rgba(64, 138, 113,0.15)" }}>
                  <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.8 }}>
                    🏦 Tên ngân hàng: <strong style={{ color: "#f8fafc" }}>Vietcombank</strong><br />
                    💳 Số tài khoản: <strong style={{ color: "#f8fafc" }}>1029384756</strong><br />
                    👤 Chủ tài khoản: <strong style={{ color: "#f8fafc" }}>CARO PLATFORM TREASURY</strong><br />
                    📝 Nội dung chuyển khoản: <strong style={{ color: "#408A71" }}>CARONAP {user?.email}</strong>
                  </div>
                </div>

                {/* Input card */}
                <div className="caro-card">
                  <div className="caro-section-header" style={{ marginBottom: 20 }}>
                    <h3 className="caro-section-title">Thông Tin Nạp VND</h3>
                  </div>

                  <div style={{ display: "grid", gap: 20 }}>
                    <div className="caro-field">
                      <label className="caro-label">Số tiền muốn nạp (VND) <span style={{ color: "#ef4444" }}>*</span></label>
                      <input type="number" className="caro-input" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Ví dụ: 1000000" />
                      {Number(amount) > 0 && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>Ước tính nhận: <strong style={{ color: "#B0E4CC", fontSize: 14, fontFamily: "monospace" }}>{formatVND(Number(amount))}</strong></div>}
                    </div>

                    <div className="caro-field">
                      <label className="caro-label">Ảnh biên lai chuyển khoản <span style={{ color: "#ef4444" }}>*</span></label>
                      <div
                        onClick={() => fileRef.current?.click()}
                        style={{ 
                          border: `2px dashed ${file ? "rgba(176, 228, 204,0.5)" : "var(--border)"}`, 
                          borderRadius: 12, padding: "24px", cursor: "pointer", 
                          background: file ? "rgba(176, 228, 204,0.05)" : "rgba(255,255,255,0.02)", 
                          textAlign: "center", transition: "all 0.2s" 
                        }}
                        onMouseEnter={e => !file && (e.currentTarget.style.borderColor = "#408A71")}
                        onMouseLeave={e => !file && (e.currentTarget.style.borderColor = "var(--border)")}
                      >
                        {file ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                            <span style={{ color: "#B0E4CC", fontSize: 24 }}>✓</span>
                            <div style={{ textAlign: "left" }}>
                              <div style={{ fontSize: 14, color: "#f8fafc", fontWeight: 700 }}>{file.name}</div>
                              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{(file.size / 1024).toFixed(0)} KB — Nhấn để đổi</div>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: 32, marginBottom: 12 }}>🖼️</div>
                            <div style={{ fontSize: 14, color: "#94a3b8", fontWeight: 600 }}>Nhấn để chọn ảnh biên lai</div>
                            <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>JPG, PNG, WebP — tối đa 5MB</div>
                          </div>
                        )}
                      </div>
                      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }}
                        onChange={e => setFile(e.target.files[0] || null)} />
                    </div>

                    <div style={{ padding: "12px 16px", background: "rgba(176, 228, 204,0.05)", border: "1px solid rgba(176, 228, 204,0.1)", borderRadius: 8, fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
                      💡 Chuyển khoản đúng số tiền + đính kèm biên lai. Admin sẽ xác nhận và cộng số dư trong vòng <strong style={{ color: "#f8fafc" }}>24 giờ</strong>.
                    </div>

                    <button onClick={handleSubmit} disabled={depositMut.isPending}
                      className="caro-btn caro-btn-primary" style={{ padding: "14px 32px", fontSize: 15, width: "fit-content" }}>
                      {depositMut.isPending ? "Đang gửi..." : "📤 Gửi yêu cầu nạp"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="caro-card" style={{ display: "grid", gap: 24 }}>
                <div>
                  <h3 className="caro-section-title">Nạp Token từ MetaMask</h3>
                  <p className="caro-section-subtitle">Chuyển token từ ví MetaMask cá nhân của bạn vào ví sàn giao dịch nội bộ CaRo.</p>
                </div>

                <div style={{ display: "grid", gap: 20 }}>
                  {/* Token selector */}
                  <div className="caro-field">
                    <label className="caro-label">Chọn loại Token</label>
                    <div style={{ display: "flex", gap: 12 }}>
                      {["CR1", "CR2", "CR3"].map(t => (
                        <button key={t} onClick={() => setToken(t)}
                          className={`caro-btn ${token === t ? 'caro-btn-secondary' : 'caro-btn-ghost'}`}
                          style={{ flex: 1, padding: "12px", fontSize: 14 }}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* MetaMask balance */}
                  <div style={{ background: "rgba(176, 228, 204,0.05)", border: "1px solid rgba(176, 228, 204,0.2)", borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>Số dư trong ví MetaMask:</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "#B0E4CC", fontFamily: "monospace" }}>{formatNumber(avail, 4)} {token}</span>
                  </div>

                  {/* MetaMask link status */}
                  <div className="caro-field">
                    <label className="caro-label">Nạp về tài khoản sàn</label>
                    <input
                      className="caro-input"
                      value={account ? `Ví MetaMask liên kết: ${account.slice(0,10)}...${account.slice(-4)}` : ""}
                      readOnly disabled placeholder="Chưa kết nối ví MetaMask"
                      style={{ opacity: 0.7, fontFamily: "monospace" }}
                    />
                    {!account && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8, fontWeight: 600 }}>⚠️ Vui lòng kết nối ví MetaMask để thực hiện nạp token</div>}
                  </div>

                  {/* Amount input */}
                  <div className="caro-field">
                    <label className="caro-label">Số lượng nạp <span style={{ color: "#ef4444" }}>*</span></label>
                    <input type="number" className="caro-input" value={tokAmount} onChange={e => setTokAmount(e.target.value)} placeholder="Ví dụ: 50.0" />
                  </div>

                  {!account ? (
                    <button onClick={connect} className="caro-btn" style={{ width: "100%", padding: "14px 20px", background: "#f0b90b", color: "#000", fontSize: 15 }}>
                      🦊 Kết nối ví MetaMask
                    </button>
                  ) : (
                    <button onClick={handleTokenDeposit} disabled={!canSubmitToken}
                      className={`caro-btn ${canSubmitToken ? 'caro-btn-primary' : 'caro-btn-ghost'}`}
                      style={{ width: "100%", padding: "14px 20px", fontSize: 15 }}>
                      {tokSubmitting ? "Đang xử lý..." : `Nạp ${tokAmount ? `${tokAmount} ${token}` : "Token"}`}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: History ─────────────────────────────────────────────────── */}
        {tab === "history" && (
          <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="caro-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <h3 className="caro-section-title" style={{ margin: 0 }}>📋 Lịch Sử Nạp</h3>
              <div style={{ display: "flex", gap: 6, background: "rgba(0,0,0,0.15)", padding: 4, borderRadius: 8, border: "1px solid var(--border)" }}>
                {[
                  { key: "all",   label: "Tất cả" },
                  { key: "vnd",   label: "VND" },
                  { key: "token", label: "Token" },
                ].map(opt => (
                  <button key={opt.key} onClick={() => setHistoryFilter(opt.key)}
                    className={`caro-btn caro-btn-xs ${historyFilter === opt.key ? "caro-btn-secondary" : "caro-btn-ghost"}`}
                    style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6 }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {depLoading ? (
              <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>Đang tải...</div>
            ) : deposits.length === 0 ? (
              <div className="caro-empty">
                <div className="caro-empty-icon">📭</div>
                <div className="caro-empty-title">Chưa có yêu cầu nạp nào</div>
              </div>
            ) : (
              <div>
                {deposits
                  .filter(d => {
                    if (historyFilter === "vnd") return !d.token_type;
                    if (historyFilter === "token") return !!d.token_type;
                    return true;
                  })
                  .map(d => (
                    <div key={d.id} style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#B0E4CC", fontFamily: "monospace" }}>
                          {d.token_type ? `+${d.amount} ${d.token_type}` : `+${formatVND(d.amount)}`}
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
                          {new Date(d.created_at).toLocaleString("vi-VN")}
                          {d.token_type && <span style={{ marginLeft: 10, color: "#f0b90b", fontFamily: "monospace", fontSize: 12 }}>• Tx: {d.tx_hash?.slice(0, 10)}...</span>}
                          {d.note && <span style={{ marginLeft: 10, color: "#64748b" }}>• {d.note}</span>}
                        </div>
                      </div>
                      <span className={`caro-badge ${STATUS_COLOR[d.status] || "caro-badge-muted"}`}>
                        {STATUS_LABEL[d.status] || d.status}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Guide ───────────────────────────────────────────────────── */}
        {tab === "guide" && (
          <div className="caro-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <h3 className="caro-section-title" style={{ margin: 0 }}>Hướng Dẫn Nạp</h3>
              <div style={{ display: "flex", gap: 6, background: "rgba(0,0,0,0.15)", padding: 4, borderRadius: 8, border: "1px solid var(--border)" }}>
                {[
                  { key: "vnd",   label: "Nạp VND" },
                  { key: "token", label: "Nạp Token (MetaMask)" },
                ].map(opt => (
                  <button key={opt.key} onClick={() => setGuideFilter(opt.key)}
                    className={`caro-btn caro-btn-xs ${guideFilter === opt.key ? "caro-btn-secondary" : "caro-btn-ghost"}`}
                    style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6 }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {guideFilter === "vnd" ? (
              <div style={{ display: "grid", gap: 24 }}>
                {[
                  { n: "1", icon: "🏦", title: "Chuyển khoản ngân hàng", desc: "Chuyển VND đến tài khoản ngân hàng của CaRo Platform (thông tin liên hệ admin)." },
                  { n: "2", icon: "📸", title: "Chụp biên lai", desc: "Chụp ảnh hoặc screenshot màn hình xác nhận giao dịch từ ngân hàng của bạn." },
                  { n: "3", icon: "📤", title: "Gửi yêu cầu", desc: "Điền số tiền đã chuyển, đính kèm biên lai và nhấn gửi yêu cầu trong tab Nạp." },
                  { n: "4", icon: "✅", title: "Chờ xác nhận", desc: "Admin kiểm tra và duyệt trong vòng 24h. Số dư VND sẽ được cộng vào ví nội bộ của bạn." },
                ].map(s => (
                  <div key={s.n} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(64, 138, 113,0.1)", border: "1px solid rgba(64, 138, 113,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{s.title}</div>
                      <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6, lineHeight: 1.6 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 24 }}>
                {[
                  { n: "1", icon: "🦊", title: "Kết nối MetaMask", desc: "Đảm bảo bạn đã kết nối ví MetaMask cá nhân và chuyển sang mạng thử nghiệm Sepolia." },
                  { n: "2", icon: "🪙", title: "Chọn loại Token & Số lượng", desc: "Chọn CR1, CR2 hoặc CR3, nhập số lượng token muốn chuyển vào ví sàn giao dịch nội bộ." },
                  { n: "3", icon: "🔑", title: "Ký giao dịch", desc: "Nhấn nút 'Nạp Token', cửa sổ MetaMask sẽ xuất hiện để bạn ký xác nhận chuyển token đến địa chỉ kho bạc." },
                  { n: "4", icon: "⚡", title: "Xử lý on-chain & Cập nhật số dư", desc: "Sau khi giao dịch được xác nhận trên blockchain, hệ thống sẽ tự động cập nhật số dư khả dụng nội bộ ngay lập tức." },
                ].map(s => (
                  <div key={s.n} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(64, 138, 113,0.1)", border: "1px solid rgba(64, 138, 113,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{s.title}</div>
                      <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6, lineHeight: 1.6 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <button onClick={() => nav("/farmer/wallet")} className="caro-btn caro-btn-ghost" style={{ fontSize: 14 }}>
            ← Quay lại ví
          </button>
        </div>

      </div>
    </FarmerLayout>
  );
}
