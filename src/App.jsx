import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import ErrorBoundary from './components/common/ErrorBoundary';
import PageTransition from './components/common/PageTransition';

import DashboardPage from './pages/Dashboard/DashboardPage';
import MessagingPage from './pages/Messaging/MessagingPage';
import MapViewPage from './pages/MapView/MapViewPage';
import ReportsPage from './pages/Reports/ReportsPage';
import SettingsPage from './pages/Settings/SettingsPage';
import NotFoundPage from './pages/NotFound/NotFoundPage';

import './styles.css';

export default function App() {
  return (
    <ErrorBoundary>
      <div className="app-shell">
        <Header />
        <Sidebar />
        <main className="main-content" id="main-content">
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
    </ErrorBoundary>
  );
}
