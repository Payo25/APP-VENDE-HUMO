import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import NotFoundPage from './pages/NotFoundPage';
import FormsListPage from './pages/FormsListPage';
import CreateFormPage from './pages/CreateFormPage';
import EditFormPage from './pages/EditFormPage';
import ViewFormPage from './pages/ViewFormPage';
import UserManagementPage from './pages/UserManagementPage';
import AuditLogsPage from './pages/AuditLogsPage';
import CallHoursPage from './pages/CallHoursPage';
import MySchedulePage from './pages/MySchedulePage';
import ManageUserSchedulePage from './pages/ManageUserSchedulePage';
import PayrollPage from './pages/RSAReportPage';
import FormsReportPage from './pages/FormsReportPage';
import HealthCentersPage from './pages/HealthCentersPage';
import PhysiciansPage from './pages/PhysiciansPage';
import RsaEmailsPage from './pages/RsaEmailsPage';
import InvoicesPage from './pages/InvoicesPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import './App.css';

const bgStyle: React.CSSProperties = {
  minHeight: '100vh',
  minWidth: '100vw',
  backgroundImage: "url('/bg.jpg')",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center center',
  backgroundAttachment: 'fixed',
  backgroundSize: 'cover',
};

const isAuthenticated = () => {
  return !!localStorage.getItem('user');
};

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <div style={bgStyle}>
      <Router>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/forms"
            element={
              <ProtectedRoute>
                <FormsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/forms/create"
            element={
              <ProtectedRoute>
                <CreateFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/forms/:id/edit"
            element={
              <ProtectedRoute>
                <EditFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/forms/:id"
            element={
              <ProtectedRoute>
                <ViewFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <UserManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute>
                <AuditLogsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/call-hours" element={<ProtectedRoute><CallHoursPage /></ProtectedRoute>} />
          <Route
            path="/call-hours-personal"
            element={
              <ProtectedRoute>
                <MySchedulePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manage-user-schedule"
            element={
              <ProtectedRoute>
                <ManageUserSchedulePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rsa-report"
            element={
              <ProtectedRoute>
                <PayrollPage />
              </ProtectedRoute>
            }
          />
          <Route path="/forms-report" element={<ProtectedRoute><FormsReportPage /></ProtectedRoute>} />
          <Route path="/health-centers" element={<ProtectedRoute><HealthCentersPage /></ProtectedRoute>} />
          <Route
            path="/physicians"
            element={
              <ProtectedRoute>
                <PhysiciansPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rsa-emails"
            element={
              <ProtectedRoute>
                <RsaEmailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices"
            element={
              <ProtectedRoute>
                <InvoicesPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
