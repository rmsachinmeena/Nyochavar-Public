import { conciergeWhatsAppLink } from "../../../config/contact";
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, CreditCard, Gift, LogIn, MapPin, MessageCircle, ShieldCheck, Sparkles, Store, TrendingUp, Truck } from 'lucide-react';
import { BrandLogo } from '../../../components/layout/BrandLogo';
import { Footer } from '../../../components/layout/Footer';

export const SellerLandingPage: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink font-body selection:bg-brand selection:text-white">
      {/* Top Navbar (100% responsive, clean blue+white theme, never wraps on mobile) */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/" aria-label="Nyochavar home" className="shrink-0">
              <BrandLogo size="md" />
            </Link>
            <span className="hidden sm:inline-block rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand border border-brand/20">
              Seller Hub
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <Link
              to="/"
              className="text-xs font-semibold text-slate-600 hover:text-ink transition hidden md:inline px-2 py-1"
            >
              Back to Store
            </Link>
            <a
              href={conciergeWhatsAppLink("Hi Nyochavar, I have questions about selling on your platform.")}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-slate-600 hover:text-brand transition hidden md:inline px-2 py-1"
            >
              Contact Support
            </a>
            <Link
              to="/seller/login"
              className="group flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/70 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold text-brand shadow-xs transition-all hover:border-brand hover:bg-brand hover:text-white active:scale-95 whitespace-nowrap"
            >
              <LogIn className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-brand group-hover:text-white transition-colors" />
              <span>Seller Login</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Single-Screen Hero Showcase (Zomato-style compact layout with floating gifts and cascading stat cards) */}
      <main className="relative flex flex-1 flex-col justify-center overflow-hidden bg-white py-5 sm:py-8 lg:py-10">
        {/* Background Decorative Swirl Lines (Subtle curved doodle lines connecting the elements like Zomato) */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-60 sm:opacity-80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 850"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M 60 720 C 140 480, 240 320, 320 280 C 440 220, 600 130, 760 160 C 940 190, 1140 280, 1260 190 C 1340 130, 1400 180, 1380 320 C 1350 520, 1200 600, 1220 740"
            stroke="rgba(0, 82, 255, 0.12)"
            strokeWidth="1.5"
            strokeDasharray="5 7"
            strokeLinecap="round"
          />
          <path
            d="M 180 520 C 320 620, 520 680, 720 650 C 940 620, 1120 500, 1260 440"
            stroke="rgba(226, 232, 240, 0.9)"
            strokeWidth="1.2"
            strokeDasharray="4 6"
            strokeLinecap="round"
          />
        </svg>

        {/* Small Ambient Floating Accents (like Zomato's tomato slices & basil) */}
        <motion.div
          animate={{ y: [0, -5, 0], rotate: [0, 12, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute left-[4%] top-[12%] sm:left-[10%] sm:top-[14%] z-10"
        >
          <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-rose-500/80 shadow-md ring-4 ring-rose-100 flex items-center justify-center text-[10px] text-white font-bold">
            ✦
          </div>
        </motion.div>

        <motion.div
          animate={{ y: [0, 6, 0], rotate: [0, -10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
          className="pointer-events-none absolute right-[12%] top-[30%] sm:right-[16%] sm:top-[28%] z-10"
        >
          <div className="h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-brand/80 shadow-md ring-3 ring-blue-100 flex items-center justify-center text-[9px] text-white font-bold">
            ★
          </div>
        </motion.div>

        {/* Floating Gifting Item 1: LEFT — Curated Luxury Hamper (Like Zomato's Burger, positioned cleanly without text overlap) */}
        <motion.div
          animate={{ y: [0, -8, 0], rotate: [-6, -3, -6] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute left-2 sm:left-4 lg:left-10 top-[11%] sm:top-[13%] lg:top-[16%] w-14 sm:w-20 lg:w-36 z-20"
        >
          <div className="relative rounded-2xl sm:rounded-3xl bg-white p-1 sm:p-2 shadow-[0_14px_30px_-6px_rgba(15,23,42,0.18)] border border-slate-100 ring-2 ring-white/80">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl sm:rounded-2xl bg-slate-50">
              <img
                src="https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=800&auto=format&fit=crop&q=80"
                alt="Luxury Gourmet Hamper"
                className="h-full w-full object-cover object-center"
                loading="eager"
              />
            </div>
            <div className="mt-1.5 hidden lg:flex items-center justify-between px-1">
              <p className="text-[11px] font-bold text-ink">Gourmet Hamper</p>
              <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600 border border-emerald-200/60">
                Top Seller
              </span>
            </div>
          </div>
        </motion.div>

        {/* Floating Gifting Item 2: TOP RIGHT — Fresh Floral Bouquet (Like Zomato's Dim Sums) */}
        <motion.div
          animate={{ y: [0, 8, 0], rotate: [8, 12, 8] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          className="pointer-events-none absolute right-2 sm:right-4 lg:right-10 top-[4%] sm:top-[5%] lg:top-[6%] w-14 sm:w-20 lg:w-36 z-20"
        >
          <div className="relative rounded-2xl sm:rounded-3xl bg-white p-1 sm:p-2 shadow-[0_14px_30px_-6px_rgba(15,23,42,0.18)] border border-slate-100 ring-2 ring-white/80">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl sm:rounded-2xl bg-slate-50">
              <img
                src="https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=800&auto=format&fit=crop&q=80"
                alt="Fresh Artisan Blooms"
                className="h-full w-full object-cover object-center"
                loading="eager"
              />
            </div>
            <div className="mt-1.5 hidden lg:flex items-center justify-between px-1">
              <p className="text-[11px] font-bold text-ink">Fresh Blooms</p>
              <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[8px] font-bold text-brand border border-brand/20">
                Florists
              </span>
            </div>
          </div>
        </motion.div>

        {/* Floating Gifting Item 3: MID-RIGHT — Bespoke Gift Box (Like Zomato's Pizza Slice, positioned clearly above cards) */}
        <motion.div
          animate={{ y: [0, -6, 0], rotate: [-4, -1, -4] }}
          transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="pointer-events-none absolute right-2 sm:right-4 lg:right-10 top-[22%] sm:top-[24%] lg:top-[26%] w-13 sm:w-18 lg:w-32 z-20"
        >
          <div className="relative rounded-2xl sm:rounded-3xl bg-white p-1 sm:p-2 shadow-[0_14px_30px_-6px_rgba(15,23,42,0.18)] border border-slate-100 ring-2 ring-white/80">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl sm:rounded-2xl bg-slate-50">
              <img
                src="https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=800&auto=format&fit=crop&q=80"
                alt="Personalized Keepsake Box"
                className="h-full w-full object-cover object-center"
                loading="eager"
              />
            </div>
            <div className="mt-1.5 hidden lg:flex items-center justify-between px-1">
              <p className="text-[11px] font-bold text-ink">Bespoke Boxes</p>
              <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[8px] font-bold text-rose-600 border border-rose-200/60">
                Custom
              </span>
            </div>
          </div>
        </motion.div>

        {/* Central Content (Generous side padding on mobile so text NEVER covers floating gifts) */}
        <div className="relative z-10 mx-auto max-w-xl px-8 sm:px-6 text-center">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand-soft px-3 py-1 text-[11px] font-semibold text-brand mb-2 sm:mb-3 shadow-2xs">
            <Sparkles className="h-3 w-3 text-brand" />
            <span>Join 2,500+ Top Curators & Artisans</span>
          </div>

          {/* Central Bold Heading */}
          <h1 className="font-sans text-[1.75rem] sm:text-5xl lg:text-[3.6rem] font-extrabold tracking-tight text-ink leading-[1.12]">
            <span className="bg-gradient-to-r from-brand to-blue-600 bg-clip-text text-transparent">
              Better gifts for
            </span>
            <br />
            <span className="text-ink">more people</span>
          </h1>

          {/* Subtext (Width-constrained on mobile with zero risk of overlapping side images) */}
          <p className="mt-2.5 sm:mt-3 text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed font-normal max-w-[270px] sm:max-w-md mx-auto">
            Sell your luxury hampers, fresh flowers, and bespoke gifts to lakhs of festive shoppers across India with automated doorstep delivery & instant payouts.
          </p>

          {/* Action Buttons (Compact side-by-side row) */}
          <div className="mt-4 sm:mt-5 flex flex-row items-center justify-center gap-2 sm:gap-3">
            <Link
              to="/seller/register"
              className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-brand/20 transition-all hover:bg-brand-dark hover:shadow-lg hover:shadow-brand/30 active:scale-95 whitespace-nowrap"
            >
              <span>Register as a Seller</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            <a
              href={conciergeWhatsAppLink("Hi Nyochavar Team, I want to learn more about partnering and growing my gifting business on your platform.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs transition-all hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-700 whitespace-nowrap"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
              <span>Connect with Us</span>
            </a>
          </div>

          {/* Zomato-Style 3 Cascading Floating Overlapping Metric Cards */}
          <div className="mt-5 sm:mt-6 w-full max-w-[320px] sm:max-w-[370px] mx-auto flex flex-col items-center">
            {/* Card 1: Curators & Artisans (Shifted Left) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              whileHover={{ scale: 1.02, y: -2 }}
              className="w-[82%] self-start rounded-2xl bg-white p-2.5 sm:p-3 shadow-[0_12px_28px_-8px_rgba(15,23,42,0.12)] border border-slate-100/90 flex items-center justify-between gap-3 z-10 transition-shadow hover:shadow-[0_16px_32px_-8px_rgba(15,23,42,0.18)]"
            >
              <div className="text-left">
                <div className="text-lg sm:text-xl font-extrabold text-ink tracking-tight leading-none">
                  2,500+
                </div>
                <div className="mt-1 text-[11px] font-medium text-slate-500">
                  curators & artisans
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 border border-blue-100/80 shrink-0 text-brand shadow-2xs">
                <Store className="h-5 w-5 text-brand" />
              </div>
            </motion.div>

            {/* Card 2: Cities Covered (Shifted Right, Overlapping Card 1, slightly tilted like Zomato) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              whileHover={{ scale: 1.02, y: -2 }}
              className="w-[72%] self-end -mt-3.5 sm:-mt-4 rounded-2xl bg-white p-2.5 sm:p-3 shadow-[0_14px_30px_-6px_rgba(15,23,42,0.15)] border border-slate-100/90 flex items-center justify-between gap-3 z-20 rotate-[2.5deg] hover:rotate-0 transition-transform"
            >
              <div className="text-left">
                <div className="text-lg sm:text-xl font-extrabold text-ink tracking-tight leading-none">
                  100+
                </div>
                <div className="mt-1 text-[11px] font-medium text-slate-500">
                  cities pan-India
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 border border-rose-100/80 shrink-0 text-rose-500 shadow-2xs">
                <MapPin className="h-5 w-5 text-rose-500 fill-rose-500/20" />
              </div>
            </motion.div>

            {/* Card 3: Orders Delivered (Shifted Left, Overlapping Card 2) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              whileHover={{ scale: 1.02, y: -2 }}
              className="w-[82%] self-start ml-2 sm:ml-4 -mt-3.5 sm:-mt-4 rounded-2xl bg-white p-2.5 sm:p-3 shadow-[0_12px_28px_-8px_rgba(15,23,42,0.12)] border border-slate-100/90 flex items-center justify-between gap-3 z-10 -rotate-[1deg] hover:rotate-0 transition-transform"
            >
              <div className="text-left">
                <div className="text-lg sm:text-xl font-extrabold text-ink tracking-tight leading-none">
                  10 Lakh+
                </div>
                <div className="mt-1 text-[11px] font-medium text-slate-500">
                  gifts delivered
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100/80 shrink-0 text-emerald-600 shadow-2xs">
                <Gift className="h-5 w-5 text-emerald-600" />
              </div>
            </motion.div>
          </div>

          {/* Seller Growth SaaS Highlights (Compact Bento Micro-Cards) */}
          <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2 max-w-md sm:max-w-xl mx-auto w-full text-left">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/70 bg-slate-50/80 px-2.5 py-1.5 transition hover:bg-white hover:border-brand/30">
              <TrendingUp className="h-3.5 w-3.5 shrink-0 text-brand" />
              <div>
                <p className="text-[11px] font-bold text-ink leading-tight">3x Reach</p>
                <p className="text-[9px] text-slate-500 leading-tight">Pan-India buyers</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/70 bg-slate-50/80 px-2.5 py-1.5 transition hover:bg-white hover:border-brand/30">
              <Truck className="h-3.5 w-3.5 shrink-0 text-brand" />
              <div>
                <p className="text-[11px] font-bold text-ink leading-tight">Doorstep Pickup</p>
                <p className="text-[9px] text-slate-500 leading-tight">Zero shipping hassle</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/70 bg-slate-50/80 px-2.5 py-1.5 transition hover:bg-white hover:border-brand/30">
              <CreditCard className="h-3.5 w-3.5 shrink-0 text-brand" />
              <div>
                <p className="text-[11px] font-bold text-ink leading-tight">Weekly Payouts</p>
                <p className="text-[9px] text-slate-500 leading-tight">0% setup fee</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/70 bg-slate-50/80 px-2.5 py-1.5 transition hover:bg-white hover:border-brand/30">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand" />
              <div>
                <p className="text-[11px] font-bold text-ink leading-tight">Smart SaaS</p>
                <p className="text-[9px] text-slate-500 leading-tight">Live inventory & alerts</p>
              </div>
            </div>
          </div>

          {/* Quick Helper / WhatsApp Concierge Subtext */}
          <p className="mt-3 text-[11px] sm:text-xs text-slate-500">
            Questions?{' '}
            <a
              href={conciergeWhatsAppLink("Hi Nyochavar Team, I have questions about selling on your platform.")}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand hover:underline inline-flex items-center gap-1"
            >
              WhatsApp Concierge: +91 94621 04733
              <ArrowRight className="h-3 w-3" />
            </a>
          </p>
        </div>
      </main>

      {/* Footer (Immediately following the 1-page landing view) */}
      <Footer />
    </div>
  );
};

export default SellerLandingPage;
