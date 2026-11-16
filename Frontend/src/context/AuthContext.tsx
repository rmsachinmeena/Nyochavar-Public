import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { readStoredUser, saveStoredUser } from '../utils/storedUser';

interface AuthContextType {
  loggedInUser: User | null;
  handleLogin: (user: User) => void;
  handleLogout: () => void;
  setLoggedInUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loggedInUser, setLoggedInUser] = useState<User | null>(() => {
    const stored = readStoredUser();
    // Older versions saved the whole profile: shrink it to the safe minimum right away
    saveStoredUser(stored);
    return stored;
  });

  // The browser keeps only id/name/email, so the rest of the profile (phone, addresses) is loaded from the server
  const signedInId = loggedInUser?.id;
  useEffect(() => {
    if (!signedInId) return;
    let cancelled = false;
    api.getProfile(signedInId)
      .then((fresh) => {
        if (!cancelled && fresh) setLoggedInUser((prev) => (prev && prev.id === fresh.id ? { ...prev, ...fresh } : prev));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [signedInId]);

  const handleLogin = (user: User) => {
    setLoggedInUser(user);
    saveStoredUser(user);
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    // Also revokes the session on the server and drops the access token
    api.logout();
  };

  return (
    <AuthContext.Provider value={{ loggedInUser, handleLogin, handleLogout, setLoggedInUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
