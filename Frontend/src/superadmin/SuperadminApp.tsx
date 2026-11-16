import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AdminShellLayout from './layouts/AdminShellLayout';
import AdminDashboardPage from './pages/dashboard/AdminDashboardPage';

export const SuperadminApp: React.FC = () => {
  return (
    <Routes>
      <Route element={<AdminShellLayout />}>
        <Route index element={<AdminDashboardPage />} />
      </Route>
    </Routes>
  );
};

export default SuperadminApp;
