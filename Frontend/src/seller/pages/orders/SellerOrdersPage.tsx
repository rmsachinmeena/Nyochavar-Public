import React, { useState } from 'react';
import {
  ShoppingBag,
  Search,
  Filter,
  Clock,
  Printer,
  Truck,
  CheckCircle2,
  FileText,
  MapPin,
  X,
  QrCode,
  ShieldCheck,
  IndianRupee
} from 'lucide-react';
import { useSeller } from '../../context/SellerContext';
import { SellerOrder } from '../../data/mockSellerData';
import { OrderStatusBadge } from '../../components/OrderStatusBadge';

export const SellerOrdersPage: React.FC = () => {
  const { orders, profile, markReadyForPickup } = useSeller();

  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'ready_for_pickup' | 'in_transit' | 'delivered' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Shipping Label Modal State
  const [selectedOrderForLabel, setSelectedOrderForLabel] = useState<SellerOrder | null>(null);

  const filteredOrders = orders.filter((o) => {
    const matchesTab = activeTab === 'all' || o.status === activeTab;
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.items.some((it) => it.title.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Orders & Dispatch Hub
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Accept new customer gift orders, pack hampers, and coordinate rider handovers.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200/90 pb-3">
        {[
          { id: 'all', label: `All Orders (${orders.length})` },
          { id: 'new', label: `New (${orders.filter((o) => o.status === 'new').length})` },
          { id: 'ready_for_pickup', label: `Ready for Pickup (${orders.filter((o) => o.status === 'ready_for_pickup').length})` },
          { id: 'in_transit', label: `In Transit (${orders.filter((o) => o.status === 'in_transit').length})` },
          { id: 'delivered', label: `Delivered (${orders.filter((o) => o.status === 'delivered').length})` },
          { id: 'cancelled', label: `Cancelled (${orders.filter((o) => o.status === 'cancelled').length})` }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by order ID (e.g. ORD-782194), customer name, or item..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-200/90 bg-white py-2.5 pl-9 pr-4 text-xs font-medium focus:border-blue-600 focus:outline-none"
        />
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
            <ShoppingBag className="mx-auto h-10 w-10 text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">No orders found</p>
            <p className="text-xs text-slate-400 mt-1">There are no orders matching this filter.</p>
          </div>
        ) : (
          filteredOrders.map((ord) => (
            <div
              key={ord.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:shadow-md transition"
            >
              {/* Top Row: Order Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-extrabold text-slate-900">{ord.orderNumber}</span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-500">{ord.orderDate}</span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-semibold text-slate-700">
                    Payment: <span className="text-slate-900">{ord.paymentMethod}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <OrderStatusBadge status={ord.status} />
                  <button
                    onClick={() => setSelectedOrderForLabel(ord)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    title="Print Shipping Label & Invoice"
                  >
                    <Printer className="h-3.5 w-3.5 text-slate-500" />
                    <span>Label & Invoice</span>
                  </button>
                </div>
              </div>

              {/* Middle Row: Items & Customer Details */}
              <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                {/* Items List (7 cols) */}
                <div className="md:col-span-7 space-y-3">
                  {ord.items.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-16 w-16 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900">{item.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Price: ₹{item.price.toLocaleString('en-IN')} × {item.quantity} = ₹
                          {(item.price * item.quantity).toLocaleString('en-IN')}
                        </p>
                        {item.customMessage && (
                          <div className="mt-1.5 rounded-lg border border-purple-100 bg-purple-50/70 p-2 text-xs text-purple-900">
                            <span className="font-bold text-[10px] uppercase text-purple-700 block">
                              💌 Buyer's Handwritten Note Request:
                            </span>
                            <span className="italic font-serif">"{item.customMessage}"</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Customer & Delivery Destination (5 cols) */}
                <div className="md:col-span-5 rounded-xl bg-slate-50 p-3.5 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>Shipping Destination</span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{ord.buyerName}</p>
                    <p className="text-slate-600 mt-0.5">{ord.shippingAddress}</p>
                    <p className="text-slate-600">
                      {ord.city} - {ord.pincode}
                    </p>
                    <p className="text-slate-500 font-mono text-[11px] mt-1">
                      Phone: {ord.buyerPhone}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Financials & Action Buttons */}
              <div className="border-t border-slate-100 pt-3 flex flex-wrap items-center justify-between gap-3">
                {/* Financial Summary */}
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Order Subtotal
                    </span>
                    <span className="font-bold text-slate-900">
                      ₹{ord.subtotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <span className="text-slate-300">-</span>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Fee (10%)
                    </span>
                    <span className="font-semibold text-rose-600">
                      ₹{ord.commissionAmount.toFixed(1)}
                    </span>
                  </div>
                  <span className="text-slate-300">=</span>
                  <div>
                    <span className="text-emerald-700 block text-[10px] uppercase font-bold">
                      Your Payout
                    </span>
                    <span className="font-black text-emerald-700">
                      ₹{ord.payoutAmount.toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Order Status Trigger Buttons */}
                <div className="flex items-center gap-2">
                  {ord.status === 'new' && (
                    <button
                      onClick={() => void markReadyForPickup(ord.id).catch(() => undefined)}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Accept & Mark Ready</span>
                    </button>
                  )}

                  {ord.status === 'ready_for_pickup' && (
                    <div className="flex items-center gap-2">
                      {ord.pickupOtp && (
                        <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs text-blue-900">
                          <span className="text-[10px] font-bold block text-blue-700">Rider Pickup OTP</span>
                          <span className="font-mono font-bold text-sm">{ord.pickupOtp}</span>
                        </div>
                      )}
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <Truck className="h-4 w-4 text-slate-400" />
                        Waiting for the rider: show this code at pickup
                      </span>
                    </div>
                  )}

                  {ord.status === 'in_transit' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-purple-700 font-semibold bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-100">
                        Out for delivery{ord.trackingNumber ? ` · ${ord.trackingNumber}` : ''}
                      </span>
                    </div>
                  )}

                  {ord.status === 'delivered' && (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Fulfillment Complete
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Shipping Label & Invoice Modal */}
      {selectedOrderForLabel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl relative my-8">
            <button
              onClick={() => setSelectedOrderForLabel(null)}
              className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Printable Label View */}
            <div className="border-2 border-slate-900 p-5 rounded-xl text-slate-900 font-sans space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
                <div>
                  <h3 className="text-lg font-black tracking-tight uppercase">
                    Nyochavar Express
                  </h3>
                  <p className="text-[10px] font-bold text-slate-600">
                    MARKETPLACE LOGISTICS HUB
                  </p>
                </div>
                <div className="text-right">
                  <span className="rounded bg-slate-900 text-white text-xs font-bold px-2 py-0.5">
                    PREPAID (ONLINE)
                  </span>
                  <p className="text-[10px] font-mono mt-1">{selectedOrderForLabel.orderNumber}</p>
                </div>
              </div>

              {/* Barcode Mock */}
              <div className="text-center py-2 bg-slate-50 border border-slate-300 rounded-lg">
                <div className="font-mono tracking-widest text-lg font-bold">
                  ||| | ||||| |||| || |||||| | ||| |||||
                </div>
                <p className="text-[10px] font-mono text-slate-500 mt-1">
                  AWB: NYO-RDR-{selectedOrderForLabel.orderNumber.replace('ORD-', '')}
                </p>
              </div>

              {/* Shipping Addresses */}
              <div className="grid grid-cols-2 gap-4 border-b-2 border-slate-900 pb-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Ship From (Seller):
                  </span>
                  <p className="font-bold">{profile.storeName}</p>
                  <p className="text-[11px] text-slate-700">{profile.pickupAddress.street}</p>
                  <p className="text-[11px] text-slate-700">
                    {profile.pickupAddress.city}, {profile.pickupAddress.pincode}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    GSTIN: {profile.gstin}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Deliver To (Buyer):
                  </span>
                  <p className="font-bold">{selectedOrderForLabel.buyerName}</p>
                  <p className="text-[11px] text-slate-700">
                    {selectedOrderForLabel.shippingAddress}
                  </p>
                  <p className="text-[11px] font-bold text-slate-900">
                    {selectedOrderForLabel.city} - {selectedOrderForLabel.pincode}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Ph: {selectedOrderForLabel.buyerPhone}
                  </p>
                </div>
              </div>

              {/* Item Summary */}
              <div className="text-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Package Contents:
                </span>
                {selectedOrderForLabel.items.map((it, i) => (
                  <div key={i} className="flex justify-between font-medium">
                    <span>
                      {it.quantity}x {it.title}
                    </span>
                    <span className="font-bold">₹{it.price * it.quantity}</span>
                  </div>
                ))}
              </div>

              {/* Footer Declaration */}
              <div className="border-t border-slate-300 pt-2 text-[9px] text-slate-500 leading-tight">
                Authentic handcrafted gift merchandise. Handle with care. Delivered via authorized Nyochavar rider partner.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setSelectedOrderForLabel(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 shadow-sm cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
