import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Store,
  MapPin,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  Truck,
  IndianRupee,
  Check,
  Zap,
  Rocket,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { sellerCategories } from '../../data/mockSellerData';
import { BrandLogo } from '../../../components/layout/BrandLogo';
import { API_BASE_URL } from '../../../services/apiConfig';
import { setSellerToken } from '../../services/sellerApi';

export const SellerRegisterPage: React.FC = () => {
  const navigate = useNavigate();

  // 4-Step Navigation State
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form Fields (Essential & Easy)
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [category, setCategory] = useState(sellerCategories[0]);
  const [pincode, setPincode] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('Jaipur');
  const [pickupSlot, setPickupSlot] = useState('Morning (10:00 AM - 01:00 PM)');

  // Payout Choice: UPI (Fastest) vs Bank Account
  const [payoutMethod, setPayoutMethod] = useState<'upi' | 'bank'>('upi');
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  // Step Validation & Submission State
  const [stepError, setStepError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1 Validation & Next
  const handleNextStep1 = () => {
    if (!storeName.trim()) {
      setStepError('Please enter your store or brand name.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setStepError('Please enter a valid 10-digit mobile number for WhatsApp alerts.');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setStepError('Please enter a valid business email address for your seller login.');
      return;
    }
    if (!password || password.length < 6) {
      setStepError('Please enter a password with at least 6 characters.');
      return;
    }

    setStepError('');
    setCurrentStep(2);
  };

  // Step 2 Validation & Next
  const handleNextStep2 = () => {
    if (!pincode.trim() || pincode.replace(/\D/g, '').length !== 6) {
      setStepError('Please enter a valid 6-digit pickup pincode.');
      return;
    }
    if (!streetAddress.trim()) {
      setStepError('Please enter your workshop or shop street address.');
      return;
    }
    setStepError('');
    setCurrentStep(3);
  };

  // Step 3 Validation & Finish Onboarding via Real Backend
  const handleFinishOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();

    if (payoutMethod === 'upi' && !upiId.trim()) {
      setStepError('Please enter a valid UPI ID (e.g. mobile@paytm or name@okaxis).');
      return;
    }
    if (payoutMethod === 'bank' && (!accountNumber.trim() || !ifsc.trim())) {
      setStepError('Please enter both your bank account number and IFSC code.');
      return;
    }

    setStepError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/seller/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName: storeName.trim(),
          ownerName: accountHolder.trim() || storeName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.replace(/\D/g, ''),
          password,
          category,
          pincode: pincode.trim(),
          streetAddress: streetAddress.trim(),
          city: city.trim() || 'Jaipur',
          pickupSlot,
          payoutMethod,
          upiId: payoutMethod === 'upi' ? upiId.trim() : undefined,
          bankDetails: {
            accountHolder: accountHolder.trim() || storeName.trim(),
            accountNumber: payoutMethod === 'bank' ? accountNumber.trim() : undefined,
            ifsc: payoutMethod === 'bank' ? ifsc.trim().toUpperCase() : undefined,
            upiId: payoutMethod === 'upi' ? upiId.trim() : undefined,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete seller registration');
      }

      if (!data.token) throw new Error('Registration finished but we could not sign you in. Please sign in.');
      // The portal sees the new token and loads this seller's store from the server
      setSellerToken(data.token);

      setCurrentStep(4);
    } catch (err: any) {
      console.error('Seller registration error:', err);
      setStepError(err.message || 'Could not connect to backend server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step configuration
  const stepsConfig = [
    { num: 1, title: 'Store Info', desc: 'Brand & Mobile', icon: Store },
    { num: 2, title: 'Pickup Hub', desc: 'Rider Location', icon: MapPin },
    { num: 3, title: 'Payouts', desc: 'UPI / Bank', icon: CreditCard },
    { num: 4, title: 'Live Store', desc: 'Dashboard Ready', icon: Rocket }
  ];

  return (
    <div className="min-h-screen bg-slate-50/70 text-ink font-sans flex flex-col justify-between selection:bg-brand selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandLogo size="sm" />
            <span className="hidden sm:inline-block rounded-full bg-brand-soft px-2.5 py-0.5 text-[10px] font-bold text-brand uppercase tracking-wider border border-brand/20">
              Seller Hub
            </span>
          </Link>

          <Link
            to="/seller/login"
            className="text-xs font-semibold text-brand hover:text-brand-dark transition"
          >
            Already a Seller? Login
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="my-6 sm:my-10 px-4 sm:px-6 flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-2xl">
          {/* ========================================================= */}
          {/* UNIQUE SHAPED 4-STEP PROGRESS BAR (DIAMOND SQUIRCLES)     */}
          {/* ========================================================= */}
          <div className="mb-8 sm:mb-10">
            <div className="relative flex items-center justify-between px-2 sm:px-6">
              {/* Connecting Progress Track Line */}
              <div className="absolute top-1/2 left-8 right-8 -translate-y-1/2 h-1 bg-slate-200 z-0">
                <div
                  className="h-full bg-gradient-to-r from-brand to-indigo-600 transition-all duration-500 ease-out"
                  style={{
                    width: `${((currentStep - 1) / 3) * 100}%`
                  }}
                />
              </div>

              {/* 4 Distinctive Diamond-Squircle Points */}
              {stepsConfig.map((s) => {
                const Icon = s.icon;
                const isCompleted = currentStep > s.num;
                const isActive = currentStep === s.num;

                return (
                  <div key={s.num} className="relative z-10 flex flex-col items-center">
                    {/* The Diamond Squircle Point Container */}
                    <div className="relative flex items-center justify-center p-1">
                      <div
                        className={`h-10 w-10 sm:h-12 sm:w-12 rounded-2xl rotate-45 flex items-center justify-center transition-all duration-300 shadow-xs cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-tr from-brand to-indigo-600 text-white ring-4 ring-brand-soft scale-110 shadow-md shadow-brand/30'
                            : isCompleted
                            ? 'bg-emerald-500 text-white ring-2 ring-emerald-100'
                            : 'bg-white border-2 border-slate-200 text-slate-400'
                        }`}
                        onClick={() => {
                          // Allow moving back to previously completed steps
                          if (isCompleted) setCurrentStep(s.num as any);
                        }}
                      >
                        {/* Un-rotate Icon to maintain perfect horizontal orientation */}
                        <div className="-rotate-45 flex items-center justify-center">
                          {isCompleted ? (
                            <Check className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]" />
                          ) : (
                            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                          )}
                        </div>
                      </div>

                      {/* Small Pulse Ring for the Active Step */}
                      {isActive && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-brand" />
                        </span>
                      )}
                    </div>

                    {/* Step Title Label */}
                    <div className="text-center mt-3">
                      <p
                        className={`text-xs font-bold transition ${
                          isActive
                            ? 'text-brand'
                            : isCompleted
                            ? 'text-emerald-700 font-semibold'
                            : 'text-slate-400'
                        }`}
                      >
                        {s.title}
                      </p>
                      <p className="hidden sm:block text-[10px] text-slate-400 mt-0.5">
                        {s.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Validation Error Banner */}
          {stepError && (
            <div className="mb-4 rounded-2xl bg-rose-50 border border-rose-200/80 p-3 text-xs font-semibold text-rose-700 text-center animate-shake">
              ⚠️ {stepError}
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 1: STORE & CONTACT DETAILS                           */}
          {/* ========================================================= */}
          {currentStep === 1 && (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-card">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand mb-1">
                <Store className="h-4 w-4" />
                <span>Step 1 of 4 • Basic Shop Profile</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-ink">
                Your Store & Contact Info
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                This name and category will be featured on your Nyochavar storefront.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Store / Brand Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Royal Artisans Jaipur, Sweet Delights, Kraft Hampers..."
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-medium focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      WhatsApp Mobile Number *
                    </label>
                    <div className="relative">
                      <span className="absolute top-3 left-3 text-xs font-bold text-slate-400 select-none">
                        +91
                      </span>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        placeholder="98290 12345"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                        className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-xs font-medium focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft transition"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Order notifications & pickup OTPs will be sent here
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Primary Gift Category *
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-3.5 py-3 text-xs font-medium focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft transition bg-white"
                    >
                      {sellerCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Business Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="contact@yourstore.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-medium focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft transition"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Used to sign in to your Seller Dashboard & invoices
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Create Login Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 py-3 pl-4 pr-10 text-xs font-medium focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Secure password to protect your store
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-brand/20 bg-brand-soft/60 p-3.5 flex items-center gap-2.5 text-xs text-brand font-medium">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-brand" />
                  <span>
                    No GST or business registration required to start selling on Nyochavar.
                  </span>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  onClick={handleNextStep1}
                  className="flex items-center gap-2 rounded-full bg-brand px-7 py-3 text-xs font-bold text-white shadow-md shadow-brand/20 hover:bg-brand-dark transition active:scale-95 cursor-pointer"
                >
                  <span>Continue to Pickup Hub</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 2: PICKUP LOCATION (WHERE RIDERS COLLECT HAMPERS)    */}
          {/* ========================================================= */}
          {currentStep === 2 && (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-card">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand mb-1">
                <MapPin className="h-4 w-4" />
                <span>Step 2 of 4 • Logistics & Handover</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-ink">
                Workshop & Pickup Address
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Nyochavar delivery riders will collect packed gift hampers directly from this location.
              </p>

              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pickup Pincode *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="302002"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-medium focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft transition font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Jaipur, Rajasthan"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-medium focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Street Address / Workshop Location *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Plot 42, Hawa Mahal Marg, Pink City"
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-medium focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Preferred Daily Rider Pickup Slot
                  </label>
                  <select
                    value={pickupSlot}
                    onChange={(e) => setPickupSlot(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-medium focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft transition bg-white"
                  >
                    <option>Morning (10:00 AM - 01:00 PM)</option>
                    <option>Afternoon (01:00 PM - 04:00 PM)</option>
                    <option>Evening (04:00 PM - 07:00 PM)</option>
                  </select>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 flex items-center gap-2.5 text-xs text-emerald-900 font-medium">
                  <Truck className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    Riders scan your packed box barcode with automated OTP confirmation on every handover.
                  </span>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextStep2}
                  className="flex items-center gap-2 rounded-full bg-brand px-7 py-3 text-xs font-bold text-white shadow-md shadow-brand/20 hover:bg-brand-dark transition active:scale-95 cursor-pointer"
                >
                  <span>Continue to Payouts</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3: PAYOUT METHOD (FAST UPI OR BANK ACCOUNT)          */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-card">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand mb-1">
                    <CreditCard className="h-4 w-4" />
                    <span>Step 3 of 4 • Earnings & Payouts</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-ink">
                    Weekly Payout Details
                  </h2>
                </div>

                {/* Fast Mode Toggle */}
                <div className="flex rounded-full bg-slate-100 p-0.5 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setPayoutMethod('upi')}
                    className={`rounded-full px-3.5 py-1.5 transition cursor-pointer ${
                      payoutMethod === 'upi'
                        ? 'bg-brand text-white shadow-xs'
                        : 'text-slate-600 hover:text-ink'
                    }`}
                  >
                    ⚡ UPI ID (Fast)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutMethod('bank')}
                    className={`rounded-full px-3.5 py-1.5 transition cursor-pointer ${
                      payoutMethod === 'bank'
                        ? 'bg-brand text-white shadow-xs'
                        : 'text-slate-600 hover:text-ink'
                    }`}
                  >
                    🏦 Bank Account
                  </button>
                </div>
              </div>

              <form onSubmit={handleFinishOnboarding} className="space-y-4">
                {payoutMethod === 'upi' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Your UPI ID (VPA) *
                    </label>
                    <input
                      type="text"
                      required={payoutMethod === 'upi'}
                      placeholder="e.g. 9876543210@paytm, name@okhdfcbank, shop@upi"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value.toLowerCase())}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-medium font-mono focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft transition"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Delivered order earnings are transferred directly to this UPI ID every Wednesday
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Bank Account Holder Name
                      </label>
                      <input
                        type="text"
                        placeholder="Name as printed on passbook"
                        value={accountHolder}
                        onChange={(e) => setAccountHolder(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-medium focus:border-brand focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Account Number *
                        </label>
                        <input
                          type="password"
                          required={payoutMethod === 'bank'}
                          placeholder="•••• •••• •••• 8842"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-medium focus:border-brand focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          IFSC Code *
                        </label>
                        <input
                          type="text"
                          required={payoutMethod === 'bank'}
                          placeholder="HDFC0001234"
                          value={ifsc}
                          onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-medium uppercase font-mono focus:border-brand focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-brand/20 bg-brand-soft/60 p-4 text-xs text-brand flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="h-4 w-4 text-brand shrink-0" />
                    <span>Weekly Wednesday Settlement Cycle • Direct Bank Credit</span>
                  </div>
                  <span className="font-bold text-brand-dark">Flat 10% Fee</span>
                </div>

                <div className="mt-8 flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 rounded-full bg-emerald-600 px-8 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Registering Store...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Complete & Launch Store 🚀</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 4: INSTANT STORE ACTIVATION CELEBRATION              */}
          {/* ========================================================= */}
          {currentStep === 4 && (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 text-center shadow-card animate-fade-in">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl rotate-45 bg-emerald-100 text-emerald-600 mb-6 shadow-sm">
                <CheckCircle2 className="-rotate-45 h-8 w-8" />
              </div>

              <span className="rounded-full bg-brand-soft px-3.5 py-1 text-xs font-bold text-brand border border-brand/20">
                Shop Verified & Ready!
              </span>

              <h2 className="text-2xl sm:text-3xl font-black text-ink mt-3">
                Welcome to Nyochavar, {storeName}!
              </h2>

              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto mt-2 leading-relaxed">
                Your seller store is now active. You can list your luxury hampers, manage daily orders, and track your weekly payouts.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => navigate('/seller/dashboard')}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-full bg-brand px-8 py-3 text-xs font-bold text-white shadow-md shadow-brand/25 hover:bg-brand-dark transition cursor-pointer"
                >
                  <Store className="h-4 w-4" />
                  <span>Open Seller Dashboard</span>
                </button>

                <button
                  onClick={() => navigate('/seller/products/new')}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-6 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <span>+ List Your First Product</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 py-4 text-center text-xs text-slate-500 bg-white">
        © {new Date().getFullYear()} Nyochavar Multi-vendor Marketplace. All seller policies strictly protected.
      </footer>
    </div>
  );
};
