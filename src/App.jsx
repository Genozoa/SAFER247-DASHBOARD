import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import DashboardPage from './pages/Dashboard/DashboardPage';
import MessagingPage from './pages/Messaging/MessagingPage';
import MapViewPage from './pages/MapView/MapViewPage';
import ReportsPage from './pages/Reports/ReportsPage';
import SettingsPage from './pages/Settings/SettingsPage';

import './styles.css';

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <Sidebar />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/messaging" element={<MessagingPage />} />
        <Route path="/map" element={<MapViewPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </div>
  );
}
