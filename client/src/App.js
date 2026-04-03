import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AdminDashboard from './pages/AdminDashboard';
import ResidentDashboard from './pages/ResidentDashboard';
import SecurityDashboard from './pages/SecurityDashboard';
import NotificationsPage from './pages/NotificationsPage';
import Header from './components/Header';
import Footer from './components/Footer';
import { isLoggedIn, getUserRole } from './utils/auth';

const ProtectedRoute = ({ children, allowedRoles }) => {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles) {
    const userRole = getUserRole();
    if (!allowedRoles.includes(userRole)) {
      return <Navigate to="/" replace />;
    }
  }
  return children;
};

const AppContent = () => {
  const location = useLocation();

  const hideShell =
    location.pathname === "/login" ||
    location.pathname === "/signup" ||
    location.pathname.includes("dashboard") ||
    location.pathname === "/notifications";

  return (
    <div className="min-h-screen flex flex-col">
      {!hideShell && <Header />}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route 
            path="/admin-dashboard" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/resident-dashboard" 
            element={
              <ProtectedRoute allowedRoles={['resident']}>
                <ResidentDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/security-dashboard" 
            element={
              <ProtectedRoute allowedRoles={['security']}>
                <SecurityDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/notifications" 
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!hideShell && <Footer />}
    </div>
  );
};

const App = () => {
  return <AppContent />;
};

export default App;