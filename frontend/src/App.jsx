import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import StudentLayout from './components/StudentLayout'
import InstallPrompt from './components/InstallPrompt'
import Login from './pages/Login'
import Signup from './pages/Signup'
import AuthCallback from './pages/AuthCallback'
import ProfileSetup from './pages/ProfileSetup'
import ForgotPassword from './pages/ForgotPassword'
import FirstPayment from './pages/FirstPayment'
import PaymentSuccess from './pages/PaymentSuccess'
import Home from './pages/student/Home'
import Payments from './pages/student/Payments'
import Profile from './pages/student/Profile'
import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import './App.css'

// Protected student area: requires a signed-in session.
function ProtectedShell() {
  return (
    <ProtectedRoute>
      <Outlet />
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <InstallPrompt />
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />

          {/* Protected student area */}
          <Route element={<ProtectedShell />}>
            <Route path="/profile-setup" element={<ProfileSetup />} />
            <Route path="/first-payment" element={<FirstPayment />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route element={<StudentLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
