import { conciergeWhatsAppLink } from "../../../config/contact";
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Key,
  Loader2,
  Mail,
  MessageCircle,
  Smartphone,
} from 'lucide-react';
import { BrandLogo } from '../../../components/layout/BrandLogo';
import { useUI } from '../../../context';
import { SellerLoginHero } from './SellerLoginHero';
import { SellerTypePicker } from './SellerTypePicker';
import { SELLER_AUTH_STYLES, SellerPasswordField, SellerTextField } from './SellerAuthFields';
import { getSellerLoginTheme } from './sellerLoginThemes';
import { sellerLoginService } from './sellerLoginService';

type Step = 'identify' | 'password' | 'forgot' | 'reset';

const RESEND_SECONDS = 30;
const CODE_LENGTH = 6;
const MIN_PASSWORD = 6;

const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const looksLikePhone = (value: string) => !value.includes('@') && value.replace(/\D/g, '').length >= 10;
const isValidIdentifier = (value: string) => looksLikeEmail(value) || looksLikePhone(value);

const PRIMARY_BUTTON =
  'seller-primary flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white';

/**
 * Seller sign-in (design only for now: it talks to ./sellerLoginService, which is a stand-in until the seller API exists).
 * Steps: type the email / mobile number -> we check the account exists -> password -> in.
 * Forgot password: number / email -> code -> new password.
 * The colours, picture and words follow the kind of seller (./sellerLoginThemes); open it with ?type=flowers-plants to preselect one.
 */
export const SellerLoginPage: React.FC = () => {
  const { showToast } = useUI();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const theme = getSellerLoginTheme(params.get('type'));

  const [step, setStep] = useState<Step>('identify');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const themeVars = useMemo(
    () =>
      ({
        '--seller-accent': theme.accent,
        '--seller-accent-dark': theme.accentDark,
        '--seller-soft': theme.soft,
      }) as React.CSSProperties,
    [theme]
  );

  const typed = identifier.trim();
  const IdentifierIcon = looksLikePhone(typed) ? Smartphone : Mail;

  // The resend countdown on the code screen
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((left) => left - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  const goTo = (next: Step) => {
    setError(null);
    setStep(next);
  };

  const chooseTheme = (themeId: string) => {
    const next = new URLSearchParams(params);
    next.set('type', themeId);
    setParams(next, { replace: true });
  };

  // Runs one screen's action: shows the spinner, and any error as a readable line
  const run = async (action: () => Promise<void>, fallback: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : fallback);
    } finally {
      setIsLoading(false);
    }
  };

  const notFoundToast = () =>
    showToast({
      tone: 'warning',
      title: 'Seller account not found',
      description: 'No seller account has this email or number. Please register your store first.',
    });

  const handleIdentify = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidIdentifier(typed)) {
      setError('Enter a valid email address or 10-digit mobile number');
      return;
    }
    void run(async () => {
      const result = await sellerLoginService.identify(typed);
      if (result.status === 'not_found') {
        notFoundToast();
        return;
      }
      setPassword('');
      setStep('password');
    }, 'Could not check this account. Please try again.');
  };

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError('Enter your password');
      return;
    }
    void run(async () => {
      await sellerLoginService.login({ identifier: typed, password });
      navigate('/seller/dashboard', { replace: true });
    }, 'Could not sign in. Please check your password.');
  };

  const sendCode = () =>
    run(async () => {
      const result = await sellerLoginService.sendResetCode(typed);
      if (result.status === 'not_found') {
        notFoundToast();
        return;
      }
      setSentTo(result.sentTo ?? '');
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
      setSecondsLeft(RESEND_SECONDS);
      setStep('reset');
    }, 'Could not send the code. Please try again.');

  const handleForgot = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidIdentifier(typed)) {
      setError('Enter a valid email address or 10-digit mobile number');
      return;
    }
    void sendCode();
  };

  const handleReset = (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length < CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code`);
      return;
    }
    if (newPassword.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The two passwords do not match');
      return;
    }
    void run(async () => {
      await sellerLoginService.resetPassword({ identifier: typed, otp: code, newPassword });
      setPassword('');
      showToast({ title: 'Password changed', description: 'Sign in with your new password.' });
      setStep('password');
    }, 'Could not reset the password. Please check the code.');
  };

  const errorLine = error && (
    <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-600">
      <AlertCircle className="mt-px h-4 w-4 shrink-0" /> {error}
    </p>
  );

  const spinnerOr = (label: string) =>
    isLoading ? (
      <>
        <Loader2 className="h-4 w-4 animate-spin" /> Please wait...
      </>
    ) : (
      <>
        {label} <ArrowRight className="h-4 w-4" />
      </>
    );

  const backLink = (label: string, to: Step) => (
    <button
      type="button"
      onClick={() => goTo(to)}
      className="mx-auto mt-5 flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-500 transition hover:text-slate-800"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> {label}
    </button>
  );

  return (
    <div className="min-h-dvh bg-white font-body text-ink lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]" style={themeVars}>
      <style>{SELLER_AUTH_STYLES}</style>

      <SellerLoginHero theme={theme} />

      <main className="flex min-w-0 flex-col px-4 pb-8 pt-5 sm:px-8 lg:px-14 lg:py-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Link to="/" aria-label="Nyochavar home" className="shrink-0">
              <BrandLogo size="md" />
            </Link>
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider sm:text-[11px]"
              style={{ backgroundColor: theme.soft, color: theme.accent }}
            >
              Seller Hub
            </span>
          </div>
          <Link to="/" className="text-xs font-semibold text-slate-500 transition hover:text-slate-900">
            Back to store
          </Link>
        </header>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 py-6 sm:py-8">
          <SellerTypePicker theme={theme} onChange={chooseTheme} />

          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.25)] sm:p-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                {step === 'identify' && (
                  <form onSubmit={handleIdentify} className="space-y-5" noValidate>
                    <div>
                      <h1 className="font-serif text-2xl text-ink sm:text-[1.7rem]">Seller sign in</h1>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                        Enter the email or mobile number of your {theme.label.toLowerCase()} store.
                      </p>
                    </div>
                    {errorLine}
                    <SellerTextField
                      id="seller-identifier"
                      label="Email or mobile number"
                      icon={<IdentifierIcon className="h-4 w-4" />}
                      value={identifier}
                      onChange={(event) => {
                        setIdentifier(event.target.value);
                        setError(null);
                      }}
                      placeholder="you@store.com or 9876543210"
                      autoComplete="username"
                      inputMode="email"
                      invalid={Boolean(error)}
                      autoFocus
                    />
                    <button type="submit" disabled={isLoading} className={PRIMARY_BUTTON}>
                      {spinnerOr('Continue')}
                    </button>
                    <p className="text-center text-xs text-slate-500">
                      New to Nyochavar?{' '}
                      <Link to="/seller/register" className="seller-link font-bold">
                        Register your store
                      </Link>
                    </p>
                  </form>
                )}

                {step === 'password' && (
                  <form onSubmit={handleLogin} className="space-y-5" noValidate>
                    <div>
                      <h1 className="font-serif text-2xl text-ink sm:text-[1.7rem]">Welcome back</h1>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">Enter your password to open your seller dashboard.</p>
                    </div>
                    <div
                      className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5"
                      style={{ backgroundColor: theme.soft }}
                    >
                      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800">
                        <IdentifierIcon className="h-4 w-4 shrink-0" style={{ color: theme.accent }} />
                        <span className="truncate">{typed}</span>
                      </span>
                      <button type="button" onClick={() => goTo('identify')} className="seller-link shrink-0 cursor-pointer text-xs font-bold">
                        Change
                      </button>
                    </div>
                    {errorLine}
                    <SellerPasswordField
                      id="seller-password"
                      label="Password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setError(null);
                      }}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      invalid={Boolean(error)}
                      autoFocus
                      labelAction={
                        <button type="button" onClick={() => goTo('forgot')} className="seller-link cursor-pointer text-[11px] font-bold">
                          Forgot password?
                        </button>
                      }
                    />
                    <button type="submit" disabled={isLoading} className={PRIMARY_BUTTON}>
                      {spinnerOr('Sign in')}
                    </button>
                  </form>
                )}

                {step === 'forgot' && (
                  <form onSubmit={handleForgot} className="space-y-5" noValidate>
                    <div>
                      <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl" style={{ backgroundColor: theme.soft, color: theme.accent }}>
                        <Key className="h-5 w-5" />
                      </span>
                      <h1 className="font-serif text-2xl text-ink sm:text-[1.7rem]">Forgot password?</h1>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                        Enter your email or mobile number. If a seller account has it, we send a code: on WhatsApp for a number, by email for an email.
                      </p>
                    </div>
                    {errorLine}
                    <SellerTextField
                      id="seller-forgot-identifier"
                      label="Email or mobile number"
                      icon={<IdentifierIcon className="h-4 w-4" />}
                      value={identifier}
                      onChange={(event) => {
                        setIdentifier(event.target.value);
                        setError(null);
                      }}
                      placeholder="you@store.com or 9876543210"
                      autoComplete="username"
                      invalid={Boolean(error)}
                      autoFocus
                    />
                    <button type="submit" disabled={isLoading} className={PRIMARY_BUTTON}>
                      {spinnerOr('Send code')}
                    </button>
                    {backLink('Back to sign in', 'identify')}
                  </form>
                )}

                {step === 'reset' && (
                  <form onSubmit={handleReset} className="space-y-5" noValidate>
                    <div>
                      <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl" style={{ backgroundColor: theme.soft, color: theme.accent }}>
                        <MessageCircle className="h-5 w-5" />
                      </span>
                      <h1 className="font-serif text-2xl text-ink sm:text-[1.7rem]">Create a new password</h1>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                        We sent a {CODE_LENGTH}-digit code to <span className="font-bold text-slate-800">{sentTo}</span>. Enter it below with your new password.
                      </p>
                    </div>
                    {errorLine}
                    <SellerTextField
                      id="seller-code"
                      label="Verification code"
                      icon={<Key className="h-4 w-4" />}
                      value={code}
                      onChange={(event) => {
                        setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH));
                        setError(null);
                      }}
                      placeholder={'•'.repeat(CODE_LENGTH)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={CODE_LENGTH}
                      invalid={Boolean(error) && code.length < CODE_LENGTH}
                      autoFocus
                      labelAction={
                        <button
                          type="button"
                          onClick={() => void sendCode()}
                          disabled={secondsLeft > 0 || isLoading}
                          className="seller-link cursor-pointer text-[11px] font-bold disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                        >
                          {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend code'}
                        </button>
                      }
                    />
                    <SellerPasswordField
                      id="seller-new-password"
                      label="New password"
                      value={newPassword}
                      onChange={(event) => {
                        setNewPassword(event.target.value);
                        setError(null);
                      }}
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                    />
                    <SellerPasswordField
                      id="seller-confirm-password"
                      label="Confirm password"
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        setError(null);
                      }}
                      placeholder="Type it once more"
                      autoComplete="new-password"
                    />
                    <button type="submit" disabled={isLoading} className={PRIMARY_BUTTON}>
                      {spinnerOr('Reset password')}
                    </button>
                    {backLink('Back to sign in', 'password')}
                  </form>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400">
          Need help?{' '}
          <a
            href={conciergeWhatsAppLink("Hi Nyochavar, I need help signing in to my seller account.")}
            target="_blank"
            rel="noopener noreferrer"
            className="seller-link font-semibold"
          >
            Contact seller support
          </a>
        </p>
      </main>
    </div>
  );
};

export default SellerLoginPage;
