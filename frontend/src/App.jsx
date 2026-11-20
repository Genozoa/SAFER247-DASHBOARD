import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import ErrorBoundary from './components/common/ErrorBoundary';
import PageTransition from './components/common/PageTransition';
import { AuthProvider, useAuth } from './auth/AuthContext';
import {
  OperationalDataProvider,
  useOperationalData,
} from './data/OperationalDataContext';

import DashboardPage from './pages/Dashboard/DashboardPage';
import MessagingPage from './pages/Messaging/MessagingPage';
import MapViewPage from './pages/MapView/MapViewPage';
import ReportsPage from './pages/Reports/ReportsPage';
import SettingsPage from './pages/Settings/SettingsPage';
import NotFoundPage from './pages/NotFound/NotFoundPage';
import AuthPage from './pages/Auth/AuthPage';

import './styles.css';

function AuthenticatedApp() {
  const { operator, ready, logout } = useAuth();

  if (!ready) {
    return <main className="auth-page" role="status">Checking operator session…</main>;
  }

  if (!operator) {
    return (
      <Routes>
        <Route path="/register" element={<AuthPage />} />
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  return (
    <OperationalDataProvider key={operator.call_sign} operator={operator}>
      <AuthenticatedShell operator={operator} logout={logout} />
    </OperationalDataProvider>
  );
}

function AuthenticatedShell({ operator, logout }) {
  const { loading, error, dataSource } = useOperationalData();

  return (
    <div className="app-shell">
      <Header operator={operator} />
      <Sidebar onLogout={logout} />
      <main className="main-content" id="main-content">
        {dataSource === 'demo' && (
          <aside className="demo-data-banner" role="status">
            Demo data · {operator.call_sign}
            <span>
              Fictional sample records only. Outgoing demo messages stay local and are not transmitted;
              live officer GPS is unavailable.
            </span>
          </aside>
        )}
        {loading && <p role="status">Loading operational records…</p>}
        {error && <p className="auth-alert" role="alert">{error}</p>}
        <PageTransition>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/messaging" element={<MessagingPage />} />
            <Route path="/map" element={<MapViewPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </PageTransition>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </ErrorBoundary>
  );
}
