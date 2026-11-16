import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { SellerProvider } from './context/SellerContext';
import { SellerLayout } from './layouts/SellerLayout';
import { SellerLandingPage } from './pages/landing/SellerLandingPage';
import { SellerRegisterPage } from './pages/onboarding/SellerRegisterPage';
import { SellerLoginPage } from './pages/auth/SellerLoginPage';
import { SellerDashboardPage } from './pages/dashboard/SellerDashboardPage';
import { SellerProductsPage } from './pages/products/SellerProductsPage';
import { SellerProductWizardPage } from './pages/products/wizard/SellerProductWizardPage';
import { SellerOrdersPage } from './pages/orders/SellerOrdersPage';
import { SellerPayoutsPage } from './pages/payouts/SellerPayoutsPage';
import { SellerSettingsPage } from './pages/settings/SellerSettingsPage';

export const SellerApp: React.FC = () => {
  return (
    <SellerProvider>
      <Routes>
        {/* Full-width Onboarding & Landing Pages */}
        <Route index element={<SellerLandingPage />} />
        <Route path="register" element={<SellerRegisterPage />} />
        <Route path="login" element={<SellerLoginPage />} />

        {/* Dashboard & Workspace inside dedicated SellerLayout */}
        <Route element={<SellerLayout />}>
          <Route path="dashboard" element={<SellerDashboardPage />} />
          <Route path="products" element={<SellerProductsPage />} />
          {/* "List a new product": the step-by-step form */}
          <Route path="products/new" element={<SellerProductWizardPage />} />
          <Route path="orders" element={<SellerOrdersPage />} />
          <Route path="payouts" element={<SellerPayoutsPage />} />
          <Route path="settings" element={<SellerSettingsPage />} />
        </Route>
      </Routes>
    </SellerProvider>
  );
};

export default SellerApp;
