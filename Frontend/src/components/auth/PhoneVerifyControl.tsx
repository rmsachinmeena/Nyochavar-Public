import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { PhoneVerificationModal } from './PhoneVerificationModal';
import { phoneAuthClient } from '../../services/phoneAuthClient';
import { useAuth } from '../../context';

const last10 = (value: string) => String(value || '').replace(/\D/g, '').slice(-10);

export interface PhoneVerificationState {
  /** True when verification is switched off by the shop, or this number is already verified. */
  verified: boolean;
  /** Verification is switched on, so a number must be verified before it is used. */
  required: boolean;
  markVerified: (phone: string) => void;
}

/**
 * Tracks whether a phone number is verified. A number counts as verified when verification is switched off,
 * when the server already knows it (the account's own number or one verified recently), or right after the shopper verifies it here.
 * If the settings or the check cannot be loaded, the shopper is not blocked.
 */
export const usePhoneVerification = (phone: string): PhoneVerificationState => {
  const { loggedInUser } = useAuth();
  const digits = last10(phone);
  const userPhone = last10(loggedInUser?.phone || '');
  const isUserOwnVerifiedPhone = Boolean(
    digits && userPhone && digits === userPhone && loggedInUser?.is_phone_verified
  );

  const [required, setRequired] = useState(false);
  const [verifiedNumbers, setVerifiedNumbers] = useState<string[]>(() =>
    isUserOwnVerifiedPhone && digits ? [digits] : []
  );

  useEffect(() => {
    if (isUserOwnVerifiedPhone && digits && !verifiedNumbers.includes(digits)) {
      setVerifiedNumbers((prev) => (prev.includes(digits) ? prev : [...prev, digits]));
    }
  }, [isUserOwnVerifiedPhone, digits]);

  useEffect(() => {
    let alive = true;
    phoneAuthClient
      .getSettings()
      .then((settings) => alive && setRequired(settings.activeProvider !== 'disabled'))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!required || digits.length !== 10 || verifiedNumbers.includes(digits)) return;
    let alive = true;
    phoneAuthClient
      .isVerified(digits)
      .then((ok) => alive && ok && setVerifiedNumbers((prev) => (prev.includes(digits) ? prev : [...prev, digits])))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [required, digits, verifiedNumbers]);

  const markVerified = useCallback((value: string) => {
    const verifiedDigits = last10(value);
    setVerifiedNumbers((prev) => (prev.includes(verifiedDigits) ? prev : [...prev, verifiedDigits]));
  }, []);

  return { required, verified: !required || verifiedNumbers.includes(digits), markVerified };
};

/** Shown on a verified number that is fixed: only the rest of the address can be edited. */
export const LockedPhoneTag: React.FC = () => (
  <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700">
    <Lock className="h-3.5 w-3.5" /> Verified
  </span>
);

interface PhoneVerifyControlProps {
  phone: string;
  verification: PhoneVerificationState;
  /** false for a number that is not the shopper's own (a gift recipient or a saved address) */
  saveToAccount?: boolean;
  /** Called after the shopper verifies a number here */
  onVerified?: (phone: string) => void;
  /** Element id of the button, so a form can shake it when the shopper goes on without verifying */
  id?: string;
  /** The shopper went on without verifying: the button turns red */
  invalid?: boolean;
}

/** A highlighted "Verify" button for a phone field (a green "Verified" tag once done) with the OTP popup behind it. */
export const PhoneVerifyControl: React.FC<PhoneVerifyControlProps> = ({ phone, verification, saveToAccount = true, onVerified, id, invalid }) => {
  const [open, setOpen] = useState(false);
  if (!verification.required) return null;

  return (
    <>
      {verification.verified ? (
        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> Verified
        </span>
      ) : (
        <button
          type="button"
          id={id}
          onClick={() => setOpen(true)}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow-sm ring-2 transition ${
            invalid ? 'bg-red-600 ring-red-500/40 hover:bg-red-700' : 'bg-brand ring-brand/20 hover:bg-brand-dark'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" /> Verify
        </button>
      )}
      <PhoneVerificationModal
        isOpen={open}
        onClose={() => setOpen(false)}
        initialPhone={phone}
        saveToAccount={saveToAccount}
        onSuccess={(verifiedPhone) => {
          verification.markVerified(verifiedPhone);
          onVerified?.(verifiedPhone);
        }}
      />
    </>
  );
};
