import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import axios from "../utils/axiosClient";
import { formatVND, formatToken } from '../utils/formatters';
import { useWallet } from "../context/WalletContext";

const PRICE = { CR1: 100_000, CR2: 85_000, CR3: 70_000 };
const FEE_RATE = 0.001; // 0.1%

const STATUS_COLOR = { pending: "caro-badge-warning", approved: "caro-badge-success", rejected: "caro-badge-danger" };
const STATUS_LABEL = { pending: "⏳ Chờ duyệt", approved: "✓ Đã duyệt", rejected: "✗ Từ chối" };

function useWithdraws(enabled) {
  return useQuery({
    queryKey: ["my-withdraws"],
    queryFn: () => axios.get("/wallet/withdraw").then(r => r.data),
    enabled,
  });
}

function useBalances() {
  return useQuery({
    queryKey: ["token-balances"],
    queryFn: () => axios.get("/token/balances").then(r => r.data),
    staleTime: 30_000,
  });
}

function useVndWallet() {
  return useQuery({
    queryKey: ["vnd-wallet"],
    queryFn: () => axios.get("/wallet/balance").then(r => r.data),
    staleTime: 15_000,
  });
}

export default function FarmerWithdrawPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const balQ = useBalances();
  const vndQ = useVndWallet();
  const { account, connect } = useWallet();

  const [wdType, setWdType] = useState("token"); // "token" | "vnd"
  const [tab, setTab] = useState("form"); // "form" | "history" | "guide"
  const [historyFilter, setHistoryFilter] = useState("all"); // "all" | "vnd" | "token"
  const [guideFilter, setGuideFilter] = useState("vnd"); // "vnd" | "token"

  // Token fields
  const [token, setToken] = useState("CR1");
  const [amount, setAmount] = useState("");
  const [dest, setDest] = useState("");

  // VND fields
  const [vndAmount, setVndAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accNum, setAccNum] = useState("");
  const [accName, setAccName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  // Fetch withdraw history
  const { data: wdData, isLoading: wdLoading } = useWithdraws(tab === "history");
  const withdraws = wdData?.data || [];

  useEffect(() => {
    if (account) {
      setDest(account);
    } else {
      setDest("");
    }
  }, [account]);

  const bals = balQ.data?.balances || {};
  const avail = Number(bals[token]?.available || 0);
  const amt = Number(amount) || 0;
  const fee = amt * FEE_RATE;
  const netAmt = amt - fee;
  const estVnd = netAmt * PRICE[token];

  const vndAvailable = vndQ.data?.vnd_available ?? 0;

  const isValidAddr = /^0x[0-9a-fA-F]{40}$/.test(dest);
  const isVndValid = Number(vndAmount) > 0 && Number(vndAmount) <= vndAvailable && bankName.trim() && accNum.trim() && accName.trim();
  const canSubmit = wdType === "token"
    ? (amt > 0 && amt <= avail && account && isValidAddr && !submitting)
    : (isVndValid && !submitting);

  const handleSubmit = async () => {
    setErr("");
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (wdType === "token") {
        await axios.post("/wallet/withdraw", { token_type: token, amount: amt, destination_address: dest });
      } else {
        await axios.post("/wallet/withdraw", { amount: Number(vndAmount), bank_name: bankName, account_number: accNum, account_name: accName });
      }
      qc.invalidateQueries({ queryKey: ["token-balances"] });
      qc.invalidateQueries({ queryKey: ["vnd-wallet"] });
      qc.invalidateQueries({ queryKey: ["farmer-dashboard-wallet"] });
      setDone(true);
    } catch (e) {
      setErr(e?.response?.data?.message || "Rút tiền thất bại. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FarmerLayout title="Rút">
      <div className="caro-page">

        <div className="caro-page-header" style={{ marginBottom: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 className="caro-page-title">💸 Rút</h2>
            <p className="caro-page-subtitle" style={{ margin: 0 }}>Yêu cầu rút tài sản khả dụng về ví MetaMask hoặc tài khoản ngân hàng</p>
          </div>
          <div style={{ display: "flex", gap: 8, background: "var(--card-bg)", borderRadius: 12, padding: 6, border: "1px solid var(--border)" }}>
            {[
              { key: "form",    label: "Rút" },
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
          done ? (
            <div style={{ maxWidth: 500, margin: "40px auto", textAlign: "center" }} className="caro-card">
              <div style={{ fontSize: 56, marginBottom: 20 }}>✅</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12, color: "#f8fafc" }}>Yêu cầu rút đã được gửi</h2>
              <div style={{ fontSize: 15, color: "#94a3b8", marginBottom: 32, lineHeight: 1.6 }}>
                {wdType === "token" ? (
                  <>
                    Yêu cầu rút <strong style={{ color: "#408A71" }}>{formatToken(amt, token)}</strong> của bạn đã hoàn thành.<br />
                    Token đã được chuyển đến địa chỉ ví <strong style={{ color: "#f8fafc", wordBreak: "break-all" }}>{dest}</strong>.
                  </>
                ) : (
                  <>
                    Yêu cầu rút <strong style={{ color: "#B0E4CC" }}>{formatVND(Number(vndAmount))}</strong> của bạn đã được gửi lên hệ thống.<br />
                    Vui lòng chờ Admin phê duyệt giao dịch.
                  </>
                )}
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button onClick={() => nav("/farmer/wallet")} className="caro-btn caro-btn-primary">Xem Ví tài khoản</button>
                <button onClick={() => { setDone(false); setAmount(""); setVndAmount(""); setBankName(""); setAccNum(""); setAccName(""); }} className="caro-btn caro-btn-ghost">Rút mới</button>
              </div>
            </div>
          ) : (
            <div className="caro-card" style={{ display: "grid", gap: 24 }}>
              {/* Sub-tabs for selecting Token or VND withdraw */}
              <div style={{ display: "flex", gap: 12, background: "rgba(0,0,0,0.2)", padding: 6, borderRadius: 12, width: "fit-content", marginBottom: 12 }}>
                <button 
                  onClick={() => { setWdType("token"); setErr(""); }}
                  className={`caro-btn caro-btn-sm ${wdType === "token" ? "caro-btn-secondary" : "caro-btn-ghost"}`}
                  style={{ padding: "10px 24px", fontSize: 13 }}
                >
                  🪙 Rút Token
                </button>
                <button 
                  onClick={() => { setWdType("vnd"); setErr(""); }}
                  className={`caro-btn caro-btn-sm ${wdType === "vnd" ? "caro-btn-secondary" : "caro-btn-ghost"}`}
                  style={{ padding: "10px 24px", fontSize: 13 }}
                >
                  💵 Rút VND
                </button>
              </div>

              {wdType === "token" ? (
                <>
                  {/* Token select */}
                  <div className="caro-field">
                    <label className="caro-label">Chọn Token</label>
                    <div style={{ display: "flex", gap: 12 }}>
                      {["CR1", "CR2", "CR3"].map(t => {
                        const av = Number(bals[t]?.available || 0);
                        return (
                          <button key={t} onClick={() => { setToken(t); setAmount(""); }}
                            className={`caro-btn ${token === t ? 'caro-btn-secondary' : 'caro-btn-ghost'}`}
                            style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", height: "auto" }}>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>{t}</div>
                            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{av > 0 ? formatToken(av, t) : "Chưa có"}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="caro-field">
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <label className="caro-label" style={{ marginBottom: 0 }}>Số lượng ({token}) <span style={{ color: "#ef4444" }}>*</span></label>
                      <div style={{ fontSize: 13, color: "#94a3b8" }}>Khả dụng: <span style={{ color: "#408A71", fontWeight: 700 }}>{formatToken(avail, token)}</span></div>
                    </div>
                    <div style={{ position: "relative" }}>
                      <input
                        type="number" className="caro-input" value={amount} onChange={e => setAmount(e.target.value)}
                        min="0" max={avail} step="0.01"
                        placeholder="0.00"
                        style={{ paddingRight: 80, fontSize: 16, fontWeight: 700, borderColor: amt > avail ? "#ef4444" : "var(--border)" }}
                      />
                      <button onClick={() => setAmount(String(avail))}
                        className="caro-btn caro-btn-sm"
                        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(64, 138, 113,0.15)", color: "#408A71", padding: "4px 8px", fontSize: 11 }}>
                        TỐI ĐA
                      </button>
                    </div>
                    {amt > avail && avail > 0 && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 6, fontWeight: 600 }}>Số dư khả dụng không đủ</div>}
                  </div>

                  {/* Destination */}
                  <div className="caro-field">
                    <label className="caro-label">Địa chỉ ví nhận (MetaMask)</label>
                    <input
                      className="caro-input"
                      value={dest} readOnly disabled placeholder="Vui lòng kết nối ví MetaMask"
                      style={{ opacity: 0.7, fontFamily: "monospace" }}
                    />
                    {!account && <div style={{ fontSize: 12, color: "#f0b90b", marginTop: 8, fontWeight: 600 }}>⚠️ Bạn cần kết nối ví MetaMask để thực hiện rút token</div>}
                    {account && isValidAddr && <div style={{ fontSize: 12, color: "#B0E4CC", marginTop: 8, fontWeight: 600 }}>✓ Ví nhận MetaMask đã kết nối: {account.slice(0, 6)}...{account.slice(-4)}</div>}
                  </div>

                  {/* Fee summary */}
                  {amt > 0 && (
                    <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: "16px 20px", border: "1px solid var(--border)" }}>
                      {[
                        { label: "Số lượng rút",        value: formatToken(amt, token) },
                        { label: "Phí rút (0.1%)",      value: `-${fee.toFixed(4)} ${token}`, color: "#ef4444" },
                        { label: "Thực nhận",           value: formatToken(netAmt, token), color: "#B0E4CC", bold: true },
                        { label: "Giá trị ước tính",    value: `≈ ${formatVND(estVnd)}`, color: "#94a3b8" },
                      ].map(r => (
                        <div key={r.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                          <span style={{ fontSize: 14, color: "#94a3b8" }}>{r.label}</span>
                          <span style={{ fontSize: 15, fontWeight: r.bold ? 800 : 500, color: r.color || "#f8fafc", fontFamily: "monospace" }}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* VND Amount */}
                  <div className="caro-field">
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <label className="caro-label" style={{ marginBottom: 0 }}>Số tiền rút (VND) <span style={{ color: "#ef4444" }}>*</span></label>
                      <div style={{ fontSize: 13, color: "#94a3b8" }}>Khả dụng: <span style={{ color: "#B0E4CC", fontWeight: 700 }}>{formatVND(vndAvailable)}</span></div>
                    </div>
                    <div style={{ position: "relative" }}>
                      <input
                        type="number" className="caro-input" value={vndAmount} onChange={e => setVndAmount(e.target.value)}
                        min="0" max={vndAvailable}
                        placeholder="Nhập số tiền (VND)"
                        style={{ paddingRight: 80, fontSize: 16, fontWeight: 700, borderColor: Number(vndAmount) > vndAvailable ? "#ef4444" : "var(--border)" }}
                      />
                      <button onClick={() => setVndAmount(String(vndAvailable))}
                        className="caro-btn caro-btn-sm"
                        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(176, 228, 204,0.15)", color: "#B0E4CC", padding: "4px 8px", fontSize: 11 }}>
                        TỐI ĐA
                      </button>
                    </div>
                    {Number(vndAmount) > vndAvailable && vndAvailable > 0 && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 6, fontWeight: 600 }}>Số dư khả dụng không đủ</div>}
                  </div>

                  {/* Bank Name */}
                  <div className="caro-field">
                    <label className="caro-label">Tên ngân hàng <span style={{ color: "#ef4444" }}>*</span></label>
                    <input type="text" className="caro-input" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Ví dụ: Vietcombank" />
                  </div>

                  {/* Account Number */}
                  <div className="caro-field">
                    <label className="caro-label">Số tài khoản <span style={{ color: "#ef4444" }}>*</span></label>
                    <input type="text" className="caro-input" value={accNum} onChange={e => setAccNum(e.target.value)} placeholder="Ví dụ: 1029384756" />
                  </div>

                  {/* Account Name */}
                  <div className="caro-field">
                    <label className="caro-label">Tên chủ tài khoản <span style={{ color: "#ef4444" }}>*</span></label>
                    <input type="text" className="caro-input" value={accName} onChange={e => setAccName(e.target.value)} placeholder="Ví dụ: NGUYEN VAN A" />
                  </div>
                </>
              )}

              {err && <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 14, color: "#ef4444" }}>{err}</div>}

              {wdType === "token" && !account ? (
                <button onClick={connect} className="caro-btn" style={{ width: "100%", padding: "14px 20px", background: "#f0b90b", color: "#000", fontSize: 15 }}>
                  🦊 Kết nối ví MetaMask
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={!canSubmit}
                  className={`caro-btn ${canSubmit ? (wdType === "token" ? "caro-btn-primary" : "caro-btn-danger") : "caro-btn-ghost"}`}
                  style={{ width: "100%", padding: "14px 20px", fontSize: 15 }}>
                  {submitting ? "Đang xử lý..." : (wdType === "token" ? `Rút ${amt > 0 ? formatToken(amt, token) : "Token"}` : `Rút ${vndAmount ? formatVND(Number(vndAmount)) : "VND"}`)}
                </button>
              )}
            </div>
          )
        )}

        {/* ── TAB: History ─────────────────────────────────────────────────── */}
        {tab === "history" && (
          <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="caro-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <h3 className="caro-section-title" style={{ margin: 0 }}>📋 Lịch Sử Rút</h3>
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
            {wdLoading ? (
              <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>Đang tải...</div>
            ) : withdraws.length === 0 ? (
              <div className="caro-empty">
                <div className="caro-empty-icon">📭</div>
                <div className="caro-empty-title">Chưa có yêu cầu rút nào</div>
              </div>
            ) : (
              <div>
                {withdraws
                  .filter(w => {
                    if (historyFilter === "vnd") return !w.token_type;
                    if (historyFilter === "token") return !!w.token_type;
                    return true;
                  })
                  .map(w => (
                    <div key={w.id} style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#ef4444", fontFamily: "monospace" }}>
                          {w.token_type ? `-${w.amount} ${w.token_type}` : `-${formatVND(w.amount)}`}
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
                          {new Date(w.created_at).toLocaleString("vi-VN")}
                          {w.token_type && <span style={{ marginLeft: 10, color: "#f0b90b", fontFamily: "monospace", fontSize: 12 }}>• Tx: {w.tx_hash?.slice(0, 10)}...</span>}
                          {w.bank_name && <span style={{ marginLeft: 10, color: "#64748b" }}>• {w.bank_name} - {w.account_number}</span>}
                          {w.note && <span style={{ marginLeft: 10, color: "#64748b" }}>• {w.note}</span>}
                        </div>
                      </div>
                      <span className={`caro-badge ${STATUS_COLOR[w.status] || "caro-badge-muted"}`}>
                        {STATUS_LABEL[w.status] || w.status}
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
              <h3 className="caro-section-title" style={{ margin: 0 }}>Hướng Dẫn Rút</h3>
              <div style={{ display: "flex", gap: 6, background: "rgba(0,0,0,0.15)", padding: 4, borderRadius: 8, border: "1px solid var(--border)" }}>
                {[
                  { key: "vnd",   label: "Rút VND" },
                  { key: "token", label: "Rút Token (MetaMask)" },
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
                  { n: "1", icon: "💵", title: "Nhập số tiền VND", desc: "Nhập số tiền VND muốn rút trong hạn mức khả dụng của ví nội bộ." },
                  { n: "2", icon: "🏦", title: "Thông tin ngân hàng", desc: "Cung cấp tên ngân hàng, số tài khoản và tên chủ tài khoản nhận tiền chính xác." },
                  { n: "3", icon: "📤", title: "Gửi yêu cầu", desc: "Xác nhận gửi yêu cầu. Admin hệ thống kiểm tra và chuyển khoản VND đến bạn trong vòng 24h." },
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
                  { n: "1", icon: "🦊", title: "Kết nối MetaMask", desc: "Đảm bảo ví MetaMask cá nhân của bạn đã được kết nối và hiển thị đúng địa chỉ ví nhận." },
                  { n: "2", icon: "🪙", title: "Chọn Token & Số lượng", desc: "Chọn CR1, CR2 hoặc CR3 và nhập số lượng muốn rút về ví cá nhân." },
                  { n: "3", icon: "⚡", title: "Thực thi blockchain", desc: "Hệ thống sẽ thực hiện giao dịch chuyển khoản on-chain trực tiếp từ ví kho bạc về ví của bạn sau khi khấu trừ 0.1% phí." },
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

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <button onClick={() => nav("/farmer/wallet")} className="caro-btn caro-btn-ghost" style={{ fontSize: 14 }}>
            ← Quay lại ví
          </button>
        </div>

      </div>
    </FarmerLayout>
  );
}
