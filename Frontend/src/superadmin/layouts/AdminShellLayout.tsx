import React from 'react';
import { Outlet } from 'react-router-dom';

export const AdminShellLayout: React.FC = () => {
  return (
    <div style={{ padding: '1rem' }}>
      <h1>Superadmin Shell</h1>
      <Outlet />
    </div>
  );
};

export default AdminShellLayout;
