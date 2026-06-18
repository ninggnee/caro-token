import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Login          from '../pages/Login';
import Register       from '../pages/Register';
import Landing        from '../pages/Landing';
import VneidLogin     from '../pages/VneidLogin';
import VneidShare     from '../pages/VneidShare';
import KycCccd        from '../pages/KycCccd';
import TestAuth       from '../pages/TestAuth';

// Trader
import TraderHome        from '../pages/TraderHome';
import TraderWallet      from '../pages/TraderWallet';
import TraderMarketplace from '../pages/TraderMarketplace';
import TraderTrading     from '../pages/TraderTrading';
import TradeHistory      from '../pages/TradeHistory';
import TraderProfile     from '../pages/TraderProfile';
import ConnectWallet     from '../pages/ConnectWallet';
import RedeemCoffee      from '../pages/RedeemCoffee';
import DepositPage       from '../pages/DepositPage';
import WithdrawPage      from '../pages/WithdrawPage';

// Farmer — new portal
import FarmerDashboard    from '../pages/FarmerDashboard';
import FarmerAssets       from '../pages/FarmerAssets';
import FarmerDocuments    from '../pages/FarmerDocuments';
import FarmerWalletOverview from '../pages/FarmerWalletOverview';
import FarmerDepositPage  from '../pages/FarmerDepositPage';
import FarmerWithdrawPage from '../pages/FarmerWithdrawPage';
import FarmerTxHistory    from '../pages/FarmerTxHistory';
import FarmerNotifications from '../pages/FarmerNotifications';
import FarmerSettings     from '../pages/FarmerSettings';
// Farmer — existing pages (now wrapped in FarmerLayout)
import FarmerMarketplace   from '../pages/FarmerMarketplace';
import FarmerTrading       from '../pages/FarmerTrading';
import FarmerProfile       from '../pages/FarmerProfile';
import SubmitBatchPage     from '../pages/SubmitBatchPage';
import FarmerBatchesPage   from '../pages/FarmerBatchesPage';
import BatchDetailPage     from '../pages/BatchDetailPage';
// Farmer — legacy pages kept for backward compat
import FarmerHome          from '../pages/FarmerHome';
import FarmerWallet        from '../pages/FarmerWallet';
import CreateTokenRequest  from '../pages/CreateTokenRequest';
import TokenRequestsList   from '../pages/TokenRequestsList';
import TokenRequestDetail  from '../pages/TokenRequestDetail';
import SupplementDocuments from '../pages/SupplementDocuments';
import MintHistory         from '../pages/MintHistory';
import RedeemToken         from '../pages/RedeemToken';

// Admin
import AdminHome           from '../pages/AdminHome';
import KycAdmin            from '../pages/KycAdmin';
import KycDetail           from '../pages/KycDetail';
import UsersManagement     from '../pages/UsersManagement';
import ManageFarmers       from '../pages/ManageFarmers';
import ManageTraders       from '../pages/ManageTraders';
import AdminRequestsList   from '../pages/AdminRequestsList';
import LotDetail           from '../pages/LotDetail';
import GradeClassification from '../pages/GradeClassification';
import AdminMint             from '../pages/AdminMint';
import AdminMintRequestsPage from '../pages/AdminMintRequestsPage';
import SupplementRequests  from '../pages/SupplementRequests';
import CreditVnd           from '../pages/CreditVnd';
import AdminRedeemOrders   from '../pages/AdminRedeemOrders';
import SystemLogs          from '../pages/SystemLogs';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/"            element={<Landing />} />
        <Route path="/landing"     element={<Landing />} />
        <Route path="/register"    element={<Register />} />
        <Route path="/login"       element={<Login />} />
        <Route path="/vneid-login" element={<VneidLogin />} />
        <Route path="/vneid-share" element={<VneidShare />} />
        <Route path="/kyc-cccd"    element={<KycCccd />} />
        <Route path="/test-auth"   element={<TestAuth />} />

        {/* ── Trader ─────────────────────────────────────────── */}
        <Route path="/trader"                element={<TraderHome />} />
        <Route path="/trader/wallet"         element={<TraderWallet />} />
        <Route path="/trader/deposit"        element={<DepositPage />} />
        <Route path="/trader/withdraw"       element={<WithdrawPage />} />
        <Route path="/trader/marketplace"    element={<TraderMarketplace />} />
        <Route path="/trader/trading"        element={<TraderTrading />} />
        <Route path="/trader/trades"         element={<TradeHistory />} />
        <Route path="/trader/profile"        element={<TraderProfile />} />
        <Route path="/trader/connect-wallet" element={<ConnectWallet />} />
        <Route path="/trader/redeem"         element={<RedeemCoffee />} />

        {/* ── Farmer — new routes ────────────────────────────── */}
        {/* Root redirects to dashboard */}
        <Route path="/farmer"              element={<Navigate to="/farmer/dashboard" replace />} />
        <Route path="/farmer/dashboard"    element={<FarmerDashboard />} />

        {/* Asset Management */}
        <Route path="/farmer/assets"           element={<FarmerAssets />} />
        <Route path="/farmer/assets/pending"   element={<FarmerAssets />} />
        <Route path="/farmer/assets/minted"    element={<FarmerAssets />} />
        <Route path="/farmer/assets/rejected"  element={<FarmerAssets />} />
        <Route path="/farmer/assets/submit"    element={<SubmitBatchPage />} />

        {/* Documents */}
        <Route path="/farmer/documents"        element={<FarmerDocuments />} />

        {/* Wallet */}
        <Route path="/farmer/wallet"           element={<FarmerWalletOverview />} />
        <Route path="/farmer/wallet/deposit"   element={<FarmerDepositPage />} />
        <Route path="/farmer/wallet/withdraw"  element={<FarmerWithdrawPage />} />
        <Route path="/farmer/wallet/history"   element={<FarmerTxHistory />} />

        {/* Marketplace & Trading */}
        <Route path="/farmer/marketplace"      element={<FarmerMarketplace />} />
        <Route path="/farmer/orders"           element={<FarmerTrading />} />
        <Route path="/farmer/trading"          element={<FarmerTrading />} />

        {/* Other portal pages */}
        <Route path="/farmer/notifications"    element={<FarmerNotifications />} />
        <Route path="/farmer/profile"          element={<FarmerProfile />} />
        <Route path="/farmer/settings"         element={<FarmerSettings />} />

        {/* Legacy farmer routes — preserved for backward compatibility */}
        <Route path="/farmer/batches"                element={<FarmerBatchesPage />} />
        <Route path="/farmer/batch/new"              element={<SubmitBatchPage />} />
        <Route path="/farmer/batch/:id"              element={<BatchDetailPage />} />
        <Route path="/farmer/deposit"                element={<FarmerDepositPage />} />
        <Route path="/farmer/withdraw"               element={<FarmerWithdrawPage />} />
        <Route path="/farmer/mint-history"           element={<MintHistory />} />
        <Route path="/farmer/redeem"                 element={<RedeemToken />} />
        <Route path="/farmer/request/new"            element={<CreateTokenRequest />} />
        <Route path="/farmer/requests"               element={<TokenRequestsList />} />
        <Route path="/farmer/request/:id"            element={<TokenRequestDetail />} />
        <Route path="/farmer/request/:id/supplement" element={<SupplementDocuments />} />

        {/* ── Admin ──────────────────────────────────────────── */}
        <Route path="/admin"                      element={<AdminHome />} />
        <Route path="/admin/kyc"                  element={<KycAdmin />} />
        <Route path="/admin/kyc/:id"              element={<KycDetail />} />
        <Route path="/admin/users"                element={<UsersManagement />} />
        <Route path="/admin/farmers"              element={<ManageFarmers />} />
        <Route path="/admin/traders"              element={<ManageTraders />} />
        <Route path="/admin/requests"             element={<AdminRequestsList />} />
        <Route path="/admin/lot/:id"              element={<LotDetail />} />
        <Route path="/admin/grade"                element={<GradeClassification />} />
        <Route path="/admin/mint"                 element={<AdminMint />} />
        <Route path="/admin/supplement-requests"  element={<SupplementRequests />} />
        <Route path="/admin/credit"               element={<CreditVnd />} />
        <Route path="/admin/redeem-orders"        element={<AdminRedeemOrders />} />
        <Route path="/admin/logs"                 element={<SystemLogs />} />
        <Route path="/admin/mint-requests"        element={<AdminMintRequestsPage />} />
        <Route path="/admin/batch/:id"            element={<BatchDetailPage />} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
