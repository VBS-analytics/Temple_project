import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import AuthLayout from "../components/AuthLayout";
import ProtectedRoute from "../components/ProtectedRoute";
import CalendarPage from "../pages/CalendarPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import LoginPage from "../pages/LoginPage";
import PoojaRegistrationPage from "../pages/PoojaRegistrationPage";
import PaymentPage from "../pages/payments/PaymentPage";
import PaymentStatementPage from "../pages/payments/PaymentStatementPage";
import RegisterPage from "../pages/RegisterPage";
import CombinePaymentDonorPage from "../pages/admin/CombinePaymentDonorPage";
import AdminMasterPage from "../pages/admin/AdminMasterPage";
import AccountStatementPage from "../pages/admin/AccountStatementPage";
import DonorDetailsPage from "../pages/admin/DonorDetailsPage";
import ExpensesPage from "../pages/admin/ExpensesPage";
import PoojaDetailsPage from "../pages/admin/PoojaDetailsPage";
import PoojaPauseCancelPage from "../pages/admin/PoojaPauseCancelPage";
import DonorPoojaDetails from "../pages/admin/DonorPoojaDetails";
import LandingPage from "../pages/LandingPage";
import About from "../pages/About";
import AboutKakkalaniVillage from "../pages/AboutKakkalaniVillage";
import CowSamrakshanaSeva from "../pages/CowSamrakshanaSeva";
import DonorCornerPage from "../pages/DonorCornerPage";
import DonorProfile from "../pages/DonorProfile";
import FamilyTreePage from "../pages/FamilyTreePage";
import KovilDetailsPage from "../pages/KovilDetailsPage";
import PoojaSeva from "../pages/PoojaSeva";
import CombinePaymentPage from "../pages/payments/CombinePaymentPage";
import DonationPage from "../pages/payments/DonationPage";
import ReportPage from "../pages/ReportPage";
import WhyVisitNativeVillage from "../pages/WhyVisitNativeVillage";
import History from "../pages/History";
import { canViewExpenseTracker, canViewPaymentStatement, isAdmin, useAuthStore } from "../store/auth";
const HomeRoute = () => {
  const user = useAuthStore((state) => state.user);
  if (user) {
    const destination = isAdmin(user.role) ? "/admin/master" : "/profile";
    return <Navigate to={destination} replace />;
  }
  return <LandingPage />;
};

const PaymentStatementRoute = () => {
  const user = useAuthStore((state) => state.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!canViewPaymentStatement(user)) {
    const fallback = isAdmin(user.role) ? "/admin/master" : "/profile";
    return <Navigate to={fallback} replace />;
  }
  return <PaymentStatementPage />;
};

const ExpenseTrackerRoute = () => {
  const user = useAuthStore((state) => state.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!isAdmin(user.role)) {
    return <Navigate to="/profile" replace />;
  }
  if (!canViewExpenseTracker(user)) {
    return <Navigate to="/admin/master" replace />;
  }
  return <ExpensesPage />;
};

const AccountStatementRoute = () => {
  const user = useAuthStore((state) => state.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!isAdmin(user.role)) {
    return <Navigate to="/profile" replace />;
  }
  if (!canViewPaymentStatement(user) || !canViewExpenseTracker(user)) {
    return <Navigate to="/admin/master" replace />;
  }
  return <AccountStatementPage />;
};

const App = () => (
  <Routes>
    <Route path="/" element={<HomeRoute />} />
    <Route path="/donation" element={<DonationPage />} />
    <Route
      path="/login"
      element={
        <AuthLayout title="Welcome back" variant="immersive">
          <LoginPage />
        </AuthLayout>
      }
    />
    <Route
      path="/register"
      element={
        <AuthLayout title="Create your donor account" variant="immersive">
          <RegisterPage />
        </AuthLayout>
      }
    />
    <Route
      path="/forgot-password"
      element={
        <AuthLayout title="Reset your password" variant="immersive">
          <ForgotPasswordPage />
        </AuthLayout>
      }
    />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/profile" element={<DonorProfile />} />
        <Route path="/profile/donor-corner" element={<DonorCornerPage />} />
        <Route path="/pooja/register" element={<PoojaRegistrationPage />} />
        <Route path="/payments/general" element={<PaymentPage />} />
        <Route path="/payments/combine" element={<CombinePaymentPage />} />
        <Route path="/payments/statement" element={<PaymentStatementRoute />} />
        <Route path="/profile/about" element={<About embedded />} />
        <Route path="/profile/family-tree" element={<FamilyTreePage />} />
        <Route path="/profile/cow-samrakshana-seva" element={<CowSamrakshanaSeva />} />
        <Route path="/profile/pooja-seva" element={<PoojaSeva />} />
        <Route path="/profile/ubhayam-report" element={<PoojaDetailsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
      </Route>
    </Route>
    <Route element={<ProtectedRoute requireAdmin />}>
      <Route element={<AppLayout />}>
        <Route path="/admin/dashboard" element={<Navigate to="/admin/master" replace />} />
        <Route path="/admin/master" element={<AdminMasterPage />} />
        <Route path="/admin/bulk-upload" element={<Navigate to="/admin/master" replace />} />
        <Route path="/admin/donors" element={<DonorDetailsPage />} />
        <Route path="/admin/pooja-details" element={<PoojaDetailsPage />} />
        <Route
          path="/admin/combine-payment-donor"
          element={<CombinePaymentDonorPage />}
        />
        <Route
          path="/admin/pooja-pause-cancel"
          element={<PoojaPauseCancelPage />}
        />
        <Route path="/reports" element={<ReportPage />} />
        <Route path="/admin/expenses" element={<ExpenseTrackerRoute />} />
        <Route path="/admin/account-statement" element={<AccountStatementRoute />} />
        <Route path="/admin/donor-pooja-details" element={<DonorPoojaDetails />} />
        <Route path="/admin/donor-pooja-registrations" element={<DonorPoojaDetails />} />
      </Route>
    </Route>
    <Route path="/about" element={<About />} />
    <Route path="/kovi-details" element={<KovilDetailsPage />} />
    <Route
      path="/about-kakkalani-village"
      element={<AboutKakkalaniVillage />}
    />
    <Route
      path="/why-visit-native-village"
      element={<WhyVisitNativeVillage />}
    />
    <Route path="/history" element={<History />} />
    <Route path="/profile/kovi-details" element={<Navigate to="/kovi-details" replace />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
export default App;
