import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SellerStatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  icon: LucideIcon;
  colorScheme?: 'brand' | 'emerald' | 'amber' | 'purple';
}

export const SellerStatsCard: React.FC<SellerStatsCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  colorScheme = 'brand'
}) => {
  const colorMap = {
    brand: {
      bg: 'bg-brand-soft',
      iconBg: 'bg-brand',
      text: 'text-brand',
      ring: 'border-brand/20'
    },
    emerald: {
      bg: 'bg-emerald-50',
      iconBg: 'bg-emerald-600',
      text: 'text-emerald-600',
      ring: 'border-emerald-100'
    },
    amber: {
      bg: 'bg-amber-50',
      iconBg: 'bg-amber-600',
      text: 'text-amber-600',
      ring: 'border-amber-100'
    },
    purple: {
      bg: 'bg-purple-50',
      iconBg: 'bg-purple-600',
      text: 'text-purple-600',
      ring: 'border-purple-100'
    }
  };

  const scheme = colorMap[colorScheme];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${scheme.iconBg} text-white shadow-xs`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-ink">{value}</span>
        {trend && (
          <span
            className={`inline-flex items-center text-xs font-semibold ${
              trend.isPositive ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>

      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
};
