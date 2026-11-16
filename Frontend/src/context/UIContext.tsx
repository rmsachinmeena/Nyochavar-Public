import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';

export interface ToastData {
  id: number;
  title: string;
  description?: string;
  image?: string;
  /** 'warning' shows an amber alert icon instead of the green tick */
  tone?: 'success' | 'warning';
  action?: { label: string; onClick: () => void };
}

interface UIContextType {
  isCartDrawerOpen: boolean;
  setIsCartDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSearchModalOpen: boolean;
  setIsSearchModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isFavoritesModalOpen: boolean;
  setIsFavoritesModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toast: ToastData | null;
  showToast: (toast: Omit<ToastData, 'id'>) => void;
  dismissToast: () => void;
}

const TOAST_DURATION_MS = 4000;

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isFavoritesModalOpen, setIsFavoritesModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const dismissToast = useCallback(() => {
    window.clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const showToast = useCallback((next: Omit<ToastData, 'id'>) => {
    window.clearTimeout(toastTimer.current);
    setToast({ ...next, id: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  return (
    <UIContext.Provider
      value={{
        isCartDrawerOpen,
        setIsCartDrawerOpen,
        isSearchModalOpen,
        setIsSearchModalOpen,
        isFavoritesModalOpen,
        setIsFavoritesModalOpen,
        toast,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
