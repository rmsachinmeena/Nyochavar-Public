import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ExternalLink, LogOut, Plus, ShoppingBag } from 'lucide-react';
import { useEscapeKey } from '../hooks/useOverlay';

export interface AdminNavItem {
  label: string;
  shortLabel?: string;
  // One-line name for the + menu tiles
  menuLabel?: string;
  path: string;
  icon: React.ReactNode;
  exact?: boolean;
  badge?: string;
}

interface AdminMobileNavProps {
  sections: { heading: string; items: AdminNavItem[] }[];
  // Paths pinned to the bar, two on each side of the + button
  pinned: [string, string, string, string];
  onLogout: () => void;
}

const isPathActive = (pathname: string, item: AdminNavItem) =>
  item.exact
    ? pathname === item.path
    : pathname === item.path || (item.path !== '/admin' && pathname.startsWith(item.path));

export const AdminMobileNav: React.FC<AdminMobileNavProps> = ({ sections, pinned, onLogout }) => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEscapeKey(menuOpen, () => setMenuOpen(false));

  const allItems = sections.flatMap((s) => s.items);
  const pinnedItems = pinned
    .map((path) => allItems.find((i) => i.path === path))
    .filter((i): i is AdminNavItem => Boolean(i));

  // Current page lives only inside the + menu — hint at it on the button
  const activeInMenu = !pinnedItems.some((i) => isPathActive(location.pathname, i));

  const renderTab = (item: AdminNavItem) => {
    const active = isPathActive(location.pathname, item);
    return (
      <Link
        key={item.path}
        to={item.path}
        aria-current={active ? 'page' : undefined}
        className="relative flex h-full flex-col items-center justify-end pb-2.5"
      >
        <span className="relative grid h-11 w-11 place-items-center">
          {active && (
            <motion.span
              layoutId="admin-mobile-nav-bubble"
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="absolute -top-6 left-0 h-11 w-11 rounded-full bg-blue-600 shadow-lg shadow-blue-600/40 ring-[6px] ring-white"
            />
          )}
          <span
            className={`relative transition-all duration-300 [&>svg]:h-5 [&>svg]:w-5 ${
              active ? '-translate-y-6 text-white' : 'text-slate-400'
            }`}
          >
            {item.icon}
          </span>
          {item.badge && (
            <span
              className={`absolute right-0 min-w-[18px] rounded-full bg-amber-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-white tabular-nums transition-all duration-300 ${
                active ? '-top-7' : 'top-0'
              }`}
            >
              {item.badge}
            </span>
          )}
        </span>
        <span
          className={`-mt-1 text-[11px] leading-none transition-colors ${
            active ? 'font-bold text-blue-600' : 'font-semibold text-slate-400'
          }`}
        >
          {item.shortLabel || item.label}
        </span>
      </Link>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="admin-nav-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] lg:hidden"
          />
        )}
      </AnimatePresence>

      <nav
        aria-label="Admin navigation"
        className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="relative mx-auto max-w-md">
          {/* All-options panel */}
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                key="admin-nav-menu"
                id="admin-nav-menu"
                role="dialog"
                aria-label="All admin sections"
                initial={{ opacity: 0, y: 24, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                style={{ transformOrigin: 'bottom center' }}
                className="absolute inset-x-0 bottom-full mb-3 max-h-[calc(100dvh-10rem)] overflow-y-auto rounded-[1.75rem] border border-slate-200/80 bg-white p-3 shadow-2xl shadow-slate-900/20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <div className="space-y-3">
                  {sections.map((section, sIdx) => (
                    <div key={section.heading}>
                      <div className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {section.heading}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {section.items.map((item, iIdx) => {
                          const active = isPathActive(location.pathname, item);
                          return (
                            <motion.div
                              key={item.path}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.03 * (sIdx * 3 + iIdx) }}
                            >
                              <Link
                                to={item.path}
                                aria-current={active ? 'page' : undefined}
                                title={item.label}
                                className={`relative flex h-full min-h-17 flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-2.5 text-center transition-colors ${
                                  active
                                    ? 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                    : 'border-slate-100 bg-slate-50/70 text-slate-600 active:bg-slate-100'
                                }`}
                              >
                                <span
                                  className={`grid h-8 w-8 place-items-center rounded-lg [&>svg]:h-4 [&>svg]:w-4 ${
                                    active ? 'bg-white/20 text-white' : 'bg-white text-blue-600 shadow-xs'
                                  }`}
                                >
                                  {item.icon}
                                </span>
                                <span className="w-full truncate text-[11px] font-semibold leading-none">
                                  {item.menuLabel || item.label}
                                </span>
                                {item.badge && (
                                  <span
                                    className={`absolute right-1 top-1 min-w-4 rounded-full px-1 text-[9px] font-bold leading-4 tabular-nums ${
                                      active ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {item.badge}
                                  </span>
                                )}
                              </Link>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* General */}
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                  <a
                    href="/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-2 text-[11px] font-semibold text-slate-700 active:bg-slate-50"
                  >
                    <ShoppingBag className="h-3.5 w-3.5 text-slate-400" />
                    <span>Storefront</span>
                    <ExternalLink className="h-3 w-3 text-slate-400" />
                  </a>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 px-2 text-[11px] font-semibold text-rose-600 active:bg-rose-100"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Log out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom bar */}
          <div className="grid h-[68px] grid-cols-5 rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_12px_32px_-10px_rgba(15,23,42,0.25)]">
            {pinnedItems.slice(0, 2).map(renderTab)}

            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={menuOpen ? 'Close all sections' : 'Open all sections'}
                aria-expanded={menuOpen}
                aria-controls="admin-nav-menu"
                className={`relative grid h-12 w-12 place-items-center rounded-2xl text-white shadow-lg transition-colors duration-300 ${
                  menuOpen ? 'bg-slate-900 shadow-slate-900/30' : 'bg-blue-600 shadow-blue-600/40'
                }`}
              >
                <motion.span
                  animate={{ rotate: menuOpen ? 135 : 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="grid place-items-center"
                >
                  <Plus className="h-6 w-6" strokeWidth={2.5} />
                </motion.span>
                {activeInMenu && !menuOpen && (
                  <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-white" />
                )}
              </button>
            </div>

            {pinnedItems.slice(2, 4).map(renderTab)}
          </div>
        </div>
      </nav>
    </>
  );
};

export default AdminMobileNav;
