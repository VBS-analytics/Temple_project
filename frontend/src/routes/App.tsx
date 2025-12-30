import { Navigate, Route, Routes } from 'react-router-dom';

import AppLayout from '../components/AppLayout';
import AuthLayout from '../components/AuthLayout';
import ProtectedRoute from '../components/ProtectedRoute';
import CalendarPage from '../pages/CalendarPage';
import DashboardPage from '../pages/DashboardPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import LoginPage from '../pages/LoginPage';
import PoojaRegistrationPage from '../pages/PoojaRegistrationPage';
import PaymentPage from '../pages/payments/PaymentPage';
import PaymentStatementPage from '../pages/payments/PaymentStatementPage';
import RegisterPage from '../pages/RegisterPage';
import AdminMasterPage from '../pages/admin/AdminMasterPage';
import BulkDonorUploadPage from '../pages/admin/BulkDonorUploadPage';
import DonorDetailsPage from '../pages/admin/DonorDetailsPage';
import PoojaDetailsPage from '../pages/admin/PoojaDetailsPage';
import LandingPage from '../pages/LandingPage';
import Gallery from '../pages/Gallery';
import Events from '../pages/Events';
import Projects from '../pages/Projects';
import About from '../pages/About';
import DonorProfile from '../pages/DonorProfile';
import CombinePaymentPage from '../pages/payments/CombinePaymentPage';
import ReportPage from '../pages/ReportPage';
import { useAuthStore } from '../store/auth';

const HomeRoute = () => {
  const user = useAuthStore((state) => state.user);
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <LandingPage />;
};

const App = () => (
  <Routes>
    <Route path="/" element={<HomeRoute />} />
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
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<DonorProfile />} />
        <Route path="/pooja/register" element={<PoojaRegistrationPage />} />
        <Route path="/payments/general" element={<PaymentPage />} />
        <Route path="/payments/combine" element={<CombinePaymentPage />} />
        <Route path="/payments/statement" element={<PaymentStatementPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
      </Route>
    </Route>

    <Route element={<ProtectedRoute requireAdmin />}>
      <Route element={<AppLayout />}>
        <Route path="/admin/master" element={<AdminMasterPage />} />
        <Route path="/admin/bulk-upload" element={<BulkDonorUploadPage />} />
        <Route path="/admin/donors" element={<DonorDetailsPage />} />
        <Route path="/admin/pooja-details" element={<PoojaDetailsPage />} />
        <Route path="/reports" element={<ReportPage />} />
        <Route path="/admin/donor-pooja-registrations" element={<Navigate to="/admin/donors" replace />} />
      </Route>
    </Route>

    <Route path="/gallery" element={<Gallery />} />
    <Route path="/events" element={<Events />} />
    <Route path="/projects" element={<Projects />} />
    <Route path="/about" element={<About />} />

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
