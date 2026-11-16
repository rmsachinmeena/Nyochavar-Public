import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Store,
  ShieldCheck,
  PlusCircle,
  ExternalLink,
  Bell,
  Menu,
  ChevronDown,
  LogOut,
  Sparkles,
  Palmtree,
  UserCheck
} from 'lucide-react';
import { useSeller } from '../context/SellerContext';
import { BrandLogo, LOGO_MARK_SRC } from '../../components/layout/BrandLogo';

interface SellerNavbarProps {
  onToggleSidebar: () => void;
}

export const SellerNavbar: React.FC<SellerNavbarProps> = ({ onToggleSidebar }) => {
  const { profile, logout, orders, stats } = useSeller();

  // Alerts come from the seller's real orders and stock
  const newOrders = orders.filter((order) => order.status === 'new').length;
  const waitingForRider = orders.filter((order) => order.status === 'ready_for_pickup').length;
  const alerts = [
    newOrders > 0 && {
      title: `${newOrders} new order${newOrders === 1 ? '' : 's'} to pack`,
      text: 'Mark them ready so the rider can pick them up.',
      to: '/seller/orders',
      tone: 'bg-amber-50/70 text-amber-900',
    },
    waitingForRider > 0 && {
      title: `${waitingForRider} order${waitingForRider === 1 ? '' : 's'} waiting for the rider`,
      text: 'Keep the pickup code ready.',
      to: '/seller/orders',
      tone: 'bg-brand-soft/70 text-brand-dark',
    },
    stats.outOfStockCount > 0 && {
      title: `${stats.outOfStockCount} product${stats.outOfStockCount === 1 ? ' is' : 's are'} out of stock`,
      text: 'Buyers cannot order them until you add stock.',
      to: '/seller/products',
      tone: 'bg-rose-50/70 text-rose-900',
    },
  ].filter(Boolean) as Array<{ title: string; text: string; to: string; tone: string }>;
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md sm:px-6">
      {/* Left: Mobile Toggle & Nyochavar Brand Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-ink hover:bg-slate-100 lg:hidden cursor-pointer"
          title="Toggle Navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link to="/seller/dashboard" className="flex items-center gap-2.5">
          <BrandLogo size="sm" className="hidden sm:block" />
          <img src={LOGO_MARK_SRC} alt="Nyochavar" className="h-8 w-8 sm:hidden object-contain" />
          <div className="flex items-center gap-1.5 pl-2 sm:border-l sm:border-slate-200">
            <span className="text-xs font-bold tracking-tight text-ink uppercase">Seller Hub</span>
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-brand">
              Partner
            </span>
          </div>
        </Link>
      </div>

      {/* Center: Store Status Pill */}
      <div className="hidden items-center gap-2 md:flex">
        <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50 px-3.5 py-1.5 shadow-2xs">
          <Store className="h-3.5 w-3.5 text-brand" />
          <span className="text-xs font-semibold text-ink">{profile.storeName}</span>
          {profile.kycStatus === 'verified' && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              <ShieldCheck className="h-3 w-3 text-emerald-600" />
              Verified Seller
            </span>
          )}
          {profile.isVacationMode && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              <Palmtree className="h-3 w-3 text-amber-600" />
              Vacation Mode Active
            </span>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Add Product CTA */}
        <Link
          to="/seller/products/new"
          className="flex h-9 items-center gap-1.5 rounded-full bg-brand px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-dark active:scale-95"
        >
          <PlusCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Add Product</span>
        </Link>

        {/* View Live Store */}
        <Link
          to="/catalog"
          target="_blank"
          className="hidden h-9 items-center gap-1 rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 lg:flex"
          title="Open live buyer storefront"
        >
          <span>Storefront</span>
          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
        </Link>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className="relative grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100 cursor-pointer"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {alerts.length > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand ring-2 ring-white" />}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-float z-50">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-ink">Nyochavar Seller Alerts</span>
                {alerts.length > 0 && (
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand">
                    {alerts.length} to do
                  </span>
                )}
              </div>
              <div className="mt-2 space-y-2">
                {alerts.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-500">You are all caught up. Nothing needs your attention.</p>
                ) : (
                  alerts.map((alert) => (
                    <Link
                      key={alert.title}
                      to={alert.to}
                      onClick={() => setShowNotifications(false)}
                      className={`block rounded-xl p-2.5 text-xs ${alert.tone}`}
                    >
                      <p className="font-semibold">{alert.title}</p>
                      <p className="mt-0.5 text-[11px] opacity-80">{alert.text}</p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 rounded-full border border-slate-200 p-1 pr-2.5 transition hover:bg-slate-50 cursor-pointer"
          >
            <div className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-bold text-white">
              {profile.ownerName.charAt(0)}
            </div>
            <span className="hidden text-xs font-semibold text-ink sm:inline">
              {profile.ownerName.split(' ')[0]}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-float z-50">
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="text-xs font-bold text-ink">{profile.storeName}</p>
                <p className="text-[11px] text-slate-500">{profile.email}</p>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    navigate('/seller/settings');
                    setShowProfileMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer text-left"
                >
                  <UserCheck className="h-4 w-4 text-slate-400" />
                  Store Settings & KYC
                </button>
                <Link
                  to="/"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Sparkles className="h-4 w-4 text-slate-400" />
                  Switch to Buyer Mode
                </Link>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 cursor-pointer text-left"
                >
                  <LogOut className="h-4 w-4 text-rose-400" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
