import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, PreferencesProvider, CartProvider, FavoritesProvider, UIProvider } from './context';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PreferencesProvider>
          <CartProvider>
            <FavoritesProvider>
              <UIProvider>
                <App />
              </UIProvider>
            </FavoritesProvider>
          </CartProvider>
        </PreferencesProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
