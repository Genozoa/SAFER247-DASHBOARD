import React from 'react';
import TopHeader from './TopHeader';
import Sidebar from './Sidebar';
import '../../styles/app-shell.css';

export default function AppShell({ children }) {
  return (
    <div className="cc-app-shell">
      <TopHeader />
      <div className="cc-layout">
        <Sidebar />
        <main className="cc-main" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
