import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { IMAGE_ASSETS } from '../../utils/imageAssets';

const DISMISS_KEY = 'petal_pen_profile_banner_dismissed';
const SHOW_DELAY_MS = 10000;

const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

export const ProfileCompletionBanner: React.FC = () => {
  const { loggedInUser } = useAuth();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [visible, setVisible] = useState(false);

  const isProfileComplete = Boolean(loggedInUser?.phone && (loggedInUser.address_line || loggedInUser.addresses?.length));
  const isOpen = visible && !dismissed && !isProfileComplete;

  useEffect(() => {
    if (dismissed) return;
    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [dismissed]);

  // Freeze page scroll while the popup is open
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage unavailable: banner just hides for this session */
    }
    setDismissed(true);
  };

  const isGuest = !loggedInUser;
  const title = isGuest ? 'Create an account, get 50% off!' : 'Complete your profile, get a discount!';
  const description = isGuest
    ? 'Log in and get an exclusive 50% discount on your first order, plus track all your orders in one place.'
    : 'Add your phone number and delivery address to unlock an exclusive discount on your next order.';
  const ctaLabel = isGuest ? 'Login / Sign up' : 'Complete your profile';
  const ctaTo = isGuest ? '/auth' : '/profile';

  const copy = (
    <>
      <h3 className="font-serif text-xl font-semibold text-ink sm:text-2xl lg:text-3xl">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600 lg:text-base">{description}</p>
      <Link
        to={ctaTo}
        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 text-base font-semibold text-white transition-colors duration-200 hover:bg-brand-dark md:w-auto"
      >
        {ctaLabel}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) handleDismiss();
      }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm sm:p-6"
    >
      <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-brand/20 bg-white shadow-2xl">
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close banner"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-red-600 shadow ring-1 ring-red-200 transition-colors hover:bg-red-50"
        >
          <X className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        </button>

        {/* Mobile: image on top, text + button sit in its empty bottom area */}
        <div className="md:hidden">
          <img
            src={IMAGE_ASSETS.profileBannerMobile}
            alt=""
            decoding="async"
            className="block h-auto w-full"
          />
          <div className="relative -mt-10 bg-gradient-to-b from-transparent to-[#eef4ff] px-5 pb-5 pt-14">
            {copy}
          </div>
        </div>

        {/* Desktop: image fills the card, text + button sit in its empty right side */}
        <div className="relative hidden aspect-[16/5] md:block">
          <img
            src={IMAGE_ASSETS.profileBannerDesktop}
            alt=""
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-y-0 left-[54%] right-8 flex flex-col justify-center lg:right-12">
            {copy}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletionBanner;
