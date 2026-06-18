import React from "react";
import ReactDOM from "react-dom/client";
import AppRouter from "./routes/AppRouter";
import { AuthProvider } from "./context/AuthContext";
import { WalletProvider } from "./context/WalletContext";
import "./styles/app.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <WalletProvider>
      <AppRouter />
    </WalletProvider>
  </AuthProvider>
);