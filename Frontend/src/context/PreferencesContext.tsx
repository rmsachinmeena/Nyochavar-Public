import React, { createContext, useContext, useState, ReactNode } from 'react';

type GenderPreference = 'men' | 'women' | null;

interface PreferencesContextType {
  genderPreference: GenderPreference;
  handleSelectGender: (gender: 'men' | 'women') => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const PreferencesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [genderPreference, setGenderPreference] = useState<GenderPreference>(() => {
    const saved = localStorage.getItem('petal_pen_gender');
    return (saved === 'men' || saved === 'women') ? saved : 'women';
  });

  const handleSelectGender = (gender: 'men' | 'women') => {
    setGenderPreference(gender);
    localStorage.setItem('petal_pen_gender', gender);
  };

  return (
    <PreferencesContext.Provider value={{ genderPreference, handleSelectGender }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};
