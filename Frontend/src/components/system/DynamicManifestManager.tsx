import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Dynamically switches the active Web App Manifest and Theme Color
 * based on current route (Buyer, Rider, or Admin).
 * Allows users to install role-specific PWAs directly from /rider, /admin, or /auth,
 * while preserving App Shortcuts on the master manifest.
 */
export const DynamicManifestManager = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname.toLowerCase();
    const manifestTag = document.getElementById('app-manifest') as HTMLLinkElement | null;
    const themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;

    let targetManifest = '/manifest.json';
    let targetTheme = '#0052FF';
    let targetTitle = 'Nyochavar - Luxury Gifting & Express Delivery';

    if (path.startsWith('/rider')) {
      targetManifest = '/manifest-rider.json';
      targetTheme = '#0284C7';
      targetTitle = 'Nyochavar - Rider Delivery Partner';
    } else if (path.startsWith('/admin')) {
      targetManifest = '/manifest-admin.json';
      targetTheme = '#0F172A';
      targetTitle = 'Nyochavar - Admin Console';
    } else if (path.startsWith('/auth') || path.startsWith('/sign')) {
      targetManifest = '/manifest-buyer.json';
      targetTheme = '#0052FF';
      targetTitle = 'Nyochavar - Buyer Login & Store';
    }

    if (manifestTag && manifestTag.getAttribute('href') !== targetManifest) {
      manifestTag.setAttribute('href', targetManifest);
    }

    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', targetTheme);
    }
  }, [location.pathname]);

  return null;
};

export default DynamicManifestManager;
