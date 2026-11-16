import { CONCIERGE_DISPLAY } from "../../config/contact";
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  ShoppingBag,
  CreditCard,
  Settings,
  HelpCircle,
  X,
  Store,
  ArrowUpRight
} from 'lucide-react';
import { useSeller } from '../context/SellerContext';
import { BrandLogo, LOGO_MARK_SRC } from '../../components/layout/BrandLogo';

interface SellerSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SellerSidebar: React.FC<SellerSidebarProps> = ({ isOpen, onClose }) => {
  const { stats, profile } = useSeller();

  const navItems = [
    {
      label: 'Dashboard',
      to: '/seller/dashboard',
      icon: LayoutDashboard
    },
    {
      label: 'My Products',
      to: '/seller/products',
      icon: Package,
      badge: stats.totalProductsCount ? String(stats.totalProductsCount) : undefined
    },
    {
      label: 'Add Product',
      to: '/seller/products/new',
      icon: PlusCircle
    },
    {
      label: 'Orders & Dispatch',
      to: '/seller/orders',
      icon: ShoppingBag,
      badge: stats.pendingOrdersCount > 0 ? `${stats.pendingOrdersCount} New` : undefined,
      badgeColor: 'bg-amber-100 text-amber-800'
    },
    {
      label: 'Payouts & Ledger',
      to: '/seller/payouts',
      icon: CreditCard
    },
    {
      label: 'Shop Settings & KYC',
      to: '/seller/settings',
      icon: Settings
    }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200/80 bg-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header inside Drawer for Mobile */}
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5 lg:hidden">
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" />
            <span className="text-xs font-bold text-ink">Seller Hub</span>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Store Card Quick Glance */}
        <div className="p-4">
          <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-brand-soft/40 p-3.5 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Active Store
            </p>
            <p className="mt-0.5 truncate font-bold text-ink text-sm">
              {profile.storeName}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
              <span>Rating: ⭐ {profile.rating > 0 ? profile.rating : 'New'}</span>
              <span className="font-semibold text-brand">
                ₹{stats.todayRevenue.toLocaleString('en-IN')} today
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/seller/dashboard'}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-brand text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-2.5">
                      <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : item.badgeColor || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Support & Landing Link */}
        <div className="border-t border-slate-100 p-3 space-y-2">
          <NavLink
            to="/seller"
            onClick={onClose}
            className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <span className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-brand" />
              Seller Landing Page
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
          </NavLink>

          <div className="rounded-xl bg-slate-50 p-2.5 text-center text-[11px] text-slate-500">
            Need help? WhatsApp Nyochavar desk <br />
            <span className="font-semibold text-ink">{CONCIERGE_DISPLAY}</span>
          </div>
        </div>
      </aside>
    </>
  );
};
