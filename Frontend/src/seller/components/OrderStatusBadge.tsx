import React from 'react';
import { SellerOrder } from '../data/mockSellerData';

interface OrderStatusBadgeProps {
  status: SellerOrder['status'];
  size?: 'sm' | 'md';
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status, size = 'md' }) => {
  const config: Record<
    SellerOrder['status'],
    { label: string; bg: string; text: string; dot: string; pulse?: boolean }
  > = {
    new: {
      label: 'New Order',
      bg: 'bg-amber-50 border-amber-200/70',
      text: 'text-amber-800',
      dot: 'bg-amber-500',
      pulse: true
    },
    ready_for_pickup: {
      label: 'Ready for Pickup',
      bg: 'bg-blue-50 border-blue-200/70',
      text: 'text-blue-800',
      dot: 'bg-blue-500'
    },
    in_transit: {
      label: 'With Rider / In Transit',
      bg: 'bg-purple-50 border-purple-200/70',
      text: 'text-purple-800',
      dot: 'bg-purple-500'
    },
    delivered: {
      label: 'Delivered',
      bg: 'bg-emerald-50 border-emerald-200/70',
      text: 'text-emerald-800',
      dot: 'bg-emerald-500'
    },
    cancelled: {
      label: 'Cancelled',
      bg: 'bg-rose-50 border-rose-200/70',
      text: 'text-rose-700',
      dot: 'bg-rose-500'
    }
  };

  const item = config[status] || config.new;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${item.bg} ${item.text} ${padding} shadow-xs font-semibold`}
    >
      <span className="relative flex h-2 w-2">
        {item.pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${item.dot}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${item.dot}`} />
      </span>
      {item.label}
    </span>
  );
};
