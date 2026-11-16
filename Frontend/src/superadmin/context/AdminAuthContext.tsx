import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AdminUser } from '../../types';

interface AdminAuthContextType {
  adminUser: AdminUser | null;
  handleAdminLogin: (user: AdminUser) => void;
  handleAdminLogout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  const handleAdminLogin = (user: AdminUser) => {
    setAdminUser(user);
  };

  const handleAdminLogout = () => {
    setAdminUser(null);
  };

  return (
    <AdminAuthContext.Provider value={{ adminUser, handleAdminLogin, handleAdminLogout }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
