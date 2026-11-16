import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  Mail,
  RefreshCw,
  Save,
  ShieldCheck,
  Smartphone,
  Sparkles,
  User,
} from 'lucide-react';
import { whatsappService } from '../../../../services/whatsappService';
import { Badge, Button, Card, Label, Switch, cx } from '../../../components/ui';

interface VerificationSettings {
  active_provider: 'whatsapp' | 'firebase' | 'both' | 'disabled';
  whatsapp_enabled: boolean;
  firebase_enabled: boolean;
  otp_expiry_minutes: number;
  max_attempts: number;
}

interface UserLoginSettingsTabProps {
  notify?: (message: string, tone?: 'success' | 'danger') => void;
  onNavigateToBot?: () => void;
}

export const UserLoginSettingsTab: React.FC<UserLoginSettingsTabProps> = ({
  notify = (_message: string, _tone?: 'success' | 'danger') => {},
  onNavigateToBot,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<VerificationSettings>({
    active_provider: 'whatsapp',
    whatsapp_enabled: true,
    firebase_enabled: false,
    otp_expiry_minutes: 5,
    max_attempts: 5,
  });

  const [botStatus, setBotStatus] = useState<{
    status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected';
    phone: string | null;
  }>({
    status: 'disconnected',
    phone: null,
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const [settingsRes, botRes] = await Promise.all([
        whatsappService.getVerificationSettings(),
        whatsappService.getBotStatus().catch(() => null),
      ]);
      if (settingsRes) setSettings(settingsRes);
      if (botRes) setBotStatus(botRes);
    } catch (err: any) {
      notify(err.message || 'Failed to load user verification settings', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Saves the given settings. The screen shows them at once; if the save fails they go back to what they were,
  // so a switch never shows a state that is not really stored.
  const persist = async (next: VerificationSettings) => {
    const previous = settings;
    setSettings(next);
    setSaving(true);
    try {
      const updated = await whatsappService.updateVerificationSettings(next);
      setSettings(updated);
      notify(
        `Settings updated! Create Account page will now use ${
          updated.whatsapp_enabled && updated.active_provider !== 'disabled'
            ? 'WhatsApp Mobile verification'
            : 'Email verification'
        }.`,
        'success'
      );
    } catch (err: any) {
      setSettings(previous);
      notify(err.message || 'Failed to save verification settings', 'danger');
    } finally {
      setSaving(false);
    }
  };

  // A switch is saved as soon as it is pressed (before, it only changed the screen and was lost on refresh)
  const handleToggleWhatsApp = (enabled: boolean) => {
    if (saving) return;
    void persist({
      ...settings,
      whatsapp_enabled: enabled,
      active_provider: enabled ? 'whatsapp' : 'disabled',
    });
  };

  const handleSave = () => persist(settings);

  const isWhatsAppActive = settings.whatsapp_enabled && settings.active_provider !== 'disabled';

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">
        Loading User Login & Verification settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Card className="p-5 sm:p-6 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white border-blue-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  User Registration & Login Controls
                </h3>
                <Badge tone={isWhatsAppActive ? 'success' : 'neutral'}>
                  {isWhatsAppActive ? '🟢 WhatsApp Mode Active' : '✉️ Email Mode Active'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Toggle between WhatsApp Mobile verification and Email verification for the customer
                Create Account page.
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            disabled={saving}
            onClick={handleSave}
            icon={<Save className="h-4 w-4" />}
            className="self-start sm:self-auto"
          >
            {saving ? 'Saving Changes...' : 'Save Settings'}
          </Button>
        </div>
      </Card>

      {/* Main Grid: Controls on Left, Live Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Toggles (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Option 1: WhatsApp Mobile Verification */}
          <Card
            className={cx(
              'p-5 transition-all border-2',
              isWhatsAppActive
                ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/10'
                : 'border-slate-200 bg-white hover:border-slate-300'
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={cx(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                    isWhatsAppActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-500'
                  )}
                >
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      WhatsApp Mobile OTP Verification
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Recommended
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Shoppers register with their <b>Full Name</b> and <b>Mobile Number (+91)</b>.
                    A 6-digit OTP code is sent automatically via your WhatsApp Bot.
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-medium text-slate-600 border border-slate-200">
                      ⚡ Instant delivery
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-medium text-slate-600 border border-slate-200">
                      💰 100% Free (No SMS bills)
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-medium text-slate-600 border border-slate-200">
                      📦 Direct delivery updates
                    </span>
                  </div>

                  {botStatus.status === 'connected' ? (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      Bot Connected (+{botStatus.phone})
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-amber-700 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" /> Bot Offline
                      </span>
                      {onNavigateToBot && (
                        <button
                          type="button"
                          onClick={onNavigateToBot}
                          className="text-xs text-blue-600 font-semibold underline hover:text-blue-800"
                        >
                          Link WhatsApp Bot ➔
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className={cx('shrink-0 pt-1 transition-opacity', saving && 'pointer-events-none opacity-60')}>
                <Switch
                  checked={isWhatsAppActive}
                  onChange={handleToggleWhatsApp}
                  label="WhatsApp OTP Toggle"
                  showLabel
                />
              </div>
            </div>
          </Card>

          {/* Option 2: Email Verification */}
          <Card
            className={cx(
              'p-5 transition-all border-2',
              !isWhatsAppActive
                ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/10'
                : 'border-slate-200 bg-white hover:border-slate-300'
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={cx(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                    !isWhatsAppActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-500'
                  )}
                >
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      Traditional Email Verification
                    </span>
                    {!isWhatsAppActive && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                        Active Mode
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Shoppers register with their <b>Full Name</b> and <b>Email Address</b>.
                    A 4-digit OTP code is sent to their email inbox via SMTP.
                  </p>

                  <p className="mt-2 text-[11px] text-slate-400">
                    Active whenever WhatsApp verification is turned off.
                  </p>
                </div>
              </div>

              <div className={cx('shrink-0 pt-1 transition-opacity', saving && 'pointer-events-none opacity-60')}>
                <Switch
                  checked={!isWhatsAppActive}
                  onChange={(checked) => handleToggleWhatsApp(!checked)}
                  label="Email Verification Toggle"
                  showLabel
                />
              </div>
            </div>
          </Card>

          {/* Helper notice */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Dynamic UI Behavior:
            </p>
            <p>
              When WhatsApp is <b>ON</b>, the Create Account page at{' '}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-700 border">
                /auth
              </code>{' '}
              asks for Full Name + Mobile Number (+91) with WhatsApp badge.
            </p>
            <p>
              When WhatsApp is <b>OFF</b>, it automatically reverts to Full Name + Email Address.
            </p>
          </div>
        </div>

        {/* Right Column: Interactive Live Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-blue-600" />
              Live Preview of /auth (Create Account)
            </span>
            <span className="text-[11px] font-medium text-slate-400">
              Updates in real-time
            </span>
          </div>

          <div className="rounded-2xl border-2 border-slate-200 bg-slate-100/70 p-4 shadow-sm">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-md space-y-4">
              {/* Tab Header mock */}
              <div className="flex rounded-lg bg-slate-100 p-1 text-[11px] font-bold">
                <div className="flex-1 py-1 text-center text-slate-400">Sign In</div>
                <div className="flex-1 rounded-md bg-white py-1 text-center text-blue-600 shadow-xs">
                  Create Account
                </div>
              </div>

              {/* Title */}
              <div>
                <h4 className="text-base font-bold text-slate-900">Create an Account</h4>
                <p className="text-[11px] text-slate-500">
                  {isWhatsAppActive
                    ? 'Enter your mobile number to get started via WhatsApp.'
                    : 'Enter your email address to get started.'}
                </p>
              </div>

              {/* Google signup mock */}
              <div className="rounded-xl border border-slate-200 py-1.5 text-center text-xs text-slate-600 font-medium">
                Sign up with Google
              </div>

              <div className="text-center text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                Or
              </div>

              {/* Dynamic Inputs Mock */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pl-0.5">
                    Full Name
                  </label>
                  <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-400">
                    <User className="h-3.5 w-3.5 mr-2 text-slate-400" />
                    Enter Name
                  </div>
                </div>

                {isWhatsAppActive ? (
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 pl-0.5">
                        WhatsApp Mobile Number
                      </label>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        WhatsApp OTP
                      </span>
                    </div>
                    <div className="mt-1 flex items-center rounded-xl border-2 border-emerald-500 bg-white overflow-hidden shadow-xs">
                      <div className="bg-emerald-50 text-emerald-800 font-mono font-bold px-2.5 py-2 text-xs border-r border-emerald-200">
                        +91
                      </div>
                      <div className="px-3 py-2 text-slate-800 font-mono font-medium text-xs">
                        98765 43210
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pl-0.5">
                      Email Address
                    </label>
                    <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-400">
                      <Mail className="h-3.5 w-3.5 mr-2 text-slate-400" />
                      you@example.com
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Button Mock */}
              <button
                type="button"
                className={cx(
                  'w-full py-2.5 rounded-xl font-bold text-white text-xs flex items-center justify-center gap-2 shadow-sm transition',
                  isWhatsAppActive
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                )}
              >
                <span>
                  {isWhatsAppActive
                    ? 'Send WhatsApp Verification Code'
                    : 'Send Verification Code'}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
