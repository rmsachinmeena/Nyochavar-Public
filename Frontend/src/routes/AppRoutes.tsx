import React from 'react';
import { Routes, Route } from 'react-router-dom';

import MainLayout from '../layouts/MainLayout';
import AdminLayout from '../layouts/AdminLayout';

import HomePage from '../pages/home/HomePage';
import { CatalogPage } from '../pages/catalog/CatalogPage';
import { ProductDetailPage } from '../pages/product-detail/ProductDetailPage';
import { HamperBuilderPage } from '../pages/hamper-builder/HamperBuilderPage';
import { AnniversaryPage } from '../pages/anniversary/AnniversaryPage';
import { PrivacyPolicyPage } from '../pages/legal/PrivacyPolicyPage';
import { TermsPage } from '../pages/legal/TermsPage';
import { RefundPolicyPage } from '../pages/legal/RefundPolicyPage';
import { ShippingPolicyPage } from '../pages/legal/ShippingPolicyPage';
import { ContactPage } from '../pages/legal/ContactPage';
import { CheckoutPage } from '../pages/checkout/CheckoutPage';
import { AuthPage } from '../pages/auth/AuthPage';
import { ProfilePage } from '../pages/profile/ProfilePage';
import NotFoundPage from '../pages/not-found/NotFoundPage';

import RequireAdmin from './RequireAdmin';
import AdminDashboardPage from '../superadmin/pages/dashboard/AdminDashboardPage';
import AdminLoginPage from '../superadmin/pages/auth/AdminLoginPage';
import AdminBannersPage from '../superadmin/pages/banners/AdminBannersPage';
import AdminProductsPage from '../superadmin/pages/products/AdminProductsPage';
import AdminCategoriesPage from '../superadmin/pages/categories/AdminCategoriesPage';
import AdminOrdersPage from '../superadmin/pages/orders/AdminOrdersPage';
import AdminAuditLogsPage from '../superadmin/pages/audit/AdminAuditLogsPage';
import AdminRidersPage from '../superadmin/pages/riders/AdminRidersPage';
import AdminNotificationsPage from '../superadmin/pages/notifications/AdminNotificationsPage';
import AdminAutomationPage from '../superadmin/pages/automation/AdminAutomationPage';
import AdminCouponsPage from '../superadmin/pages/coupons/AdminCouponsPage';
import RiderPortalPage from '../pages/rider/RiderPortalPage';
import SellerApp from '../seller/SellerApp';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Storefront pages share the navbar, footer, cart, wishlist and search */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/product/:id" element={<ProductDetailPage />} />
        <Route path="/builder" element={<HamperBuilderPage />} />
        <Route path="/anniversary" element={<AnniversaryPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/refund-policy" element={<RefundPolicyPage />} />
        <Route path="/shipping-policy" element={<ShippingPolicyPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Full-screen pages that bring their own navigation */}
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/sign" element={<AuthPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/rider" element={<RiderPortalPage />} />
      <Route path="/seller/*" element={<SellerApp />} />

      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<RequireAdmin />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="riders" element={<AdminRidersPage />} />
          <Route path="audit-logs" element={<AdminAuditLogsPage />} />
          <Route path="analytics" element={<AdminDashboardPage defaultTab="user_details" />} />
          <Route path="events" element={<AdminDashboardPage defaultTab="events" />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="banners" element={<AdminBannersPage />} />
          <Route path="coupons" element={<AdminCouponsPage />} />
          <Route path="automation" element={<AdminAutomationPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
        </Route>
      </Route>
    </Routes>
  );
};

export default AppRoutes;
