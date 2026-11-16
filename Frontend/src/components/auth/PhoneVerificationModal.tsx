import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Send,
  RefreshCw,
} from 'lucide-react';
import { phoneAuthClient, PhoneSettingsResponse } from '../../services/phoneAuthClient';

/** The WhatsApp logo, so it is clear at a glance that the code arrives on WhatsApp. */
const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

interface PhoneVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPhone?: string;
  /** false for a number that is not the shopper's own (a gift recipient): the account number is left alone */
  saveToAccount?: boolean;
  onSuccess: (verifiedPhone: string) => void;
}

export const PhoneVerificationModal: React.FC<PhoneVerificationModalProps> = ({
  isOpen,
  onClose,
  initialPhone = '',
  saveToAccount = true,
  onSuccess,
}) => {
  const [phone, setPhone] = useState(initialPhone);
  const [provider, setProvider] = useState<'whatsapp' | 'firebase'>('whatsapp');
  const [settings, setSettings] = useState<PhoneSettingsResponse | null>(null);

  const [step, setStep] = useState<'input' | 'otp' | 'success'>('input');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (initialPhone) {
      setPhone(initialPhone.replace(/\D/g, '').slice(-10));
    }
  }, [initialPhone]);

  useEffect(() => {
    if (isOpen) {
      phoneAuthClient
        .getSettings()
        .then((res) => {
          setSettings(res);
          if (res.firebaseEnabled && !res.whatsappEnabled) {
            setProvider('firebase');
          } else {
            setProvider('whatsapp');
          }
        })
        .catch(() => {
          // default
        });
    }
  }, [isOpen]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'otp' && timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    } else if (timer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  if (!isOpen) return null;

  const handleSendCode = async (channel?: 'whatsapp' | 'firebase') => {
    const activeChannel = channel || provider;
    const cleanDigits = phone.replace(/\D/g, '').slice(-10);
    if (cleanDigits.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await phoneAuthClient.sendOtp(cleanDigits, activeChannel, 'phone-modal-recaptcha');
      setStep('otp');
      setTimer(30);
      setCanResend(false);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    const cleanDigits = phone.replace(/\D/g, '').slice(-10);
    const cleanOtp = otp.trim();
    if (cleanOtp.length < 4) {
      setError('Please enter the verification code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await phoneAuthClient.verifyOtp({
        phone: cleanDigits,
        otp: cleanOtp,
        provider,
        saveToAccount,
      });

      if (res.success) {
        setStep('success');
        setTimeout(() => {
          onSuccess(res.phone || cleanDigits);
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Incorrect or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Drawn straight into <body>: inside a form field's box (which is moved with a transform) "fixed" would only fill that small box
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Verify mobile number"
      className="fixed inset-0 z-300 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl transition-all sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Invisible Recaptcha container for Firebase */}
        <div id="phone-modal-recaptcha" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
              provider === 'whatsapp' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
            }`}
          >
            {provider === 'whatsapp' ? <WhatsAppIcon className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
          </div>
          <div className="min-w-0 pr-8">
            <h3 className="text-base font-bold text-slate-900">Verify Mobile Number</h3>
            <p className="text-xs text-slate-500">
              {provider === 'whatsapp' ? 'We send a code on WhatsApp' : 'Fast & secure OTP authentication'}
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Input Phone & Choose Provider */}
        {step === 'input' && (
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700">10-Digit Mobile Number</label>
              <div className="mt-1 flex rounded-xl border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                <span className="flex items-center border-r border-slate-200 px-3 text-xs font-bold text-slate-500">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  className="w-full px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                  autoFocus
                />
              </div>
            </div>

            {/* Provider Switcher if both enabled */}
            {settings?.whatsappEnabled && settings?.firebaseEnabled && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Select OTP Channel</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProvider('whatsapp')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-all cursor-pointer ${
                      provider === 'whatsapp'
                        ? 'border-emerald-500 bg-emerald-50/70 text-emerald-700 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <WhatsAppIcon className="h-4 w-4 text-emerald-600" />
                    WhatsApp
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider('firebase')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-all cursor-pointer ${
                      provider === 'firebase'
                        ? 'border-blue-500 bg-blue-50/70 text-blue-700 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Smartphone className="h-4 w-4 text-blue-600" />
                    SMS Text
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={loading || phone.length !== 10}
              onClick={() => handleSendCode()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending Code...
                </>
              ) : (
                <>
                  {provider === 'whatsapp' ? <WhatsAppIcon className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  {provider === 'whatsapp' ? 'Send Code on WhatsApp' : 'Send Verification Code'}
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 2: OTP Verification */}
        {step === 'otp' && (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              Enter 6-digit code sent via{' '}
              <span className="inline-flex items-center gap-1 font-bold text-slate-900">
                {provider === 'whatsapp' ? <WhatsAppIcon className="h-3.5 w-3.5 text-emerald-600" /> : null}
                {provider === 'whatsapp' ? 'WhatsApp' : 'SMS'}
              </span>{' '}
              to <span className="font-bold text-slate-900">+91 {phone}</span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">Verification Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="• • • • • •"
                className="mt-1 w-full rounded-xl border border-slate-300 py-2.5 text-center text-xl font-bold tracking-widest text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                autoFocus
              />
            </div>

            <button
              type="button"
              disabled={loading || otp.length < 4}
              onClick={handleVerifyCode}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-md shadow-emerald-500/20 transition-all hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" /> Confirm & Verify
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <button
                type="button"
                onClick={() => setStep('input')}
                className="font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                Change number
              </button>

              {canResend ? (
                <button
                  type="button"
                  onClick={() => handleSendCode()}
                  className="flex items-center gap-1 font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" /> Resend Code
                </button>
              ) : (
                <span>Resend code in {timer}s</span>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Success Screen */}
        {step === 'success' && (
          <div className="py-8 text-center animate-in zoom-in-95 duration-200">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h4 className="text-base font-bold text-slate-900">Mobile Verified!</h4>
            <p className="mt-1 text-xs text-slate-500">+91 {phone} has been verified successfully.</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

