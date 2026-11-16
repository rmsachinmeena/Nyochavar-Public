import React, { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { SellerNavbar } from '../components/SellerNavbar';
import { SellerSidebar } from '../components/SellerSidebar';
import { useSeller } from '../context/SellerContext';
import { AlertCircle, Loader2, Palmtree } from 'lucide-react';

export const SellerLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { status, loadError, reload, logout, profile, toggleVacationMode } = useSeller();

  // Not signed in: the dashboard is for signed-in sellers only
  if (status === 'signed_out') return <Navigate to="/seller/login" replace />;

  if (status === 'loading') {
    return (
      <div role="status" className="grid min-h-screen place-items-center bg-[#F8FAFC] px-4 text-slate-500">
        <div className="flex flex-col items-center gap-3 text-sm font-medium">
          <Loader2 className="h-7 w-7 animate-spin text-brand" />
          Loading your store...
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F8FAFC] px-4">
        <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-500">
            <AlertCircle className="h-6 w-6" />
          </span>
          <h1 className="mt-3 font-serif text-xl text-ink">We could not load your store</h1>
          <p className="mt-1.5 text-sm text-slate-500">{loadError}</p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => void reload()}
              className="flex-1 cursor-pointer rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex-1 cursor-pointer rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans">
      {/* Vacation Mode Banner if active */}
      {profile.isVacationMode && (
        <div className="bg-amber-500 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palmtree className="h-4 w-4" />
            <span>
              Your shop is currently in <strong>Vacation Mode</strong>. Buyers cannot place new orders until you resume your store.
            </span>
          </div>
          <button
            onClick={() => void toggleVacationMode().catch(() => undefined)}
            className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-amber-800 hover:bg-amber-50 transition cursor-pointer"
          >
            Resume Store Now
          </button>
        </div>
      )}

      {/* Top Navbar */}
      <SellerNavbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />

      {/* Main Container with Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        <SellerSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 overflow-y-auto bg-[#F8FAFC] p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default SellerLayout;
