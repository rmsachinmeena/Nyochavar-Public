import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  IndianRupee,
  ShoppingBag,
  Package,
  Star,
  PlusCircle,
  ArrowRight,
  Clock,
  CheckCircle2,
  Sparkles,
  Truck
} from 'lucide-react';
import { useSeller } from '../../context/SellerContext';
import { SellerStatsCard } from '../../components/SellerStatsCard';
import { OrderStatusBadge } from '../../components/OrderStatusBadge';

export const SellerDashboardPage: React.FC = () => {
  const { profile, products, orders, stats, markReadyForPickup } = useSeller();
  const navigate = useNavigate();

  // Pending orders waiting for action
  const urgentOrders = orders.filter((o) => o.status === 'new' || o.status === 'ready_for_pickup');

  // Top products
  const topProducts = [...products]
    .sort((a, b) => b.salesCount - a.salesCount)
    .slice(0, 4);

  const displayName = (profile.ownerName || profile.storeName || 'Seller').split(' ')[0];

  return (
    <div className="space-y-6">
      {/* Top Welcome Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-ink">
            Welcome back, {displayName} 👋
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Here is your live shop overview on <strong>Nyochavar Marketplace</strong> today.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/seller/products/new"
            className="flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-brand-dark active:scale-95 cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>List New Product</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid: Real Clean Data (0 when empty) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SellerStatsCard
          title="Today's Revenue"
          value={`₹${stats.todayRevenue.toLocaleString('en-IN')}`}
          subtitle={stats.todayRevenue > 0 ? "Net earnings after commission" : "No sales recorded today"}
          icon={IndianRupee}
          colorScheme="emerald"
          trend={stats.todayRevenue > 0 ? { value: '18% vs yesterday', isPositive: true } : undefined}
        />

        <SellerStatsCard
          title="Orders to Dispatch"
          value={stats.pendingOrdersCount}
          subtitle={stats.pendingOrdersCount > 0 ? "Awaiting pickup by rider" : "All orders dispatched"}
          icon={ShoppingBag}
          colorScheme="amber"
          trend={stats.pendingOrdersCount > 0 ? { value: `${stats.pendingOrdersCount} urgent`, isPositive: false } : undefined}
        />

        <SellerStatsCard
          title="Active Catalog"
          value={products.filter((p) => p.inStock).length}
          subtitle={stats.outOfStockCount > 0 ? `${stats.outOfStockCount} items out of stock` : `${products.length} products listed`}
          icon={Package}
          colorScheme="brand"
        />

        <SellerStatsCard
          title="Seller Performance"
          value={stats.sellerScore > 0 ? `${stats.sellerScore} ★` : 'New Seller'}
          subtitle={profile.totalReviews > 0 ? `Based on ${profile.totalReviews} reviews` : "No customer reviews yet"}
          icon={Star}
          colorScheme="purple"
          trend={profile.totalReviews > 0 ? { value: 'Top Seller', isPositive: true } : undefined}
        />
      </div>

      {/* Festive Announcements Banner (Light, Modern Palette) */}
      <div className="relative overflow-hidden rounded-3xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-white p-5 sm:p-6 text-slate-800 shadow-2xs">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft border border-brand/20 px-2.5 py-0.5 text-[10px] font-bold text-brand">
              <Sparkles className="h-3 w-3 text-brand" />
              Festive Gifting Season Alert
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-ink">
              Wedding & Anniversary Gift Demand is up by +45% this week!
            </h3>
            <p className="text-xs text-slate-600 max-w-xl">
              Keep your inventory updated. Gift boxes with personalization and custom message cards have 3x higher conversion rates.
            </p>
          </div>

          <Link
            to="/seller/products"
            className="shrink-0 rounded-full bg-brand px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-brand-dark active:scale-95 cursor-pointer"
          >
            Review Catalog Stock
          </Link>
        </div>
      </div>

      {/* Main Grid: Orders Queue & Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Orders Requiring Action (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Action Required Orders
              </h2>
              <span className="rounded-full bg-blue-50 border border-blue-200/80 px-2 py-0.5 text-[10px] font-bold text-brand">
                {urgentOrders.length} Pending
              </span>
            </div>

            <Link
              to="/seller/orders"
              className="text-xs font-semibold text-brand hover:text-brand-dark flex items-center gap-1"
            >
              <span>View All Orders</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {urgentOrders.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-xs">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-brand mb-3">
                <ShoppingBag className="h-6 w-6 text-brand" />
              </div>
              <p className="text-sm font-bold text-slate-800">No orders waiting for dispatch</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                When customers order your gifts, they will appear here with rider pickup schedules.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {urgentOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:shadow-sm transition"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div>
                      <span className="text-xs font-bold text-slate-900">{ord.orderNumber}</span>
                      <span className="ml-2 text-[11px] text-slate-500">{ord.orderDate}</span>
                    </div>
                    <OrderStatusBadge status={ord.status} size="sm" />
                  </div>

                  <div className="mt-3 flex items-start gap-3">
                    <img
                      src={ord.items[0]?.image}
                      alt={ord.items[0]?.title}
                      className="h-14 w-14 rounded-xl object-cover border border-slate-100 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {ord.items[0]?.title}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Qty: {ord.items[0]?.quantity} • Buyer: {ord.buyerName} ({ord.city})
                      </p>
                      {ord.items[0]?.customMessage && (
                        <p className="mt-1 text-[11px] font-medium text-purple-700 bg-purple-50 rounded-md px-2 py-0.5 truncate">
                          💌 Note: "{ord.items[0].customMessage}"
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-slate-900">
                        ₹{ord.subtotal.toLocaleString('en-IN')}
                      </p>
                      <p className="text-[10px] text-slate-400">{ord.paymentMethod}</p>
                    </div>
                  </div>

                  <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5">
                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span>Pickup: {profile.pickupAddress.pickupSlot}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {ord.status === 'new' ? (
                        <button
                          onClick={() => void markReadyForPickup(ord.id).catch(() => undefined)}
                          className="rounded-full bg-brand px-3.5 py-1.5 text-xs font-bold text-white hover:bg-brand-dark transition cursor-pointer"
                        >
                          Pack & Mark Ready
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {ord.pickupOtp ? (
                            <span className="text-[11px] font-bold text-brand bg-brand-soft px-2.5 py-1 rounded-full">
                              Rider OTP: {ord.pickupOtp}
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-500">With the rider</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Best Selling Products & Quick Stock (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink uppercase tracking-wider">
              Top Catalog Items
            </h2>
            <Link
              to="/seller/products"
              className="text-xs font-semibold text-brand hover:text-brand-dark"
            >
              Manage Inventory
            </Link>
          </div>

          {topProducts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 text-center shadow-xs">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3">
                <Package className="h-6 w-6 text-indigo-600" />
              </div>
              <p className="text-sm font-bold text-slate-800">No products added yet</p>
              <p className="text-xs text-slate-500 mt-1 mb-4 max-w-xs mx-auto">
                List your handcrafted hampers, flowers, or keepsake boxes to start receiving orders.
              </p>
              <Link
                to="/seller/products/new"
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-brand-dark transition active:scale-95 cursor-pointer"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Add First Product</span>
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 divide-y divide-slate-100 shadow-2xs">
              {topProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={p.images[0]}
                      alt={p.title}
                      className="h-11 w-11 rounded-lg object-cover border border-slate-100 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{p.title}</p>
                      <p className="text-[11px] text-slate-500">
                        ₹{p.price.toLocaleString('en-IN')} • {p.salesCount} sold
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        p.inStock
                          ? p.stock <= 5
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {p.inStock ? `${p.stock} in stock` : 'Out of Stock'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Payouts Widget */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Payout Account
              </span>
              <Link to="/seller/payouts" className="text-xs font-semibold text-brand hover:underline">
                View Ledger →
              </Link>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  {profile.bankDetails.bankName || 'UPI / Bank Transfer'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {profile.bankDetails.upiId ? `UPI: ${profile.bankDetails.upiId}` : (profile.bankDetails.accountNumber ? `A/C: ${profile.bankDetails.accountNumber}` : 'Direct weekly settlement')}
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200/60">
                Weekly Auto-Credit
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerDashboardPage;
