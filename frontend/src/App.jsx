import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import StudentLayout from './components/StudentLayout'
import InstallPrompt from './components/InstallPrompt'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ProfileSetup from './pages/ProfileSetup'
import ForgotPassword from './pages/ForgotPassword'
import Reset from './pages/Reset'
import FirstPayment from './pages/FirstPayment'
import PaymentSuccess from './pages/PaymentSuccess'
import Home from './pages/student/Home'
import Payments from './pages/student/Payments'
import Profile from './pages/student/Profile'
import AdminLayout from './components/AdminLayout'
import AdminLogin from './pages/admin/AdminLogin'
import AdminHome from './pages/admin/AdminHome'
import AdminStudents from './pages/admin/AdminStudents'
import AddStudent from './pages/admin/AddStudent'
import AdminStudentDetail from './pages/admin/AdminStudentDetail'
import AdminPayments from './pages/admin/AdminPayments'
import AdminSettings from './pages/admin/AdminSettings'
import Terms from './pages/legal/Terms'
import Privacy from './pages/legal/Privacy'
import RefundPolicy from './pages/legal/RefundPolicy'
import Contact from './pages/legal/Contact'
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
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset" element={<Reset />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/refund" element={<RefundPolicy />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route path="/admin" element={<AdminHome />} />
            <Route path="/admin/students" element={<AdminStudents />} />
            <Route path="/admin/students/new" element={<AddStudent />} />
            <Route path="/admin/students/:id" element={<AdminStudentDetail />} />
            <Route path="/admin/payments" element={<AdminPayments />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
          </Route>

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
