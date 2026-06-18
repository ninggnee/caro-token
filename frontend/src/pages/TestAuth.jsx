import { useState } from "react";
import { registerTest, loginTest, clearAuth } from "../utils/authTest";
import axios from "../utils/axiosClient";

export default function TestAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [output, setOutput] = useState("");
  const [role, setRole] = useState("trader");
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);

  const doRegister = async () => {
    try {
      const res = await registerTest({
        email,
        password,
        full_name: "Test User",
        role,
      });
      setOutput(JSON.stringify(res, null, 2));
    } catch (err) {
      setOutput(String(err));
    }
  };

  const doLogin = async () => {
    try {
      const res = await loginTest(email, password, role);
      setOutput(JSON.stringify(res, null, 2));
    } catch (err) {
      setOutput(String(err));
    }
  };

  const doKycUpload = async () => {
    try {
      // ensure logged in and token set
      const token = localStorage.getItem("token");
      if (!token) return setOutput('Not logged in');

      const form = new FormData();
      if (frontFile) form.append('front', frontFile);
      if (backFile) form.append('back', backFile);

      const res = await axios.post(`/kyc/submit`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setOutput(JSON.stringify(res.data, null, 2));
    } catch (err) {
      setOutput(String(err?.response?.data || err.message));
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Auth Test</h2>

        <select value={role} onChange={(e) => setRole(e.target.value)} style={{ display: "block", marginBottom: 8 }}>
          <option value="trader">Trader</option>
          <option value="farmer">Farmer</option>
          <option value="admin">Admin</option>
        </select>

        <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: "block", marginBottom: 8 }}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: "block", marginBottom: 8 }}
      />

      <button onClick={doRegister} style={{ marginRight: 8 }}>
        Register Test
      </button>

      { (role === 'farmer' || role === 'trader') && (
        <div style={{ marginTop: 8 }}>
          <div>Upload CCCD Front</div>
          <input type="file" onChange={(e) => setFrontFile(e.target.files[0])} />
          <div>Upload CCCD Back</div>
          <input type="file" onChange={(e) => setBackFile(e.target.files[0])} />
        </div>
      )}

      <button onClick={doLogin} style={{ marginRight: 8 }}>
        Login Test
      </button>

      <button onClick={() => { clearAuth(); setOutput('cleared'); }}>
        Clear Auth
      </button>

      {(role === 'farmer' || role === 'trader') && (
        <button onClick={doKycUpload} style={{ marginLeft: 8 }}>Submit KYC</button>
      )}

      <pre style={{ marginTop: 16, background: "#0b0b0b", color: "#fff", padding: 12 }}>
        {output}
      </pre>
    </div>
  );
}
