import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AppRouter from "./routes/AppRouter";
import { AuthProvider } from "./context/AuthContext";
import { WalletProvider } from "./context/WalletContext";
import { RegisterFormProvider } from "./context/RegisterFormContext";
import "./index.css";
import "./styles/theme.css";
import "./styles/app.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <RegisterFormProvider>
        <WalletProvider>
          <AppRouter />
          <ToastContainer
            position="top-right"
            autoClose={4000}
            theme="dark"
            style={{ fontSize: 14 }}
          />
        </WalletProvider>
      </RegisterFormProvider>
    </AuthProvider>
  </QueryClientProvider>
);