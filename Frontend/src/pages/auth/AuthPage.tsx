import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User as DbUser } from '../../types';
import { useAuth, useUI } from '../../context';
import {
  Sparkles,
  Mail,
  Lock,
  User,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  Key,
  ClipboardPaste,
  Smartphone,
  MessageSquare,
} from 'lucide-react';
import { api } from '../../services/api';
import { saveSessionTokens } from '../../services/apiClient';
import { phoneAuthClient } from '../../services/phoneAuthClient';
import { markWelcomeCelebration } from '../../utils/welcomeCelebration';
import { BrandLogo } from '../../components/layout/BrandLogo';
import styles from '../../styles/productPage.module.css';

/** Digits in verification codes: 4 for Email, 6 for WhatsApp */
const EMAIL_OTP_LENGTH = 4;
const WHATSAPP_OTP_LENGTH = 6;
const OTP_LENGTH = 4;
/** The shopper allowed reading a copied code from the clipboard ("auto-fill"). */
const OTP_AUTOFILL_KEY = 'petal_pen_otp_autofill';

/** First standalone 4-or-6-digit code in some text */
const extractOtp = (text: string, len: number = OTP_LENGTH): string | null => {
  const pattern = new RegExp(`(?:^|\\D)(\\d{${len}})(?!\\d)`);
  return text.replace(/\s+/g, '').match(pattern)?.[1] ?? null;
};

/** Reads a code from the clipboard. `allowed` is false when the browser refused access. */
const readClipboardOtp = async (len: number = OTP_LENGTH): Promise<{ allowed: boolean; code: string | null }> => {
  try {
    return { allowed: true, code: extractOtp(await navigator.clipboard.readText(), len) };
  } catch {
    return { allowed: false, code: null };
  }
};

/**
 * One box per digit over a single real input, so typing, pasting and the keyboard's code suggestion
 * (autocomplete="one-time-code": "From Messages / Mail" on iPhone, SMS codes on Android) all just work.
 */
const OtpBoxes: React.FC<{
  value: string;
  onChange: (code: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  length?: number;
}> = ({
  value,
  onChange,
  autoFocus,
  disabled,
  length = OTP_LENGTH,
}) => {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative mx-auto flex w-fit gap-2 sm:gap-3">
      {Array.from({ length }, (_, i) => {
        const active = focused && !disabled && (i === value.length || (i === length - 1 && value.length === length));
        return (
          <div
            key={i}
            aria-hidden="true"
            className={`grid h-12 w-10 sm:h-14 sm:w-12 place-items-center rounded-xl border-2 text-xl sm:text-2xl font-bold text-slate-900 transition-all ${
              active
                ? 'border-blue-500 bg-white ring-4 ring-blue-500/15'
                : value[i]
                  ? 'border-slate-300 bg-white'
                  : 'border-slate-200 bg-slate-50'
            }`}
          >
            {value[i] ?? (active ? <span className="h-6 w-0.5 animate-pulse rounded bg-blue-500" /> : '')}
          </div>
        );
      })}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        aria-label={`${length}-digit code`}
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPaste={(e) => {
          const code = extractOtp(e.clipboardData.getData('text'), length);
          if (code) {
            e.preventDefault();
            onChange(code);
          }
        }}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-base text-transparent caret-transparent opacity-0 outline-none"
      />
    </div>
  );
};

/** One-tap "Paste code" button directly under OTP boxes */
const OtpAutoFill: React.FC<{ enabled: boolean; onAllow: () => void; onPaste: () => void }> = ({ onPaste }) => {
  return (
    <div className="flex flex-col items-center gap-1.5 mt-2">
      <button
        type="button"
        onClick={onPaste}
        className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700 transition-all hover:bg-blue-100 hover:border-blue-300 active:scale-95 shadow-xs cursor-pointer"
      >
        <ClipboardPaste className="h-3.5 w-3.5" /> 📋 Paste code
      </button>
      <p className="text-[11px] text-slate-400">Copy code from email, then 1-tap paste here</p>
    </div>
  );
};

// The password-reset flow allows 10 server hits; the next one sends the shopper to the home page and closes this page
// for a while (kept on this device, so a refresh does not undo it).
const AUTH_BLOCK_KEY = 'petal_auth_blocked_until';
const AUTH_HITS_KEY = 'petal_auth_reset_hits';
const MAX_RESET_HITS = 10;
const BLOCK_MINUTES = 10;

// Sign-in step 1 (looking an account up by email / mobile number): 10 lookups, then a 60 second countdown nobody can skip
// (kept on this device, so a refresh does not undo it)
const LOOKUP_KEY = 'nyochavar_signin_lookups';
const MAX_LOOKUPS = 10;
const LOOKUP_COOLDOWN_SECONDS = 60;
const LOOKUP_WINDOW_MS = 10 * 60_000;

const lookupSecondsLeft = (): number => {
  try {
    const saved = JSON.parse(localStorage.getItem(LOOKUP_KEY) || 'null');
    return saved?.until > Date.now() ? Math.ceil((saved.until - Date.now()) / 1000) : 0;
  } catch {
    return 0;
  }
};

/** Counts one lookup; the 10th one starts the countdown. */
const registerLookup = (): void => {
  try {
    const saved = JSON.parse(localStorage.getItem(LOOKUP_KEY) || 'null');
    const windowOpen = saved && Date.now() - saved.start < LOOKUP_WINDOW_MS;
    const count = (windowOpen ? saved.count : 0) + 1;
    localStorage.setItem(
      LOOKUP_KEY,
      JSON.stringify(
        count >= MAX_LOOKUPS
          ? { count: 0, start: Date.now(), until: Date.now() + LOOKUP_COOLDOWN_SECONDS * 1000 }
          : { count, start: windowOpen ? saved.start : Date.now(), until: 0 }
      )
    );
  } catch {
    /* storage unavailable: the server limit still applies */
  }
};

const blockedMinutesLeft = (): number => {
  try {
    const until = Number(localStorage.getItem(AUTH_BLOCK_KEY) || 0);
    return until > Date.now() ? Math.ceil((until - Date.now()) / 60000) : 0;
  } catch {
    return 0;
  }
};

/** Counts one server hit of the reset flow. Returns true when the limit is passed (access is then blocked). */
const registerResetHit = (): boolean => {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTH_HITS_KEY) || 'null');
    const windowOpen = saved && Date.now() - saved.start < BLOCK_MINUTES * 60_000;
    const next = { start: windowOpen ? saved.start : Date.now(), count: (windowOpen ? saved.count : 0) + 1 };
    if (next.count > MAX_RESET_HITS) {
      localStorage.setItem(AUTH_BLOCK_KEY, String(Date.now() + BLOCK_MINUTES * 60_000));
      localStorage.removeItem(AUTH_HITS_KEY);
      return true;
    }
    localStorage.setItem(AUTH_HITS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the server limit still applies */
  }
  return false;
};

interface AuthPageProps {
  onNavigate?: (view: string) => void;
  onLogin?: (user: DbUser) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onNavigate, onLogin }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { handleLogin } = useAuth();
  const { showToast } = useUI();
  const searchParams = new URLSearchParams(location.search);
  const redirectTarget = searchParams.get('redirect') || '/';

  const initialStep = searchParams.get('step');
  const initialEmail = searchParams.get('email') || '';
  const initialOtp = searchParams.get('otp') || '';

  const doLogin = (user: DbUser) => {
    if (onLogin) {
      onLogin(user);
    } else {
      handleLogin(user);
      navigate(redirectTarget);
    }
  };

  const doNavigate = (view: string) => {
    if (onNavigate) {
      onNavigate(view);
    } else {
      navigate(view === 'home' ? '/' : `/${view}`);
    }
  };

  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>(() => {
    if (initialTab === 'signup') return 'signup';
    return 'signin';
  });
  const [step, setStep] = useState<'form' | 'otp' | 'forgot-password' | 'reset-password' | 'set-password' | 'complete-signup'>(() => {
    if (initialStep && ['form', 'otp', 'forgot-password', 'reset-password', 'set-password', 'complete-signup'].includes(initialStep)) {
      return initialStep as any;
    }
    return 'form';
  });
  
  // Direct Password State
  const [verifiedUser, setVerifiedUser] = useState<DbUser | null>(null);
  const [directPassword, setDirectPassword] = useState('');
  const [showDirectPassword, setShowDirectPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberAlways, setRememberAlways] = useState(true);

  // Form State
  const [name, setName] = useState('');
  // The last sign-up step only shows a Full Name field when the name was not typed on the first step
  const [askName, setAskName] = useState(false);
  const [email, setEmail] = useState(() => initialEmail);
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(() => initialOtp);

  // Dynamic Verification Mode (Controlled by Admin Automation Settings)
  const [phone, setPhone] = useState('');
  const [signupMethod, setSignupMethod] = useState<'whatsapp' | 'email'>('whatsapp');
  const [whatsappEnabledGlobal, setWhatsappEnabledGlobal] = useState(true);

  useEffect(() => {
    phoneAuthClient
      .getSettings()
      .then((res) => {
        const isWa = res.whatsappEnabled && res.activeProvider !== 'disabled';
        setWhatsappEnabledGlobal(isWa);
        setSignupMethod(isWa ? 'whatsapp' : 'email');
      })
      .catch(() => {
        setWhatsappEnabledGlobal(true);
        setSignupMethod('whatsapp');
      });
  }, []);

  // Too many attempts earlier: this page stays closed for a while
  const blockedLeft = blockedMinutesLeft();
  useEffect(() => {
    if (blockedLeft > 0) {
      showToast({ title: 'Access blocked', description: `Too many attempts. Please try again in ${blockedLeft} minute${blockedLeft === 1 ? '' : 's'}.` });
      navigate('/', { replace: true });
    }
  }, []);

  const kickOutForTooManyHits = () => {
    showToast({ title: 'Too many attempts', description: `You made too many requests. Access is blocked for ${BLOCK_MINUTES} minutes.` });
    navigate('/', { replace: true });
  };

  // Shakes a missed field once (the CSS skips the motion for people who prefer reduced motion)
  const flagField = (key: 'otp' | 'password', elementId: string) => {
    setInvalidField(key);
    requestAnimationFrame(() => {
      const el = document.getElementById(elementId);
      if (!el) return;
      el.classList.remove('field-shake');
      void el.offsetWidth;
      el.classList.add('field-shake');
      el.addEventListener('animationend', () => el.classList.remove('field-shake'), { once: true });
      if (key === 'password') el.focus();
    });
  };

  // A link from an email (?step=reset-password&email=...&otp=...) fills the form once. The one-time values are then removed
  // from the address bar: left there, every later step change (for example after a successful reset) would read the old
  // code again and send the shopper to the sign-up "verify your email" step.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paramStep = params.get('step');
    const paramEmail = params.get('email');
    const paramOtp = (params.get('otp') || params.get('code') || '').trim();
    const paramTab = params.get('tab');
    const validOtp = /^\d{4}$/.test(paramOtp);

    if (paramTab === 'signup' || paramTab === 'signin') setActiveTab(paramTab);
    if (paramEmail) setEmail(paramEmail);
    if (validOtp) setOtp(paramOtp);
    if (paramStep && ['form', 'otp', 'forgot-password', 'reset-password', 'set-password', 'complete-signup'].includes(paramStep)) {
      setStep(paramStep as any);
    } else if (validOtp) {
      // a plain code link (the "copy code" redirect) opens the verify-email step
      setStep((current) => (current === 'form' ? 'otp' : current));
    }

    if (paramStep || paramEmail || params.get('otp') || params.get('code')) {
      ['step', 'email', 'otp', 'code'].forEach((key) => params.delete(key));
      const rest = params.toString();
      navigate({ pathname: location.pathname, search: rest ? `?${rest}` : '' }, { replace: true });
    }
  }, [location.search]);
  const [error, setError] = useState<string | null>(null);
  // Sign-in goes in two steps: first the email / mobile number is looked up, then its password is asked for
  const [signinStage, setSigninStage] = useState<'identify' | 'password'>('identify');
  // An existing account that needs a code before it can sign in (not verified yet, or Google-only with no password)
  const [recovery, setRecovery] = useState<{ channel: 'email' | 'whatsapp'; identifier: string; otpLength: number; sentTo: string } | null>(null);
  const [lookupLeft, setLookupLeft] = useState(() => lookupSecondsLeft());
  // Forgot password follows the admin's switch: a WhatsApp code to the mobile number, or an email code
  const resetViaWhatsapp = whatsappEnabledGlobal;
  // The code on the verify step goes to WhatsApp (6 digits) or email (4 digits)
  const isWhatsappOtp = recovery ? recovery.channel === 'whatsapp' : activeTab === 'signup' && signupMethod === 'whatsapp';

  useEffect(() => {
    setSigninStage('identify');
  }, [activeTab]);

  // The 60 second countdown after 10 lookups ticks down on its own
  useEffect(() => {
    if (lookupLeft <= 0) return;
    const tick = window.setInterval(() => setLookupLeft(lookupSecondsLeft()), 1000);
    return () => window.clearInterval(tick);
  }, [lookupLeft > 0]);
  // The reset-form field that was missed (red border + shake) until the shopper edits it
  const [invalidField, setInvalidField] = useState<'otp' | 'password' | null>(null);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [timer, setTimer] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  // Full-screen progress while a Google sign-in / account creation is being processed
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [otpAutoFill, setOtpAutoFill] = useState(() => {
    try {
      return localStorage.getItem(OTP_AUTOFILL_KEY) === 'on';
    } catch {
      return false;
    }
  });
  /** Code already on the clipboard when the OTP screen opened: an old one, never auto-filled. */
  const staleClipboardCode = useRef<string | null>(null);
  /** Last code sent to the server automatically, so a wrong code is not re-submitted in a loop. */
  const autoSubmittedCode = useRef<string | null>(null);
  const otpScreenOpen = step === 'otp' || step === 'reset-password';

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'otp' && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  // Google OAuth Initialization & Handler
  useEffect(() => {
    if (step !== 'form') return;

    const clientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    if (!clientId) return; // Google sign-in is optional: skipped when no client id is configured

    const handleGoogleCallback = async (response: any) => {
      if (!response?.credential) return;
      setIsLoading(true);
      setIsGoogleLoading(true);
      setError(null);
      try {
        // New and returning Google users alike: the server has already verified the email and created the
        // account, so there is no OTP or password step. Just sign in.
        const data = await api.googleLogin(response.credential);
        // Brand-new Google account: the home page plays the welcome celebration
        if (data.isNewUser) markWelcomeCelebration();
        // Create Account tab, but this verified email already has an account: tell them before signing them in
        if (data.alreadyRegistered && activeTab === 'signup') {
          showToast({
            tone: 'warning',
            title: 'Email already verified',
            description: 'This email already has an account, so we signed you in.',
          });
        }
        doLogin(data.user);
      } catch (err: any) {
        setError(err.message || 'Google Sign-In failed');
      } finally {
        setIsLoading(false);
        setIsGoogleLoading(false);
      }
    };

    const setupGsi = () => {
      if ((window as any).google?.accounts?.id) {
        try {
          (window as any).google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCallback,
            auto_select: false,
            cancel_on_tap_outside: true
          });

          // Render signup Google button at top (for signup tab)
          const signupContainer = document.getElementById('googleSignUpBtnDiv');
          if (signupContainer && activeTab === 'signup') {
            signupContainer.innerHTML = '';
            (window as any).google.accounts.id.renderButton(signupContainer, {
              theme: 'outline',
              size: 'large',
              type: 'standard',
              shape: 'pill',
              text: 'signup_with',
              logo_alignment: 'left',
              width: Math.min(320, signupContainer.clientWidth || 300)
            });
          }

          // Render signin Google button at bottom (for signin tab)
          const signinContainer = document.getElementById('googleSignInBtnDiv');
          if (signinContainer && activeTab === 'signin') {
            signinContainer.innerHTML = '';
            (window as any).google.accounts.id.renderButton(signinContainer, {
              theme: 'outline',
              size: 'large',
              type: 'standard',
              shape: 'pill',
              text: 'signin_with',
              logo_alignment: 'left',
              width: Math.min(320, signinContainer.clientWidth || 300)
            });
          }
        } catch (e) {
          console.error('Error initializing Google Sign-In:', e);
        }
      }
    };

    if ((window as any).google?.accounts?.id) {
      setupGsi();
    } else {
      const interval = setInterval(() => {
        if ((window as any).google?.accounts?.id) {
          clearInterval(interval);
          setupGsi();
        }
      }, 250);
      return () => clearInterval(interval);
    }
  }, [step, activeTab]);

  // Sign-in step 1: look the email / mobile number up before asking for anything else
  const handleIdentify = async () => {
    const typed = email.trim();
    if (!typed) {
      setError('Enter your email address or mobile number');
      return;
    }
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed);
    const validPhone = !typed.includes('@') && typed.replace(/\D/g, '').length >= 10;
    if (!validEmail && !validPhone) {
      setError('Enter a valid email address or 10-digit mobile number');
      return;
    }
    // The countdown after 10 lookups cannot be skipped
    if (lookupSecondsLeft() > 0) {
      setLookupLeft(lookupSecondsLeft());
      return;
    }
    registerLookup();
    setLookupLeft(lookupSecondsLeft());

    const result = await api.identifyAccount(typed);
    if (result.status === 'not_found') {
      showToast({
        tone: 'warning',
        title: 'Account not found',
        description: 'No account exists for this email or number. Please create an account first.',
      });
      return;
    }
    if (result.status === 'password') {
      setPassword('');
      setSigninStage('password');
      return;
    }
    // Not verified yet (or a Google-only account without a password): a code was just sent, and a new password follows it
    setRecovery({
      channel: result.channel ?? 'email',
      identifier: typed,
      otpLength: result.otpLength ?? 4,
      sentTo: result.sentTo ?? '',
    });
    setStep('otp');
    setOtpAttempts(0);
    setTimer(60);
    setOtp('');
    setError(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (activeTab === 'signin') {
        if (signinStage === 'identify') {
          await handleIdentify();
          return;
        }
        if (!email.trim() || !password) {
          setError('Email and password are required');
          setIsLoading(false);
          return;
        }
        
        try {
          const data = await api.login({ email: email.trim(), password });
          doLogin(data.user);
        } catch (err: any) {
          if (err.requiresOtp) {
            setEmail(err.email || email.trim());
            setStep('otp');
            setOtpAttempts(0);
            setTimer(60);
            setOtp('');
            setError(err.message || 'Please verify your email before logging in.');
            return;
          }
          throw err;
        }
      } else {
        if (!name.trim()) {
          setError('Please enter your full name');
          setIsLoading(false);
          return;
        }

        if (signupMethod === 'whatsapp') {
          const cleanPhone = phone.replace(/\D/g, '');
          if (!cleanPhone || cleanPhone.length < 10) {
            setError('Please enter a valid 10-digit mobile number');
            setIsLoading(false);
            return;
          }
          try {
            await phoneAuthClient.sendOtp(cleanPhone, 'whatsapp', undefined, 'signup');
          } catch (sendErr: any) {
            // This number already has a verified account: warn, and do not send another code
            if (sendErr?.code === 'PHONE_EXISTS') {
              showToast({
                tone: 'warning',
                title: 'Number already verified',
                description: 'This mobile number already has an account. Please sign in instead.',
              });
              setError(null);
              return;
            }
            throw sendErr;
          }
          setStep('otp');
          setOtpAttempts(0);
          setTimer(60);
          setOtp('');
          setError(null);
        } else {
          if (!email.trim()) {
            setError('Email address is required');
            setIsLoading(false);
            return;
          }
          await api.signup({ email: email.trim(), name: name.trim() });
          setStep('otp');
          setOtpAttempts(0);
          setTimer(60);
          setOtp('');
          setError(null);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void verifyOtpCode(otp);
  };

  const verifyOtpCode = async (code: string) => {
    setError(null);
    const requiredLength = recovery ? recovery.otpLength : isWhatsappOtp ? WHATSAPP_OTP_LENGTH : EMAIL_OTP_LENGTH;
    
    if (otpAttempts >= 5) {
      setError('Too many failed attempts. Please resend OTP.');
      return;
    }

    if (code.length < requiredLength) {
      setError(`Please enter the ${requiredLength}-digit code`);
      return;
    }

    setIsLoading(true);
    try {
      if (recovery) {
        // An existing account: a right code verifies it and signs it in; the next step sets its password
        const data = await api.verifyAccountOtp({ identifier: recovery.identifier, otp: code });
        setVerifiedUser(data.user);
        setDirectPassword('');
        setError(null);
        setStep('set-password');
        return;
      }
      if (isWhatsappOtp) {
        const cleanPhone = phone.replace(/\D/g, '');
        const res = await phoneAuthClient.verifyOtp({ phone: cleanPhone, otp: code, provider: 'whatsapp' });
        setVerifiedUser({
          id: 'phone_' + cleanPhone,
          name: name.trim(),
          email: '', // a mobile-number account has no email until the customer adds one in their profile
          phone: cleanPhone,
          is_phone_verified: true,
          is_verified: true,
        } as any);
        setPassword('');
        setStep('complete-signup');
        setError(null);
      } else {
        const data = await api.verifyOtp({ email, otp: code });
        // Email verified! Transition to Complete Signup step (Full Name & Password)
        setVerifiedUser(data.user);
        const serverName =
          data.user?.name && data.user.name !== data.user.email?.split('@')[0] ? data.user.name : '';
        const finalName = name.trim() || serverName;
        setName(finalName);
        // No name anywhere (for example an unverified account signing in): ask for it on the next step
        setAskName(!finalName);
        setPassword('');
        setStep('complete-signup');
        setError(null);
      }
    } catch (err: any) {
      const newAttempts = otpAttempts + 1;
      setOtpAttempts(newAttempts);
      setError(newAttempts >= 5 ? 'Too many failed attempts. Please resend OTP.' : (err.message || 'Invalid OTP'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }

    if (!password || password.trim().length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      let data;
      if (verifiedUser?.phone) {
        data = await phoneAuthClient.completeSignup({
          name: name.trim(),
          phone: verifiedUser.phone,
          password: password.trim(),
          email: email.trim() || undefined,
        });
      } else {
        data = await api.completeSignup({
          userId: verifiedUser?.id,
          email: verifiedUser?.email || email.trim(),
          name: name.trim(),
          password: password.trim()
        });
      }

      if (data?.token) {
        saveSessionTokens('buyer', data);
      }

      if (rememberAlways) {
        localStorage.setItem('petal_pen_remember_login', 'true');
        if (data.user?.email) {
          localStorage.setItem('petal_pen_saved_email', data.user.email);
        }
      }

      // Brand-new account: the home page plays a short paper celebration
      markWelcomeCelebration();
      doLogin(data.user);
    } catch (err: any) {
      setError(err.message || 'Failed to complete registration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!directPassword || directPassword.trim().length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!verifiedUser?.id) {
      setError('Verification session expired. Please sign in again.');
      return;
    }

    setIsLoading(true);
    try {
      await api.setPassword(verifiedUser.id, directPassword.trim());

      if (rememberAlways) {
        localStorage.setItem('petal_pen_remember_login', 'true');
        if (verifiedUser.email) {
          localStorage.setItem('petal_pen_saved_email', verifiedUser.email);
        }
      }
      localStorage.setItem(`petal_pen_has_set_password_${verifiedUser.id}`, 'true');

      doLogin(verifiedUser);
    } catch (err: any) {
      setError(err.message || 'Failed to set password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (resetViaWhatsapp) {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        setError('Please enter a valid 10-digit mobile number');
        return;
      }
      if (registerResetHit()) return kickOutForTooManyHits();
      setIsLoading(true);
      try {
        // The server first checks that an account has this number, and only then sends the WhatsApp code
        await phoneAuthClient.forgotPassword(cleanPhone);
        setStep('reset-password');
        setTimer(60);
        setOtpAttempts(0);
        setOtp('');
        setPassword('');
      } catch (err: any) {
        if (err?.code === 'ACCOUNT_NOT_FOUND') {
          showToast({
            tone: 'warning',
            title: 'Account not found',
            description: 'No account exists for this mobile number. Please check it or create an account.',
          });
        } else {
          setError(err.message || 'Failed to send the verification code');
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }
    if (!email) {
      setError('Please enter your email');
      return;
    }
    if (registerResetHit()) return kickOutForTooManyHits();
    setIsLoading(true);
    try {
      // Only hit the mail endpoint once we know the account exists
      const accountExists = await api.checkEmailExists(email.trim());
      if (!accountExists) {
        setError('No account found with this email. Please check the address or sign up.');
        return;
      }

      await api.forgotPassword(email);
      setStep('reset-password');
      setTimer(60);
      setOtpAttempts(0);
      setOtp('');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const resetCodeLength = resetViaWhatsapp ? WHATSAPP_OTP_LENGTH : OTP_LENGTH;
    if (otp.length < resetCodeLength) {
      setError(`Please enter the ${resetCodeLength}-digit code from ${resetViaWhatsapp ? 'WhatsApp' : 'your email'}`);
      flagField('otp', 'reset-otp-box');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your new password');
      flagField('password', 'reset-new-password');
      return;
    }
    if (password.trim().length < 6) {
      setError('Password must be at least 6 characters');
      flagField('password', 'reset-new-password');
      return;
    }
    if (registerResetHit()) return kickOutForTooManyHits();
    setIsLoading(true);
    try {
      if (resetViaWhatsapp) {
        await phoneAuthClient.resetPassword({ phone: phone.replace(/\D/g, ''), otp, newPassword: password });
        // Sign In then starts at the mobile number again
        setEmail(phone.replace(/\D/g, ''));
        setSigninStage('identify');
      } else {
        await api.resetPassword({ email, otp, newPassword: password });
      }
      setStep('form');
      setActiveTab('signin');
      setPassword('');
      setOtp('');
      setError('Password reset successfully! Please sign in.');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  // Verify as soon as all 4 digits are in (typed, pasted or auto-filled), once per code
  useEffect(() => {
    if (step !== 'otp' || otp.length !== OTP_LENGTH || isLoading || otpAttempts >= 5) return;
    if (autoSubmittedCode.current === otp) return;
    autoSubmittedCode.current = otp;
    void verifyOtpCode(otp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, step]);

  const fillOtpFromClipboard = useCallback(async (code: string | null) => {
    if (!code || code === staleClipboardCode.current) return false;
    setOtp(code);
    setError(null);
    return true;
  }, []);

  // "Allow auto-fill": this tap lets the browser ask for clipboard permission
  const handleAllowOtpAutoFill = async () => {
    const { allowed, code } = await readClipboardOtp();
    if (!allowed) {
      setError('Clipboard access was blocked. Allow it in your browser settings, or type the code.');
      return;
    }
    setOtpAutoFill(true);
    try {
      localStorage.setItem(OTP_AUTOFILL_KEY, 'on');
    } catch {
      /* the choice just won't be remembered */
    }
    staleClipboardCode.current = null;
    await fillOtpFromClipboard(code);
  };

  const handlePasteOtp = async () => {
    try {
      const text = await navigator.clipboard?.readText();
      const extracted = text ? extractOtp(text) : null;
      if (extracted) {
        setOtp(extracted);
        setError(null);
        return;
      }
    } catch {
      // fallback
    }
    const { allowed, code } = await readClipboardOtp();
    if (!allowed) return setError('Clipboard access was blocked. Please type the 4-digit code.');
    staleClipboardCode.current = null;
    if (!(await fillOtpFromClipboard(code))) setError(`No ${OTP_LENGTH}-digit code found on clipboard. Copy the code from the email first.`);
  };

  // When user returns from Gmail / Mail app, check clipboard automatically and fill OTP
  useEffect(() => {
    if (!otpScreenOpen) return;

    const onReturn = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const text = await navigator.clipboard?.readText();
        const code = text ? extractOtp(text) : null;
        if (code && code.length === OTP_LENGTH && code !== autoSubmittedCode.current) {
          setOtp(code);
          setError(null);
        }
      } catch {
        // browser may require user gesture on some platforms
      }
    };

    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [otpScreenOpen]);

  const handleResendOtp = async () => {
    if (timer > 0) return;
    try {
      if (recovery) {
        // Same lookup as before: it sends a fresh code
        await api.identifyAccount(recovery.identifier);
      } else if (isWhatsappOtp) {
        const cleanPhone = phone.replace(/\D/g, '');
        await phoneAuthClient.sendOtp(cleanPhone, 'whatsapp');
      } else {
        await api.resendOtp(email);
      }
      setTimer(60);
      setOtpAttempts(0);
      setOtp('');
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP');
    }
  };

  if (blockedLeft > 0) return null;

  return (
    <section className="storefront h-dvh w-full overflow-hidden bg-white flex relative font-body text-slate-900 antialiased">
      {isGoogleLoading && (
        <div role="status" aria-live="polite" className="fixed inset-0 z-[100] grid place-items-center bg-white/85 px-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex w-full max-w-xs flex-col items-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
            <svg className="h-16 w-16 animate-spin" style={{ animationDuration: "1.1s" }} viewBox="0 0 50 50" aria-hidden="true">
              <circle cx="25" cy="25" r="20" fill="none" strokeWidth="4" className="stroke-slate-100" />
              <circle cx="25" cy="25" r="20" fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray="90 150" className="stroke-blue-600" />
            </svg>
            <p className="mt-5 font-serif text-xl text-slate-900">Setting up your account</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">Signing you in with Google. This only takes a moment.</p>
          </div>
        </div>
      )}
      
      {/* Absolute Back Button */}
      <button 
        onClick={() => doNavigate('home')}
        className="absolute top-4 left-4 sm:top-6 sm:left-6 z-50 inline-flex items-center gap-2 rounded-full px-3 py-2 sm:px-4 text-sm font-semibold transition bg-slate-100 text-slate-700 hover:bg-slate-200 lg:bg-white/15 lg:text-white lg:hover:bg-white/25 lg:backdrop-blur-md"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline">Back to Home</span>
      </button>

      {/* Left Column - Branding & Image (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-blue-900 items-center justify-center overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=1200" 
          alt="Luxury Gift" 
          className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-blue-950 via-blue-900/80 to-transparent"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
        
        <div className="relative z-10 p-12 text-center text-white flex flex-col items-center">
          <div className="mb-8 rounded-3xl bg-white px-8 py-5 shadow-2xl">
            <BrandLogo size="lg" />
          </div>
          <p className="text-lg font-medium text-blue-100 max-w-md mx-auto leading-relaxed">
            Curating unforgettable moments through bespoke floral arrangements and artisanal hampers.
          </p>
        </div>
      </div>

      {/* Right Column - Auth Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center p-4 sm:p-6 relative overflow-y-auto overflow-x-hidden">
        <div className="absolute top-0 right-0 w-[30rem] h-[30rem] bg-blue-50/50 rounded-full blur-[80px] pointer-events-none -translate-y-1/4 translate-x-1/4"></div>

        <div className="w-full max-w-sm mx-auto relative z-10">
          
          <div className="lg:hidden text-center mb-6 flex flex-col items-center justify-center cursor-pointer select-none" onClick={() => doNavigate('home')}>
            <BrandLogo size="lg" />
          </div>

          <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-[1.5rem] shadow-2xl overflow-hidden">
            
            {step === 'form' ? (
              <>
                {/* Tab Switcher */}
                <div className="flex p-1.5 bg-slate-50/50 border-b border-slate-100">
                  <button
                    onClick={() => { setActiveTab('signin'); setError(null); }}
                    className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                      activeTab === 'signin' 
                        ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => { setActiveTab('signup'); setError(null); }}
                    className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                      activeTab === 'signup' 
                        ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                <div className="p-5 sm:p-7">
                  <div className="mb-5">
                    <h3 className={`text-lg sm:text-xl font-bold text-slate-900 mb-1 ${styles.serifHeading}`}>
                      {activeTab === 'signin' ? 'Welcome back' : 'Create an Account'}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
                      {activeTab === 'signin' 
                        ? 'Enter your credentials to access your curated gifting experience.' 
                        : (signupMethod === 'whatsapp' ? 'Enter your mobile number to get started via WhatsApp.' : 'Enter your email address to get started.')}
                    </p>
                  </div>

                  {error && (
                    <div className="mb-4 p-2.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 font-semibold text-center">
                      {error}
                    </div>
                  )}

                  {/* Google Sign-Up (Top Priority on Sign-Up Tab) */}
                  {activeTab === 'signup' && (
                    <div className="mb-4">
                      <div id="googleSignUpBtnDiv" className="w-full flex justify-center min-h-[44px]"></div>
                      <div className="mt-3 text-center">
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Or</p>
                      </div>
                    </div>
                  )}

                  <form className="space-y-3.5" onSubmit={handleFormSubmit}>

                    {/* Sign-Up: Full Name */}
                    {activeTab === 'signup' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider pl-1">Full Name</label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                          </div>
                          <input
                            type="text"
                            name="name"
                            autoComplete="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter Name"
                            className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-base sm:text-sm bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-white"
                          />
                        </div>
                      </div>
                    )}

                    {/* Sign-Up: Dynamic WhatsApp vs Email Field */}
                    {isWhatsappOtp ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between pl-1 pr-1">
                          <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                            WhatsApp Mobile Number
                          </label>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            WhatsApp OTP
                          </span>
                        </div>
                        <div className="relative group">
                          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all hover:bg-white overflow-hidden">
                            <div className="bg-emerald-50/80 text-emerald-800 font-bold px-3 py-2 text-xs border-r border-slate-200 select-none">
                              +91
                            </div>
                            <input
                              type="tel"
                              name="phone"
                              autoComplete="tel"
                              required
                              value={phone}
                              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                              placeholder="98765 43210"
                              className="block w-full px-3 py-2 text-base sm:text-sm bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none font-mono tracking-wider"
                            />
                          </div>
                        </div>
                        <div className="pt-1 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">6-digit OTP via WhatsApp</span>
                          {/* With WhatsApp verification switched on in the admin panel, sign-up is by mobile number only */}
                          {!whatsappEnabledGlobal && (
                            <button
                              type="button"
                              onClick={() => { setSignupMethod('email'); setError(null); }}
                              className="text-blue-600 hover:underline font-semibold cursor-pointer"
                            >
                              Use email address instead
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between pl-1 pr-1">
                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                            {activeTab === 'signin' ? 'Email or Mobile Number' : 'Email Address'}
                          </label>
                          {activeTab === 'signup' && whatsappEnabledGlobal && (
                            <button
                              type="button"
                              onClick={() => { setSignupMethod('whatsapp'); setError(null); }}
                              className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded transition cursor-pointer"
                            >
                              ⚡ Use WhatsApp number
                            </button>
                          )}
                          {activeTab === 'signin' && signinStage === 'password' && (
                            <button
                              type="button"
                              onClick={() => { setSigninStage('identify'); setPassword(''); setError(null); }}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer"
                            >
                              Change
                            </button>
                          )}
                        </div>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                          </div>
                          <input
                            type="text"
                            name="email"
                            autoComplete="username"
                            required
                            value={email}
                            readOnly={activeTab === 'signin' && signinStage === 'password'}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={activeTab === 'signin' ? 'you@example.com or 9876543210' : 'you@example.com'}
                            className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-base sm:text-sm bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-white"
                          />
                        </div>
                      </div>
                    )}

                    {/* The password is only asked for once the account is found and is ready for one */}
                    {activeTab === 'signin' && signinStage === 'password' && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between pl-1 pr-1">
                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Password</label>
                          <button type="button" onClick={() => {
                            // A mobile number typed on Sign In carries over to the WhatsApp reset
                            if (resetViaWhatsapp && !email.includes('@') && email.replace(/\D/g, '').length >= 10) setPhone(email.replace(/\D/g, '').slice(-10));
                            setStep('forgot-password');
                            setError(null);
                          }} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors">Forgot password?</button>
                        </div>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                          </div>
                          <input 
                            type="password" 
                            name="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter Your Password" 
                            className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-base sm:text-sm bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-white"
                          />
                        </div>
                      </div>
                    )}

                    <button 
                      type="submit" 
                      disabled={isLoading || (activeTab === 'signin' && signinStage === 'identify' && lookupLeft > 0)}
                      className={`w-full mt-4 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 group cursor-pointer ${
                        isLoading || (activeTab === 'signin' && signinStage === 'identify' && lookupLeft > 0)
                          ? 'bg-slate-400 cursor-not-allowed shadow-none'
                          : (isWhatsappOtp
                              ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                              : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20')
                      }`}
                    >
                      <span className="tracking-wide text-xs sm:text-sm">
                        {isLoading
                          ? 'Please wait...'
                          : (activeTab === 'signin'
                              ? (signinStage === 'identify'
                                  ? (lookupLeft > 0 ? `Too many tries. Wait ${lookupLeft}s` : 'Continue')
                                  : 'Sign In')
                              : (signupMethod === 'whatsapp'
                                  ? 'Send WhatsApp Verification Code'
                                  : 'Send Verification Code'))}
                      </span>
                      {!isLoading && <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />}
                    </button>
                  </form>

                  {/* Google Sign-In (Bottom, for existing users) */}
                  {activeTab === 'signin' && (
                    <div className="mt-5">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                          <span className="px-3 bg-white text-slate-400 font-medium text-[10px] uppercase tracking-wider">Or</span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col items-center justify-center">
                        <div id="googleSignInBtnDiv" className="w-full flex justify-center min-h-[44px]"></div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : step === 'otp' ? (
              // Dynamic OTP Verification Step
              <div className="p-6 sm:p-8 text-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  isWhatsappOtp
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-blue-100 text-blue-600'
                }`}>
                  {isWhatsappOtp ? (
                    <Smartphone className="w-6 h-6" />
                  ) : (
                    <ShieldCheck className="w-6 h-6" />
                  )}
                </div>
                <h3 className={`text-xl font-bold text-slate-900 mb-2 ${styles.serifHeading}`}>
                  {isWhatsappOtp
                    ? 'Verify your WhatsApp number'
                    : 'Verify your email'}
                </h3>
                <p className="text-xs text-slate-500 mb-6 px-4">
                  {recovery ? (
                    <>
                      We've sent a {recovery.otpLength}-digit code to <span className="font-bold text-slate-800">{recovery.sentTo}</span>
                      {recovery.channel === 'whatsapp' ? ' via WhatsApp' : ''}. Verify it, then choose your password.
                    </>
                  ) : isWhatsappOtp ? (
                    <>We've sent a 6-digit code to <span className="font-bold text-slate-800">+91 {phone}</span> via WhatsApp.</>
                  ) : (
                    <>We've sent a 4-digit code to <span className="font-bold text-slate-800">{email}</span>.</>
                  )}
                </p>

                {error && (
                  <div className="mb-4 p-2.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 font-semibold">
                    {error}
                  </div>
                )}

                <form onSubmit={handleOtpSubmit} className="space-y-6">
                  <div>
                    <OtpBoxes
                      length={isWhatsappOtp ? 6 : 4}
                      value={otp}
                      onChange={setOtp}
                      autoFocus
                      disabled={isLoading || otpAttempts >= 5}
                    />
                    <p className={`text-[10px] mt-2 font-medium ${otpAttempts >= 5 ? 'text-red-500' : 'text-slate-400'}`}>
                      Attempts remaining: {Math.max(0, 5 - otpAttempts)}
                    </p>
                    <div className="mt-3">
                      <OtpAutoFill enabled={otpAutoFill} onAllow={handleAllowOtpAutoFill} onPaste={handlePasteOtp} />
                    </div>
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={otpAttempts >= 5 || isLoading}
                    className={`w-full font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 group ${
                      otpAttempts >= 5 || isLoading
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                        : (isWhatsappOtp
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20')
                    }`}
                  >
                    <span className="tracking-wide text-sm">{isLoading ? 'Verifying...' : 'Verify & Complete Setup'}</span>
                    {otpAttempts < 5 && !isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                  </button>

                  <div className="flex items-center justify-between mt-4">
                    <button 
                      type="button"
                      onClick={handleResendOtp}
                      disabled={timer > 0}
                      className={`text-xs font-bold transition-colors ${timer > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800 underline'}`}
                    >
                      Resend OTP {timer > 0 && `(${timer}s)`}
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setRecovery(null); setStep('form'); }}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 underline transition-colors"
                    >
                      {recovery ? 'Change email / number' : isWhatsappOtp ? 'Edit mobile number' : 'Edit email address'}
                    </button>
                  </div>
                </form>
              </div>
            ) : step === 'forgot-password' ? (
              // Forgot Password Step
              <div className="p-6 sm:p-8">
                <div className="mb-5">
                  <h3 className={`text-xl font-bold text-slate-900 mb-2 ${styles.serifHeading}`}>
                    Reset Password
                  </h3>
                  <p className="text-xs text-slate-500">
                    {resetViaWhatsapp
                      ? "Enter your mobile number. If an account has it, we'll send a 6-digit code on WhatsApp to reset your password."
                      : "Enter your email address and we'll send you an OTP to reset your password."}
                  </p>
                </div>

                {error && (
                  <div className="mb-4 p-2.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 font-semibold text-center">
                    {error}
                  </div>
                )}

                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  {resetViaWhatsapp ? (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider pl-1">WhatsApp Mobile Number</label>
                      <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all hover:bg-white overflow-hidden">
                        <div className="bg-emerald-50/80 text-emerald-800 font-bold px-3 py-2.5 text-xs border-r border-slate-200 select-none">+91</div>
                        <input
                          type="tel"
                          name="phone"
                          autoComplete="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="98765 43210"
                          className="block w-full px-3 py-2.5 text-base sm:text-sm bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none font-mono tracking-wider"
                        />
                      </div>
                    </div>
                  ) : (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider pl-1">Email Address</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="block w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-base sm:text-sm bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-white"
                      />
                    </div>
                  </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full ${resetViaWhatsapp ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'} text-white font-bold py-2.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 group ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <span className="tracking-wide text-sm">{isLoading ? 'Checking...' : resetViaWhatsapp ? 'Send WhatsApp Code' : 'Send Reset OTP'}</span>
                    {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <button onClick={() => setStep('form')} className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline transition-colors">
                    Back to Sign In
                  </button>
                </div>
              </div>
            ) : step === 'reset-password' ? (
              // Reset Password Step (Enter OTP + New Password)
              <div className="p-6 sm:p-8">
                <div className="mb-5">
                  <h3 className={`text-xl font-bold text-slate-900 mb-2 ${styles.serifHeading}`}>
                    Create New Password
                  </h3>
                  <p className="text-xs text-slate-500">
                    {resetViaWhatsapp
                      ? <>We sent a 6-digit code to <span className="font-bold text-slate-800">+91 {phone}</span> on WhatsApp. Enter it below along with your new password.</>
                      : <>We sent an OTP to {email}. Enter it below along with your new password.</>}
                  </p>
                </div>

                {error && (
                  <div className="mb-4 p-2.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 font-semibold text-center">
                    {error}
                  </div>
                )}

                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider pl-1">OTP</label>
                    <div id="reset-otp-box" className={`rounded-2xl p-1.5 transition ${invalidField === 'otp' ? 'bg-red-50 ring-2 ring-red-400/70' : ''}`}>
                      <OtpBoxes length={resetViaWhatsapp ? WHATSAPP_OTP_LENGTH : EMAIL_OTP_LENGTH} value={otp} onChange={(code) => { setOtp(code); if (invalidField === 'otp') setInvalidField(null); }} autoFocus disabled={isLoading} />
                    </div>
                    <div className="pt-2">
                      <OtpAutoFill enabled={otpAutoFill} onAllow={handleAllowOtpAutoFill} onPaste={handlePasteOtp} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider pl-1">New Password</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <input
                        id="reset-new-password"
                        type="password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); if (invalidField === 'password') setInvalidField(null); }}
                        placeholder="Create a New Password"
                        aria-invalid={invalidField === 'password' || undefined}
                        className={`block w-full pl-9 pr-3 py-2.5 border rounded-xl text-base sm:text-sm bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-white ${invalidField === 'password' ? 'border-red-500 ring-2 ring-red-400/30' : 'border-slate-200'}`}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 group ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <span className="tracking-wide text-sm">{isLoading ? 'Resetting...' : 'Reset Password'}</span>
                    {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <button onClick={() => setStep('form')} className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline transition-colors">
                    Back to Sign In
                  </button>
                </div>
              </div>
            ) : step === 'complete-signup' ? (
              // Step 3: Complete Account (Full Name & Password Input)
              <div className="p-6 sm:p-8">
                <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600 shadow-sm">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="mb-5 text-center">
                  <h3 className={`text-xl font-bold text-slate-900 mb-1.5 ${styles.serifHeading}`}>
                    Create Your Account
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Email verified! Choose a password to complete your account.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 p-2.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 font-semibold text-center">
                    {error}
                  </div>
                )}

                <form onSubmit={handleCompleteSignupSubmit} className="space-y-4">
                  {askName && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider pl-1">Full Name</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                          type="text"
                          name="fullName"
                          autoComplete="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Enter Your Full Name"
                          className="block w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-base sm:text-sm bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-white"
                        />
                      </div>
                    </div>
                  )}

                  {/* Password Input Field */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider pl-1 flex items-center justify-between">
                      <span>Password</span>
                      <span className="text-[10px] lowercase text-slate-400 font-normal">min 8 chars</span>
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <input 
                        type={showPassword ? 'text' : 'password'}
                        name="newPassword"
                        autoComplete="new-password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a New Password" 
                        className="block w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl text-base sm:text-sm bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Always Checkbox */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="signupRememberAlways"
                      checked={rememberAlways}
                      onChange={(e) => setRememberAlways(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="signupRememberAlways" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                      Remember always for easy login
                    </label>
                  </div>
                  
                  {/* Submit Account Create Button */}
                  <button
                    type="submit"
                    disabled={isLoading || !password.trim()}
                    className={`w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 group ${isLoading || !password.trim() ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <span className="tracking-wide text-sm">{isLoading ? 'Creating Account...' : 'Create Account'}</span>
                    {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                  </button>
                </form>
              </div>
            ) : (
              // Set Direct Login Password Step (After OTP Verification for Google Auth new users)
              <div className="p-6 sm:p-8">
                <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                  <Key className="w-6 h-6" />
                </div>
                <div className="mb-5 text-center">
                  <h3 className={`text-xl font-bold text-slate-900 mb-1.5 ${styles.serifHeading}`}>
                    Set Your Login Password
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Verified! Set a personal password so you can log in directly with your email or mobile number anytime.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 p-2.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 font-semibold text-center">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSetPasswordSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider pl-1 flex items-center justify-between">
                      <span>Enter Password</span>
                      <span className="text-[10px] lowercase text-slate-400 font-normal">min 8 chars</span>
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <input 
                        type={showDirectPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={directPassword}
                        onChange={(e) => setDirectPassword(e.target.value)}
                        placeholder="Enter Your Password" 
                        className="block w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl text-base sm:text-sm bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDirectPassword(!showDirectPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                        title={showDirectPassword ? 'Hide password' : 'Show password'}
                      >
                        {showDirectPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="authRememberAlways"
                      checked={rememberAlways}
                      onChange={(e) => setRememberAlways(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="authRememberAlways" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                      Remember always for easy login
                    </label>
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={isLoading || !directPassword.trim()}
                    className={`w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 group ${isLoading || !directPassword.trim() ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <span className="tracking-wide text-sm">{isLoading ? 'Saving Password...' : 'Save Password & Continue'}</span>
                    {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <button 
                    type="button" 
                    onClick={() => {
                      if (verifiedUser) doLogin(verifiedUser);
                    }}
                    className="text-[11px] font-bold text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    Skip for now & Continue &rarr;
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </section>
  );
};
