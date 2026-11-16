import React, { useState } from 'react';
import {
  Store,
  ShieldCheck,
  MapPin,
  CreditCard,
  Palmtree,
  Save,
  CheckCircle2,
  Building2,
  Phone,
  Mail,
  LogOut,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useSeller } from '../../context/SellerContext';

export const SellerSettingsPage: React.FC = () => {
  const { profile, updateProfile, toggleVacationMode, logout } = useSeller();

  const [storeName, setStoreName] = useState(profile.storeName);
  const [ownerName, setOwnerName] = useState(profile.ownerName);
  const [bio, setBio] = useState(profile.bio || '');
  const [street, setStreet] = useState(profile.pickupAddress.street);
  const [city, setCity] = useState(profile.pickupAddress.city);
  const [pincode, setPincode] = useState(profile.pickupAddress.pincode);
  const [pickupSlot, setPickupSlot] = useState(profile.pickupAddress.pickupSlot);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setIsSaving(true);
    try {
      // The mobile number and email are the seller's login, so they are not changed here
      await updateProfile({
        storeName,
        ownerName,
        bio,
        pickupAddress: {
          ...profile.pickupAddress,
          street,
          city,
          pincode,
          pickupSlot
        }
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save your settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Shop Settings & Verification
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your store identity, pickup logistics, and KYC verification status.
          </p>
        </div>

        {saveError && (
          <span className="flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700">
            <AlertCircle className="h-4 w-4" />
            {saveError}
          </span>
        )}

        {savedSuccess && (
          <span className="flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Changes Saved Successfully!
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Vacation Mode Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600">
              <Palmtree className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Vacation Mode / Pause Store</h3>
              <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
                Going on holiday or restocking workshop? Turn on Vacation Mode to temporarily pause buyer orders without affecting your store rating.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void toggleVacationMode().catch(() => undefined)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              profile.isVacationMode ? 'bg-amber-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                profile.isVacationMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Store Profile & Branding */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Store Identity & Bio
              </h2>
            </div>
            {profile.kycStatus === 'verified' && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                Verified Merchant
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Store Name</label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Owner / Representative Name
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number (your login)</label>
              <input
                type="tel"
                value={profile.phone}
                readOnly
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address (your login)</label>
              <input
                type="email"
                value={profile.email}
                readOnly
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Store Bio / Story (Shown to Buyers)
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-xs font-medium focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Pickup Logistics Settings */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <MapPin className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Warehouse Pickup Address
            </h2>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Workshop / Shop Street Address
            </label>
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pincode</label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pickup Slot</label>
              <select
                value={pickupSlot}
                onChange={(e) => setPickupSlot(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium focus:border-blue-600 focus:outline-none bg-white"
              >
                <option>Morning (10:00 AM - 01:00 PM)</option>
                <option>Afternoon (01:00 PM - 04:00 PM)</option>
                <option>Evening (04:00 PM - 07:00 PM)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 rounded-xl border border-rose-200 px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-brand-dark transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
