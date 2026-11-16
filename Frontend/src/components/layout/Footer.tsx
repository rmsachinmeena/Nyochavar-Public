import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Banknote, CheckCircle2, CreditCard, Loader2, PenLine, ShieldCheck, Smartphone, Truck } from 'lucide-react';
import { useUI } from '../../context';
import { occasionHref } from '../../utils/occasionUtils';
import { BrandLogo } from './BrandLogo';
import { api } from '../../services/api';

const SHOP_LINKS = [
  { label: 'All gifts', to: '/catalog' },
  { label: 'Flowers', to: '/catalog?category=Flowers' },
  { label: 'Hampers', to: '/catalog?category=Hampers' },
  { label: 'Personalized gifts', to: `/catalog?category=${encodeURIComponent('Personalized Gifts')}` },
  { label: 'Build a hamper', to: '/builder' },
];

const OCCASION_LINKS = ['Birthday', 'Anniversary', 'Wedding', 'Diwali', 'Raksha Bandhan'].map((name) => ({
  label: name,
  to: occasionHref(name),
}));

const PAYMENT_METHODS = [
  { icon: Smartphone, label: 'UPI' },
  { icon: CreditCard, label: 'Credit & debit cards' },
  { icon: Banknote, label: 'Cash on delivery' },
];

const HEADING = 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400';
const LINK = 'text-sm text-slate-600 transition-colors hover:text-ink';

export const Footer: React.FC = () => {
  const { setIsCartDrawerOpen, setIsFavoritesModalOpen, showToast } = useUI();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubscribe = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      showToast({
        title: 'Valid Email Required',
        description: 'Please enter a valid email address to subscribe.'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.subscribeNewsletter(cleanEmail);
      if (res && res.success) {
        setSubscribed(true);
        setEmail('');
        showToast({
          title: 'Subscribed Successfully! 🎉',
          description: 'Welcome to The Nyochavar Club. Check your inbox for updates.'
        });
      } else {
        showToast({
          title: 'Subscription Failed',
          description: res?.message || 'Could not complete subscription. Please try again.'
        });
      }
    } catch (err: any) {
      console.error('Newsletter subscribe error:', err);
      showToast({
        title: 'Subscription Error',
        description: err.message || 'Server error. Please try again later.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="border-t border-slate-200/70 bg-slate-50">
      <div className="mx-auto max-w-7xl px-5 pt-12 sm:px-6 sm:pt-16 lg:px-8">

        <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-12 sm:py-14 md:grid-cols-4 lg:grid-cols-12">
          <div className="col-span-2 md:col-span-4 lg:col-span-4">
            <BrandLogo tagline="always" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-500">
              Bespoke flowers, artisanal hampers and personalized keepsakes — finished with a handwritten note and
              delivered with care.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-slate-600">
              <li className="flex items-center gap-2.5">
                <Truck className="h-4 w-4 text-brand" /> Same-day metro delivery
              </li>
              <li className="flex items-center gap-2.5">
                <PenLine className="h-4 w-4 text-brand" /> Free handwritten note
              </li>
              <li className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-brand" /> 100% delight assurance
              </li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h3 className={HEADING}>Shop</h3>
            <ul className="mt-4 space-y-3">
              {SHOP_LINKS.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className={LINK}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h3 className={HEADING}>Occasions</h3>
            <ul className="mt-4 space-y-3">
              {OCCASION_LINKS.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className={LINK}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h3 className={HEADING}>Your account</h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link to="/profile" className={LINK}>
                  My account
                </Link>
              </li>
              <li>
                <Link to="/profile?tab=orders" className={LINK}>
                  My orders
                </Link>
              </li>
              <li>
                <button type="button" onClick={() => setIsFavoritesModalOpen(true)} className={LINK}>
                  Wishlist
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setIsCartDrawerOpen(true)} className={LINK}>
                  Cart
                </button>
              </li>
              <li>
                <Link to="/seller" className={`${LINK} text-brand font-semibold hover:text-brand-dark`}>
                  Become a Seller ✨
                </Link>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h3 className={HEADING}>Ways to pay</h3>
            <ul className="mt-4 space-y-3">
              {PAYMENT_METHODS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2.5 text-sm text-slate-600">
                  <Icon className="h-4 w-4 text-slate-400" /> {label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Nyochavar · Demo portfolio project. All rights reserved.</p>
          <p className="flex flex-wrap gap-x-5 gap-y-1">
            <Link to="/privacy-policy" className="transition-colors hover:text-ink">
              Privacy policy
            </Link>
            <Link to="/terms" className="transition-colors hover:text-ink">
              Terms of service
            </Link>
            <Link to="/refund-policy" className="transition-colors hover:text-ink">
              Refunds &amp; cancellation
            </Link>
            <Link to="/shipping-policy" className="transition-colors hover:text-ink">
              Shipping
            </Link>
            <Link to="/contact" className="transition-colors hover:text-ink">
              Contact
            </Link>
            <span>Delivery coverage</span>
          </p>
        </div>
      </div>
    </footer>
  );
};
