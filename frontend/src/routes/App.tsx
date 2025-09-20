import { Navigate, Route, Routes } from 'react-router-dom';

import AppLayout from '../components/AppLayout';
import AuthLayout from '../components/AuthLayout';
import ProtectedRoute from '../components/ProtectedRoute';
import CalendarPage from '../pages/CalendarPage';
import DashboardPage from '../pages/DashboardPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import LoginPage from '../pages/LoginPage';
import PaymentPage from '../pages/PaymentPage';
import PoojaRegistrationPage from '../pages/PoojaRegistrationPage';
import RegisterPage from '../pages/RegisterPage';
import AdminMasterPage from '../pages/admin/AdminMasterPage';
import { useAuthStore } from '../store/auth';

const LandingRedirect = () => {
  const user = useAuthStore((state) => state.user);
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
};

const App = () => (
  <Routes>
    <Route path="/" element={<LandingRedirect />} />
    <Route
      path="/login"
      element={
        <AuthLayout title="Welcome back">
          <LoginPage />
        </AuthLayout>
      }
    />
    <Route
      path="/register"
      element={
        <AuthLayout title="Create your donor account">
          <RegisterPage />
        </AuthLayout>
      }
    />
    <Route
      path="/forgot-password"
      element={
        <AuthLayout title="Reset your password">
          <ForgotPasswordPage />
        </AuthLayout>
      }
    />

    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/pooja/register" element={<PoojaRegistrationPage />} />
        <Route path="/payments" element={<PaymentPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
      </Route>
    </Route>

    <Route element={<ProtectedRoute requireAdmin />}>
      <Route element={<AppLayout />}>
        <Route path="/admin/master" element={<AdminMasterPage />} />
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
