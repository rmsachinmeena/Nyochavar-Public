import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { AuthSessionGuard } from './components/system/AuthSessionGuard';
import { DynamicManifestManager } from './components/system/DynamicManifestManager';
import { Toaster } from './components/ui/Toaster';
import { ErrorBoundary } from './components/system/ErrorBoundary';
import { ReviewPrompt } from './components/system/ReviewPrompt';
import { eventTracker } from './services/eventTracker';

function RouteTracker() {
  const location = useLocation();

  useEffect(() => {
    // Track storefront routes (exclude admin & rider portal to keep buyer analytics clean)
    if (!location.pathname.startsWith('/admin') && !location.pathname.startsWith('/rider')) {
      const pageName = location.pathname === '/' ? 'Home' : location.pathname.slice(1).replace(/-/g, ' ');
      eventTracker.trackPageView(pageName, { path: location.pathname });
    }
  }, [location.pathname]);

  return null;
}

function GuardedRoutes() {
  const location = useLocation();
  // A crash on one page is cleared when the shopper moves to another page
  return (
    <ErrorBoundary resetKey={location.pathname}>
      <GuardedRoutes />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <>
      <RouteTracker />
      <AuthSessionGuard />
      <DynamicManifestManager />
      <AppRoutes />
      {/* One toaster for every page (storefront, profile, auth, admin, rider) */}
      <ReviewPrompt />
      <Toaster />
    </>
  );
}

