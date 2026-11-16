import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Power,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { whatsappService } from '../../../../services/whatsappService';
import { Badge, Button, Card, Input, Label, Switch, cx } from '../../../components/ui';

interface WhatsappBotSettingsProps {
  notify: (message: string, tone?: 'success' | 'danger') => void;
}

export const WhatsappBotSettings: React.FC<WhatsappBotSettingsProps> = ({ notify }) => {
  const [botStatus, setBotStatus] = useState<{
    status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected';
    qrCode: string | null;
    phone: string | null;
    error: string | null;
  }>({
    status: 'disconnected',
    qrCode: null,
    phone: null,
    error: null,
  });

  const [settings, setSettings] = useState<{
    active_provider: 'whatsapp' | 'firebase' | 'both' | 'disabled';
    whatsapp_enabled: boolean;
    firebase_enabled: boolean;
    otp_expiry_minutes: number;
    max_attempts: number;
  }>({
    active_provider: 'whatsapp',
    whatsapp_enabled: true,
    firebase_enabled: false,
    otp_expiry_minutes: 5,
    max_attempts: 5,
  });

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [connectingBot, setConnectingBot] = useState(false);

  // Pairing code linking states
  const [connectMethod, setConnectMethod] = useState<'pairing' | 'qr'>('pairing');
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await whatsappService.getBotStatus();
      setBotStatus(res);
      if (res?.status === 'connected') {
        setPairingCode(null);
      }
    } catch {
      // Background poll failure
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statusRes, settingsRes] = await Promise.all([
        whatsappService.getBotStatus(),
        whatsappService.getVerificationSettings(),
      ]);
      if (statusRes) setBotStatus(statusRes);
      if (settingsRes) setSettings(settingsRes);
    } catch (err: any) {
      notify(err.message || 'Failed to load verification settings', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const timer = setTimeout(() => {
      fetchStatus();
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Poll status while connecting, awaiting QR scan, or awaiting pairing code entry
  useEffect(() => {
    if (botStatus.status === 'connecting' || botStatus.status === 'qr_ready' || pairingCode) {
      const timer = setInterval(fetchStatus, 3500);
      return () => clearInterval(timer);
    }
  }, [botStatus.status, pairingCode]);

  const handleConnect = async () => {
    setConnectingBot(true);
    try {
      const res = await whatsappService.connectBot();
      setBotStatus({
        status: (res.status as any) || 'connecting',
        qrCode: res.qrCode,
        phone: res.phone,
        error: null,
      });
      if (res.status === 'connected') {
        notify(`WhatsApp bot connected! Account: ${res.phone || ''}`, 'success');
      } else {
        notify('WhatsApp bot initialized. Please scan the QR code.');
      }
    } catch (err: any) {
      notify(err.message || 'Failed to initialize WhatsApp connection', 'danger');
    } finally {
      setConnectingBot(false);
    }
  };

  const handleRequestPairingCode = async () => {
    if (!pairingPhone.trim()) {
      notify('Please enter your WhatsApp business phone number.', 'danger');
      return;
    }
    setGeneratingCode(true);
    try {
      const res = await whatsappService.getPairingCode(pairingPhone);
      if (res.pairingCode) {
        setPairingCode(res.pairingCode);
        notify('Pairing code generated! Enter this code on your WhatsApp app.', 'success');
      }
    } catch (err: any) {
      notify(err.message || 'Failed to generate pairing code. Please try again.', 'danger');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode.replace(/-/g, ''));
    setCopiedCode(true);
    notify('Pairing code copied to clipboard!', 'success');
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleDisconnect = async () => {
    try {
      await whatsappService.disconnectBot();
      setBotStatus({
        status: 'disconnected',
        qrCode: null,
        phone: null,
        error: null,
      });
      setPairingCode(null);
      notify('WhatsApp bot disconnected.');
    } catch (err: any) {
      notify(err.message || 'Failed to disconnect WhatsApp bot', 'danger');
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const saved = await whatsappService.updateVerificationSettings(settings);
      setSettings(saved);
      notify('Verification settings updated successfully!');
    } catch (err: any) {
      notify(err.message || 'Failed to update verification settings', 'danger');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-500">Loading verification settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 1. Master Verification Provider Controls */}
      <Card className="space-y-5 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-900">Mobile Verification Engine</p>
              <p className="text-xs text-slate-500">
                Choose which service verifies customer mobile numbers during signup and checkout.
              </p>
            </div>
          </div>
          <Badge tone={settings.active_provider === 'disabled' ? 'neutral' : 'success'}>
            {settings.active_provider === 'disabled' ? 'Disabled' : `Active: ${settings.active_provider.toUpperCase()}`}
          </Badge>
        </div>

        <div>
          <Label>Active OTP Provider</Label>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { id: 'whatsapp', label: 'WhatsApp Bot (Free)', desc: '100% Free, sends OTP via WhatsApp' },
              { id: 'firebase', label: 'Firebase SMS (Free Tier)', desc: '10k Free SMS/mo to real phone' },
              { id: 'both', label: 'Both (Hybrid)', desc: 'WhatsApp primary, SMS fallback' },
              { id: 'disabled', label: 'Disabled', desc: 'No phone verification required' },
            ].map((p) => {
              const active = settings.active_provider === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, active_provider: p.id as any }))}
                  className={cx(
                    'flex flex-col items-start rounded-xl border p-3 text-left transition',
                    active ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <span className={cx('text-xs font-bold', active ? 'text-blue-700' : 'text-slate-800')}>{p.label}</span>
                  <span className="mt-1 text-[11px] text-slate-500">{p.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div>
              <p className="text-xs font-semibold text-slate-800">WhatsApp OTP</p>
              <p className="text-[11px] text-slate-500">Allow WhatsApp channel</p>
            </div>
            <Switch
              checked={settings.whatsapp_enabled}
              onChange={(next) => setSettings((s) => ({ ...s, whatsapp_enabled: next }))}
              label="WhatsApp OTP on or off"
              showLabel
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div>
              <p className="text-xs font-semibold text-slate-800">Firebase SMS</p>
              <p className="text-[11px] text-slate-500">Allow SMS channel</p>
            </div>
            <Switch
              checked={settings.firebase_enabled}
              onChange={(next) => setSettings((s) => ({ ...s, firebase_enabled: next }))}
              label="Firebase SMS on or off"
              showLabel
            />
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <Label htmlFor="otp-exp">OTP Validity (Minutes)</Label>
            <Input
              id="otp-exp"
              type="number"
              min={1}
              max={30}
              value={settings.otp_expiry_minutes}
              onChange={(e) => setSettings((s) => ({ ...s, otp_expiry_minutes: Math.max(1, parseInt(e.target.value) || 5) }))}
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            variant="primary"
            disabled={savingSettings}
            onClick={handleSaveSettings}
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          >
            {savingSettings ? 'Saving...' : 'Save Verification Settings'}
          </Button>
        </div>
      </Card>

      {/* 2. Automated WhatsApp Bot Status & Linking */}
      <Card className="space-y-5 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-900">Automated WhatsApp Bot</p>
              <p className="text-xs text-slate-500">
                Sends OTPs & notifications automatically in the background without manual human clicking.
              </p>
            </div>
          </div>

          <div>
            {botStatus.status === 'connected' && (
              <Badge tone="success" className="gap-1.5 py-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Connected {botStatus.phone ? `(+${botStatus.phone})` : ''}
              </Badge>
            )}
            {botStatus.status === 'qr_ready' && <Badge tone="warning">Scan QR Code</Badge>}
            {botStatus.status === 'connecting' && <Badge tone="neutral">Connecting...</Badge>}
            {botStatus.status === 'disconnected' && <Badge tone="neutral">Disconnected</Badge>}
          </div>
        </div>

        {/* State A: Connected */}
        {botStatus.status === 'connected' ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 text-center sm:text-left">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-950">WhatsApp Bot is Active & Automated</h4>
                  <p className="text-xs text-emerald-700">
                    Linked to WhatsApp number: <span className="font-mono font-bold">+{botStatus.phone}</span>. Customer OTP messages & order alerts are dispatched automatically.
                  </p>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={handleDisconnect} icon={<Power className="h-3.5 w-3.5 text-red-500" />}>
                Disconnect Number
              </Button>
            </div>
          </div>
        ) : (
          /* State B & C: Unconnected / Link device interface */
          <div className="space-y-5">
            {/* Connection Method Switcher */}
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setConnectMethod('pairing')}
                className={cx(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition',
                  connectMethod === 'pairing'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                Link with Phone Number (Pairing Code) ⚡
              </button>
              <button
                type="button"
                onClick={() => setConnectMethod('qr')}
                className={cx(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition',
                  connectMethod === 'qr'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <QrCode className="h-3.5 w-3.5 text-blue-600" />
                Scan QR Code (Camera)
              </button>
            </div>

            {/* METHOD 1: PAIRING CODE (100% Reliable, solves "Couldn't link device") */}
            {connectMethod === 'pairing' ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5 space-y-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                      Recommended
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">
                      Link WhatsApp with 8-Digit Pairing Code
                    </h4>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    No camera QR scanning needed. WhatsApp connects directly using an official 8-digit verification code.
                  </p>
                </div>

                {!pairingCode ? (
                  /* Step 1: Input phone number to request pairing code */
                  <div className="max-w-md space-y-3">
                    <Label htmlFor="bot-phone">WhatsApp Business Number</Label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                        +91
                      </div>
                      <Input
                        id="bot-phone"
                        type="tel"
                        value={pairingPhone}
                        onChange={(e) => setPairingPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 9876543210"
                        className="font-mono text-sm tracking-wider"
                      />
                    </div>
                    <Button
                      variant="primary"
                      disabled={generatingCode || !pairingPhone.trim()}
                      onClick={handleRequestPairingCode}
                      icon={generatingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      className="w-full sm:w-auto"
                    >
                      {generatingCode ? 'Generating Code from WhatsApp...' : 'Get 8-Digit Pairing Code ⚡'}
                    </Button>
                  </div>
                ) : (
                  /* Step 2: Show generated pairing code + instructions */
                  <div className="space-y-4">
                    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-300 bg-white p-6 shadow-sm">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">
                        Your WhatsApp Pairing Code
                      </p>
                      <div className="my-3 flex items-center gap-3">
                        <span className="font-mono text-3xl sm:text-4xl font-extrabold tracking-widest text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200">
                          {pairingCode}
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handleCopyCode}
                          icon={copiedCode ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        >
                          {copiedCode ? 'Copied!' : 'Copy'}
                        </Button>
                      </div>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />
                        Waiting for you to enter this code on your phone... Updates automatically.
                      </p>
                    </div>

                    {/* Step-by-step instructions */}
                    <div className="rounded-xl bg-slate-900 p-4 text-white">
                      <p className="text-xs font-bold text-emerald-400 mb-2">
                        How to enter this code on WhatsApp (Takes 10 seconds):
                      </p>
                      <ol className="space-y-1.5 text-xs text-slate-200 list-decimal list-inside">
                        <li>Open <b>WhatsApp</b> on your phone (+91 {pairingPhone}).</li>
                        <li>Tap <b>Settings</b> (on iPhone) or <b>⋮ Three Dots</b> (on Android) ➡️ <b>Linked Devices</b>.</li>
                        <li>Tap <b>Link a Device</b>.</li>
                        <li>
                          At the bottom of the camera screen, tap{' '}
                          <span className="font-bold text-emerald-300 underline">
                            "Link with phone number instead"
                          </span>.
                        </li>
                        <li>
                          Enter code <span className="font-mono font-bold text-amber-300">{pairingCode}</span>.
                        </li>
                      </ol>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setPairingCode(null)}
                      >
                        Try Different Number
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleRequestPairingCode}
                        disabled={generatingCode}
                        icon={<RefreshCw className="h-3.5 w-3.5" />}
                      >
                        {generatingCode ? 'Refreshing...' : 'Regenerate Code'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* METHOD 2: QR CODE SCAN */
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
                {botStatus.status === 'qr_ready' && botStatus.qrCode ? (
                  <div className="space-y-4 text-center">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Scan QR Code with WhatsApp</h4>
                      <p className="mt-1 text-xs text-slate-600">
                        1. Open WhatsApp ➡️ 2. Tap <b>Settings / Menu (⋮)</b> ➡️ 3. Tap <b>Linked Devices</b> ➡️ 4. Scan this QR code
                      </p>
                    </div>

                    <div className="flex flex-col items-center justify-center p-2">
                      <div className="rounded-2xl border-4 border-white bg-white p-3 shadow-md">
                        <img src={botStatus.qrCode} alt="WhatsApp QR Code" className="h-60 w-60 object-contain" />
                      </div>
                      <p className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin text-blue-600" /> Waiting for scan... Updates automatically once linked.
                      </p>
                    </div>

                    <div className="flex justify-center gap-2">
                      <Button size="sm" onClick={handleConnect} icon={<RefreshCw className="h-3.5 w-3.5" />}>
                        Refresh QR
                      </Button>
                      <Button size="sm" variant="secondary" onClick={handleDisconnect}>
                        Cancel
                      </Button>
                    </div>

                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800 text-left">
                      💡 <b>Camera scan showing "Couldn't link device"?</b> WhatsApp blocks cloud camera scans on some phones. Use the{' '}
                      <button
                        type="button"
                        onClick={() => setConnectMethod('pairing')}
                        className="font-bold underline text-amber-950"
                      >
                        "Link with Phone Number (Pairing Code)"
                      </button>{' '}
                      tab instead — it links with 100% success!
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <QrCode className="mx-auto h-10 w-10 text-slate-400" />
                    <h4 className="mt-2 text-sm font-bold text-slate-900">QR Code Scanner</h4>
                    <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
                      Click below to generate a QR code and scan it with your phone's WhatsApp camera.
                    </p>

                    {botStatus.error && (
                      <div className="mx-auto mt-3 flex max-w-md items-center gap-2 rounded-lg bg-red-50 p-2 text-left text-xs text-red-600">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{botStatus.error}</span>
                      </div>
                    )}

                    <div className="mt-4 flex justify-center">
                      <Button
                        variant="primary"
                        disabled={connectingBot}
                        onClick={handleConnect}
                        icon={connectingBot ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                      >
                        {connectingBot ? 'Initializing Bot...' : 'Generate WhatsApp QR Code'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};


