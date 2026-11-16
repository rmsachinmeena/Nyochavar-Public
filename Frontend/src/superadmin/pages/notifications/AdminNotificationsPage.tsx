import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Loader2, Mail, Megaphone, MessageCircle, Plus, Trash2, RefreshCw, Send, Users, X, Zap } from 'lucide-react';
import { api } from '../../../services/api';
import { notificationService } from '../../../services/notificationService';
import { whatsappService, WHATSAPP_PLACEHOLDERS, BUILT_IN_WHATSAPP_TEMPLATES, OTP_PLACEHOLDERS, OTP_TEMPLATE_KEY } from '../../../services/whatsappService';
import type { WhatsappLogEntry, WhatsappTemplate } from '../../../services/whatsappService';
import type { NotificationBroadcast, NotificationTemplate } from '../../../services/notificationService';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Input, Label, Modal, PageHeader, SearchInput, Switch, Textarea, Toast, cx } from '../../components/ui';
import { WhatsappBotSettings } from './components/WhatsappBotSettings';
import { TemplateImagePicker, WhatsappPreview } from './components/TemplateImagePicker';

type Tab = 'send' | 'triggers' | 'whatsapp' | 'history';

interface Customer {
  id: string;
  name?: string;
  email?: string;
  role?: string;
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'send', label: 'Send message', icon: <Send className="h-4 w-4" /> },
  { id: 'triggers', label: 'Automatic triggers', icon: <Zap className="h-4 w-4" /> },
  { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="h-4 w-4" /> },
  { id: 'history', label: 'History', icon: <Megaphone className="h-4 w-4" /> },
];

const PLACEHOLDERS = ['{{name}}', '{{order_number}}', '{{products}}', '{{amount}}', '{{delivery_slot}}', '{{rider_name}}', '{{delivery_otp}}'];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// ---------------------------------------------------------------------------
// Tab 1: send a message to one customer, some customers or everyone
// ---------------------------------------------------------------------------
const SendTab: React.FC<{ notify: (message: string, tone?: 'success' | 'danger') => void; onSent: () => void }> = ({ notify, onSent }) => {
  const [audience, setAudience] = useState<'all' | 'selected'>('all');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [channels, setChannels] = useState<{ in_app: boolean; email: boolean }>({ in_app: true, email: false });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (audience !== 'selected' || customers.length > 0) return;
    setCustomersLoading(true);
    api
      .getAllUsers()
      .then((res: any) => setCustomers((res.users || []).filter((user: Customer) => (user.role || 'buyer') === 'buyer')))
      .catch((err: any) => notify(err.message || 'Could not load customers', 'danger'))
      .finally(() => setCustomersLoading(false));
  }, [audience]);

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    const chosen = new Set(selected.map((user) => user.id));
    return customers
      .filter((user) => !chosen.has(user.id) && `${user.name || ''} ${user.email || ''}`.toLowerCase().includes(term))
      .slice(0, 6);
  }, [search, customers, selected]);

  const canReview = title.trim() && message.trim() && (audience === 'all' || selected.length > 0);

  const send = async () => {
    setSending(true);
    try {
      const chosenChannels = (Object.keys(channels) as ('in_app' | 'email')[]).filter((key) => channels[key]);
      const result = await notificationService.send({
        title: title.trim(),
        message: message.trim(),
        link: link.trim() || undefined,
        audience,
        userIds: audience === 'selected' ? selected.map((user) => user.id) : undefined,
        channels: chosenChannels,
      });
      notify(`Sent to ${result.recipients} customer${result.recipients === 1 ? '' : 's'}`);
      setConfirmOpen(false);
      setTitle('');
      setMessage('');
      setLink('');
      setSelected([]);
      onSent();
    } catch (err: any) {
      notify(err.message || 'Could not send the message', 'danger');
    } finally {
      setSending(false);
    }
  };

  const audienceLabel = audience === 'all' ? 'All customers' : `${selected.length} selected customer${selected.length === 1 ? '' : 's'}`;

  return (
    <Card className="space-y-5 p-4 sm:p-6">
      <div>
        <Label>Who should get it?</Label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-md">
          {([
            { id: 'all', label: 'All customers', icon: <Users className="h-4 w-4" /> },
            { id: 'selected', label: 'Specific customers', icon: <Bell className="h-4 w-4" /> },
          ] as const).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setAudience(option.id)}
              aria-pressed={audience === option.id}
              className={cx(
                'flex h-10 items-center justify-center gap-2 rounded-xl border text-xs font-semibold transition',
                audience === option.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              )}
            >
              {option.icon} {option.label}
            </button>
          ))}
        </div>

        {audience === 'selected' && (
          <div className="mt-3 space-y-2">
            <SearchInput value={search} onChange={setSearch} placeholder={customersLoading ? 'Loading customers...' : 'Search by name or email'} />
            {matches.length > 0 && (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {matches.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected((prev) => [...prev, user]);
                        setSearch('');
                      }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-slate-50"
                    >
                      <span className="font-semibold text-slate-800">{user.name || 'Customer'}</span>
                      <span className="truncate text-slate-500">{user.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.map((user) => (
                  <span key={user.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                    {user.name || user.email}
                    <button type="button" aria-label={`Remove ${user.name || user.email}`} onClick={() => setSelected((prev) => prev.filter((item) => item.id !== user.id))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="notif-title">Title</Label>
        <Input id="notif-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Diwali gifts are live!" />
      </div>
      <div>
        <Label htmlFor="notif-message">Message</Label>
        <Textarea id="notif-message" rows={4} value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} placeholder="Write the message customers will see" />
        <p className="mt-1 text-right text-[11px] text-slate-400">{message.length}/1000</p>
      </div>
      <div>
        <Label htmlFor="notif-link">Link (optional)</Label>
        <Input id="notif-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/catalog or https://..." />
      </div>

      <div className="flex justify-end">
        <Button variant="primary" disabled={!canReview} onClick={() => setConfirmOpen(true)} icon={<Send className="h-4 w-4" />}>
          Review &amp; send
        </Button>
      </div>

      {/* Pop-up: choose where to send it */}
      <Modal
        open={confirmOpen}
        onClose={() => !sending && setConfirmOpen(false)}
        title="Send this message"
        subtitle={`To: ${audienceLabel}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setConfirmOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={sending || (!channels.in_app && !channels.email)}
              onClick={send}
              icon={sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            >
              {sending ? 'Sending...' : 'Send now'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <p className="text-sm font-bold text-slate-900">{title}</p>
            <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600">{message}</p>
          </div>

          <fieldset>
            <legend className="mb-2 text-xs font-bold text-slate-700">Send through</legend>
            <div className="space-y-2">
              {([
                { id: 'in_app', label: 'In-app notification', text: 'Shows in the customer’s Notifications (live if they are online)', icon: <Bell className="h-4 w-4" /> },
                { id: 'email', label: 'Email', text: 'Also email it to each customer', icon: <Mail className="h-4 w-4" /> },
              ] as const).map((option) => (
                <label
                  key={option.id}
                  className={cx(
                    'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition',
                    channels[option.id] ? 'border-blue-600 bg-blue-50/60' : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={channels[option.id]}
                    onChange={(e) => setChannels((prev) => ({ ...prev, [option.id]: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-blue-600">{option.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-slate-800">{option.label}</span>
                    <span className="block text-[11px] text-slate-500">{option.text}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {audience === 'all' && <p className="text-[11px] font-medium text-amber-700">This goes to every customer. Please check the message once more.</p>}
        </div>
      </Modal>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Tab 2: automatic triggers (master switch, per-trigger on/off, editable wording)
// ---------------------------------------------------------------------------
const TriggersTab: React.FC<{ notify: (message: string, tone?: 'success' | 'danger') => void }> = ({ notify }) => {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [automaticEnabled, setAutomaticEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, { title: string; message: string }>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [list, settings] = await Promise.all([notificationService.listTemplates(), notificationService.getSettings()]);
      setTemplates(list);
      setAutomaticEnabled(settings.automatic_enabled !== false);
    } catch (err: any) {
      notify(err.message || 'Could not load triggers', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleMaster = async (next: boolean) => {
    setAutomaticEnabled(next);
    try {
      await notificationService.setAutomaticEnabled(next);
      notify(next ? 'Automatic messages are ON' : 'Automatic messages are OFF');
    } catch (err: any) {
      setAutomaticEnabled(!next);
      notify(err.message || 'Could not update the switch', 'danger');
    }
  };

  const toggleTemplate = async (template: NotificationTemplate, next: boolean) => {
    setTemplates((prev) => prev.map((item) => (item.event_key === template.event_key ? { ...item, is_active: next } : item)));
    try {
      await notificationService.updateTemplate(template.event_key, { is_active: next });
    } catch (err: any) {
      setTemplates((prev) => prev.map((item) => (item.event_key === template.event_key ? { ...item, is_active: !next } : item)));
      notify(err.message || 'Could not update the trigger', 'danger');
    }
  };

  const saveTemplate = async (template: NotificationTemplate) => {
    const draft = drafts[template.event_key];
    if (!draft) return;
    setSavingKey(template.event_key);
    try {
      const saved = await notificationService.updateTemplate(template.event_key, { title: draft.title, message: draft.message });
      setTemplates((prev) => prev.map((item) => (item.event_key === saved.event_key ? saved : item)));
      setDrafts((prev) => {
        const { [template.event_key]: _removed, ...rest } = prev;
        return rest;
      });
      notify('Message saved');
    } catch (err: any) {
      notify(err.message || 'Could not save the message', 'danger');
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading triggers...</div>;

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between gap-4 p-4 sm:p-5">
        <div>
          <p className="text-sm font-bold text-slate-900">Automatic messages</p>
          <p className="mt-0.5 text-xs text-slate-500">Master switch. When off, no trigger below sends anything.</p>
        </div>
        <Switch checked={automaticEnabled} onChange={toggleMaster} label="Automatic messages" showLabel />
      </Card>

      <p className="px-1 text-[11px] text-slate-500">
        You can use these in the text: <span className="font-mono">{PLACEHOLDERS.join('  ')}</span>
      </p>

      {templates.map((template) => {
        const draft = drafts[template.event_key];
        const dirty = Boolean(draft);
        return (
          <Card key={template.event_key} className={cx('space-y-3 p-4 sm:p-5', !template.is_active && 'opacity-70')}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-slate-900">{template.label}</p>
                  <Badge tone="neutral">{template.category}</Badge>
                </div>
                <p className="mt-0.5 font-mono text-[10px] text-slate-400">{template.event_key}</p>
              </div>
              <Switch checked={template.is_active} onChange={(next) => toggleTemplate(template, next)} label={`${template.label} on or off`} showLabel />
            </div>
            <div>
              <Label htmlFor={`t-title-${template.event_key}`}>Title</Label>
              <Input
                id={`t-title-${template.event_key}`}
                value={draft?.title ?? template.title}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [template.event_key]: { title: e.target.value, message: prev[template.event_key]?.message ?? template.message } }))}
              />
            </div>
            <div>
              <Label htmlFor={`t-msg-${template.event_key}`}>Message</Label>
              <Textarea
                id={`t-msg-${template.event_key}`}
                rows={3}
                value={draft?.message ?? template.message}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [template.event_key]: { title: prev[template.event_key]?.title ?? template.title, message: e.target.value } }))}
              />
            </div>
            {dirty && (
              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={() => setDrafts((prev) => { const { [template.event_key]: _removed, ...rest } = prev; return rest; })}>
                  Discard
                </Button>
                <Button size="sm" variant="primary" disabled={savingKey === template.event_key} onClick={() => saveTemplate(template)} icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                  {savingKey === template.event_key ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tab 3: WhatsApp management (Automated Bot & OTP, templates, logs)
// ---------------------------------------------------------------------------
const WhatsappTab: React.FC<{ notify: (message: string, tone?: 'success' | 'danger') => void }> = ({ notify }) => {
  const [view, setView] = useState<'bot' | 'templates' | 'messages'>('bot');
  
  return (
    <div className="space-y-4">
      <div role="tablist" className="inline-flex rounded-full border border-slate-200 bg-white p-1">
        {([
          { id: 'bot', label: 'Automated Bot & OTP' },
          { id: 'templates', label: 'Templates' },
          { id: 'messages', label: 'Message list' },
        ] as const).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={view === item.id}
            onClick={() => setView(item.id)}
            className={cx('rounded-full px-4 py-1.5 text-xs font-semibold transition', view === item.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900')}
          >
            {item.label}
          </button>
        ))}
      </div>

      {view === 'bot' && <WhatsappBotSettings notify={notify} />}
      {view === 'templates' && <WhatsappTemplates notify={notify} />}
      {view === 'messages' && <WhatsappMessageList notify={notify} />}
    </div>
  );
};

// ----- the templates: edit, switch on/off, auto-send bot trigger, add a new one, delete a custom one -----
const WhatsappTemplates: React.FC<{ notify: (message: string, tone?: 'success' | 'danger') => void }> = ({ notify }) => {
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, { name?: string; message?: string }>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newAutoSend, setNewAutoSend] = useState(false);
  const [newImage, setNewImage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<WhatsappTemplate | null>(null);

  useEffect(() => {
    whatsappService
      .listTemplates()
      .then(setTemplates)
      .catch((err: any) => notify(err.message || 'Could not load the WhatsApp templates', 'danger'))
      .finally(() => setLoading(false));
  }, []);

  const toggleTemplate = async (template: WhatsappTemplate, next: boolean) => {
    setTemplates((prev) => prev.map((item) => (item.event_key === template.event_key ? { ...item, is_active: next } : item)));
    try {
      const saved = await whatsappService.updateTemplate(template.event_key, { is_active: next });
      if (saved) {
        setTemplates((prev) => prev.map((item) => (item.event_key === saved.event_key ? { ...item, ...saved } : item)));
      }
    } catch (err: any) {
      setTemplates((prev) => prev.map((item) => (item.event_key === template.event_key ? { ...item, is_active: !next } : item)));
      notify(err.message || 'Could not update the template', 'danger');
    }
  };

  const toggleAutoSend = async (template: WhatsappTemplate, next: boolean) => {
    setTemplates((prev) => prev.map((item) => (item.event_key === template.event_key ? { ...item, auto_send: next } : item)));
    try {
      const saved = await whatsappService.updateTemplate(template.event_key, { auto_send: next });
      if (saved) {
        setTemplates((prev) => prev.map((item) => (item.event_key === saved.event_key ? { ...item, ...saved } : item)));
      }
      notify(`Automated trigger ${next ? 'enabled' : 'disabled'} for ${template.name}`);
    } catch (err: any) {
      setTemplates((prev) => prev.map((item) => (item.event_key === template.event_key ? { ...item, auto_send: !next } : item)));
      notify(err.message || 'Could not update automated trigger setting', 'danger');
    }
  };

  const insertPlaceholder = (eventKey: string, placeholder: string) => {
    const current = drafts[eventKey]?.message ?? templates.find((t) => t.event_key === eventKey)?.message ?? '';
    setDrafts((prev) => ({
      ...prev,
      [eventKey]: {
        ...prev[eventKey],
        message: `${current} *${placeholder}*`.trim(),
      },
    }));
  };
  

  // A picture is saved as soon as it is chosen, removed or replaced
  const changeImage = async (template: WhatsappTemplate, url: string | null) => {
    setSavingKey(`${template.event_key}:image`);
    try {
      const saved = await whatsappService.updateTemplate(template.event_key, { image_url: url });
      setTemplates((prev) => prev.map((item) => (item.event_key === saved.event_key ? { ...item, ...saved } : item)));
      notify(url ? 'Picture saved for this template' : 'Picture removed: only the text will be sent');
    } catch (err: any) {
      notify(err.message || 'Could not save the picture', 'danger');
    } finally {
      setSavingKey(null);
    }
  };

  const insertNewPlaceholder = (placeholder: string) => {
    setNewMessage((prev) => `${prev} *${placeholder}*`.trim());
  };

  const saveTemplate = async (template: WhatsappTemplate) => {
    const draft = drafts[template.event_key];
    if (!draft) return;
    setSavingKey(template.event_key);
    try {
      const payload: Partial<WhatsappTemplate> = {};
      if (draft.name !== undefined) payload.name = draft.name;
      if (draft.message !== undefined) payload.message = draft.message;

      const saved = await whatsappService.updateTemplate(template.event_key, payload);
      setTemplates((prev) => prev.map((item) => (item.event_key === saved.event_key ? { ...item, ...saved } : item)));
      setDrafts((prev) => {
        const { [template.event_key]: _removed, ...rest } = prev;
        return rest;
      });
      notify('WhatsApp template saved successfully');
    } catch (err: any) {
      notify(err.message || 'Could not save the template', 'danger');
    } finally {
      setSavingKey(null);
    }
  };

  const createTemplate = async () => {
    setCreating(true);
    try {
      const created = await whatsappService.createTemplate({
        name: newName.trim(),
        message: newMessage.trim(),
        auto_send: newAutoSend,
        image_url: newImage,
      });
      setTemplates((prev) => [...prev, created]);
      setAdding(false);
      setNewName('');
      setNewMessage('');
      setNewAutoSend(false);
      setNewImage(null);
      notify('New template added successfully');
    } catch (err: any) {
      notify(err.message || 'Could not add the template', 'danger');
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    try {
      await whatsappService.deleteTemplate(target.event_key);
      setTemplates((prev) => prev.filter((item) => item.event_key !== target.event_key));
      notify('Template deleted');
    } catch (err: any) {
      notify(err.message || 'Could not delete the template', 'danger');
    }
  };

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading WhatsApp messages...</div>;

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <p className="text-sm font-bold text-slate-900">How WhatsApp Automation & Triggers work</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          • <b>Auto-Send (Bot) [ON]:</b> Jab bhi order event trigger hoga (Order Confirmed, Rider Assigned, Delivered), connected WhatsApp Bot customer ko <b>automatic</b> message bhej dega.
          <br />
          • <b>Manual [Orders Page]:</b> Orders page par green WhatsApp button hamesha available rahega jisse admin jab chahe click karke bhi message bhej sake.
        </p>
      </Card>

      {templates.map((template) => {
        const draft = drafts[template.event_key];
        const builtIn = BUILT_IN_WHATSAPP_TEMPLATES.includes(template.event_key);
        const dirty = Boolean(draft);
        const isOtp = template.event_key === OTP_TEMPLATE_KEY;

        return (
          <Card key={template.event_key} className={cx('space-y-3.5 p-4 sm:p-5', !template.is_active && 'opacity-70')}>
            {/* Header: Title, Tags, Switches */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-slate-900">{draft?.name ?? template.name}</p>
                  {isOtp ? (
                    <Badge tone="success" className="text-[10px]">🔐 Always sent</Badge>
                  ) : template.auto_send ? (
                    <Badge tone="success" className="text-[10px]">🤖 Auto-Send ON</Badge>
                  ) : (
                    <Badge tone="neutral" className="text-[10px]">Manual Only</Badge>
                  )}
                  {!builtIn && <Badge tone="info" className="text-[10px]">Custom</Badge>}
                </div>
                <p className="mt-0.5 font-mono text-[10px] text-slate-400">{template.event_key}</p>
              </div>

              {/* Toggles (the verification code is always sent, so it has none) */}
              <div className={cx('flex flex-wrap items-center gap-4', isOtp && 'hidden')}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">Auto-Send:</span>
                  <Switch
                    checked={Boolean(template.auto_send)}
                    onChange={(next) => toggleAutoSend(template, next)}
                    label="Auto send trigger on or off"
                    showLabel
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">Active:</span>
                  <Switch
                    checked={template.is_active}
                    onChange={(next) => toggleTemplate(template, next)}
                    label={`${template.name} on or off`}
                    showLabel
                  />
                </div>

                {!builtIn && (
                  <button
                    type="button"
                    onClick={() => setToDelete(template)}
                    aria-label={`Delete ${template.name}`}
                    className="grid h-8 w-8 place-items-center rounded-full text-red-500 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Editable Title/Name */}
            <div>
              <Label htmlFor={`wa-name-${template.event_key}`}>Template Title</Label>
              <Input
                id={`wa-name-${template.event_key}`}
                value={draft?.name ?? template.name}
                onChange={(e) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [template.event_key]: {
                      ...prev[template.event_key],
                      name: e.target.value,
                    },
                  }))
                }
              />
            </div>

            {/* Dynamic Placeholders Toolbar */}
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor={`wa-msg-${template.event_key}`}>Message</Label>
                <span className="text-[11px] text-slate-400">Click a parameter to insert:</span>
              </div>

              <div className="my-1.5 flex flex-wrap gap-1.5">
                {(isOtp ? OTP_PLACEHOLDERS : WHATSAPP_PLACEHOLDERS).map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => insertPlaceholder(template.event_key, ph)}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                  >
                    + {ph}
                  </button>
                ))}
              </div>

              <Textarea
                id={`wa-msg-${template.event_key}`}
                rows={4}
                value={draft?.message ?? template.message}
                onChange={(e) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [template.event_key]: {
                      ...prev[template.event_key],
                      message: e.target.value,
                    },
                  }))
                }
              />
            </div>

            {isOtp && (
              <p className="text-[11px] leading-relaxed text-amber-700">
                Keep <b>{'{{otp}}'}</b> in the message: it is replaced by the customer's code. Without it the code cannot reach the customer.
              </p>
            )}

            {/* The picture that goes out with this message, and how it will look */}
            <TemplateImagePicker
              value={template.image_url}
              onChange={(url) => changeImage(template, url)}
              notify={notify}
              busy={savingKey === `${template.event_key}:image`}
            />
            <WhatsappPreview image={template.image_url} text={draft?.message ?? template.message} />

            {/* Discard / Save buttons */}
            {dirty && (
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() =>
                    setDrafts((prev) => {
                      const { [template.event_key]: _removed, ...rest } = prev;
                      return rest;
                    })
                  }
                >
                  Discard
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={savingKey === template.event_key}
                  onClick={() => saveTemplate(template)}
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                >
                  {savingKey === template.event_key ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </Card>
        );
      })}

      {/* Add New Template Form */}
      {adding ? (
        <Card className="space-y-4 border-dashed border-2 border-slate-300 p-4 sm:p-6 bg-slate-50/50">
          <p className="text-sm font-bold text-slate-900">Add New Dynamic WhatsApp Trigger</p>

          <div>
            <Label htmlFor="wa-new-name">Trigger / Event Title</Label>
            <Input
              id="wa-new-name"
              value={newName}
              maxLength={60}
              placeholder="e.g. Order Delivered, Gift Packed, Review Request"
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="wa-new-message">Message Template</Label>
              <span className="text-[11px] text-slate-400">Click a parameter to insert:</span>
            </div>

            <div className="my-1.5 flex flex-wrap gap-1.5">
              {WHATSAPP_PLACEHOLDERS.map((ph) => (
                <button
                  key={ph}
                  type="button"
                  onClick={() => insertNewPlaceholder(ph)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                >
                  + {ph}
                </button>
              ))}
            </div>

            <Textarea
              id="wa-new-message"
              rows={4}
              value={newMessage}
              placeholder="Hi {{name}}, your {{brand}} order {{order_number}} for {{products}} was delivered! Total: {{amount}}. - {{brand}}"
              onChange={(e) => setNewMessage(e.target.value)}
            />
          </div>

          <TemplateImagePicker value={newImage} onChange={(url) => setNewImage(url)} notify={notify} />

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
            <div>
              <p className="text-xs font-semibold text-slate-800">Auto-Send Automatically via Bot</p>
              <p className="text-[11px] text-slate-500">Enable bot to dispatch this message immediately when the event triggers</p>
            </div>
            <Switch
              checked={newAutoSend}
              onChange={(next) => setNewAutoSend(next)}
              label="Auto send trigger on or off"
              showLabel
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => {
                setAdding(false);
                setNewName('');
                setNewMessage('');
                setNewAutoSend(false);
                setNewImage(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={creating || newName.trim().length < 2 || newMessage.trim().length < 5}
              onClick={createTemplate}
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              {creating ? 'Adding Trigger...' : 'Add Trigger'}
            </Button>
          </div>
        </Card>
      ) : (
        <Button onClick={() => setAdding(true)} icon={<Plus className="h-4 w-4" />}>
          Add New Trigger
        </Button>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this template?"
        message={`"${toDelete?.name ?? ''}" will be removed from the WhatsApp menu of every order.`}
        confirmLabel="Delete"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};

// ----- the messages that were prepared for orders -----
const WhatsappMessageList: React.FC<{ notify: (message: string, tone?: 'success' | 'danger') => void }> = ({ notify }) => {
  const [items, setItems] = useState<WhatsappLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    whatsappService
      .listLog()
      .then(setItems)
      .catch((err: any) => notify(err.message || 'Could not load the message list', 'danger'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading messages...</div>;
  if (items.length === 0) {
    return <EmptyState icon={<MessageCircle className="h-6 w-6" />} title="No WhatsApp messages yet" description="Messages you prepare from the Orders page will be listed here." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">A message is listed when you open it in WhatsApp from an order. It does not show whether you pressed Send.</p>
        <Button size="sm" onClick={load} icon={<RefreshCw className="h-3.5 w-3.5" />}>
          Refresh
        </Button>
      </div>
      {items.map((item) => (
        <Card key={item.id} className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success">{item.template}</Badge>
              <span className="text-xs font-semibold text-slate-700">{item.order_number || item.order_id}</span>
            </div>
            <span className="text-[11px] text-slate-400">{formatDate(item.created_at)}</span>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            To <span className="font-semibold text-slate-800">{item.recipient_name || 'Customer'}</span>
            {item.phone ? <span className="font-mono"> · +{item.phone}</span> : null}
            {item.admin_name ? <span className="text-slate-400"> · by {item.admin_name}</span> : null}
          </p>
          {item.message && <p className="mt-2 whitespace-pre-line rounded-xl bg-emerald-50/60 px-3 py-2 text-xs leading-relaxed text-slate-700">{item.message}</p>}
        </Card>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tab 4: everything that was sent manually
// ---------------------------------------------------------------------------
const HistoryTab: React.FC<{ reloadKey: number; notify: (message: string, tone?: 'success' | 'danger') => void }> = ({ reloadKey, notify }) => {
  const [items, setItems] = useState<NotificationBroadcast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    notificationService
      .listBroadcasts()
      .then(setItems)
      .catch((err: any) => notify(err.message || 'Could not load history', 'danger'))
      .finally(() => setLoading(false));
  }, [reloadKey]);

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading history...</div>;
  if (items.length === 0) {
    return <EmptyState icon={<Megaphone className="h-6 w-6" />} title="Nothing sent yet" description="Messages you send to customers will be listed here." />;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id} className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">{item.title}</p>
            <span className="text-[11px] text-slate-400">{formatDate(item.created_at)}</span>
          </div>
          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600">{item.message}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="info">{item.audience === 'all' ? 'All customers' : `${item.recipient_count} selected`}</Badge>
            {item.channels.includes('in_app') && <Badge tone="neutral">In-app · {item.recipient_count}</Badge>}
            {item.channels.includes('email') && <Badge tone="neutral">Email · {item.email_sent_count}/{item.recipient_count}</Badge>}
          </div>
        </Card>
      ))}
    </div>
  );
};

export const AdminNotificationsPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [tab, setTab] = useState<Tab>('send');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'danger' } | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const notify = (message: string, tone: 'success' | 'danger' = 'success') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="space-y-5">
      {!embedded && (
        <PageHeader
          icon={<Bell className="h-5 w-5" />}
          title="Notifications"
          description="Send messages to customers and control the automatic order, payment and delivery messages."
          actions={
            <Button onClick={() => setHistoryKey((key) => key + 1)} icon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
          }
        />
      )}

      <div role="tablist" className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cx(
              'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition',
              tab === item.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            )}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </div>

      {tab === 'send' && <SendTab notify={notify} onSent={() => setHistoryKey((key) => key + 1)} />}
      {tab === 'triggers' && <TriggersTab notify={notify} />}
      {tab === 'whatsapp' && <WhatsappTab notify={notify} />}
      {tab === 'history' && <HistoryTab reloadKey={historyKey} notify={notify} />}

      <Toast message={toast?.message ?? null} tone={toast?.tone} />
    </div>
  );
};

export default AdminNotificationsPage;
