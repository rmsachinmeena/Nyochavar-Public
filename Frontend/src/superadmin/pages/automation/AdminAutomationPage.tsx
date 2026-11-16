import React, { useState } from 'react';
import { Mail, MessageSquare, Bell, Settings, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import AdminNotificationsPage from '../notifications/AdminNotificationsPage';
import { UserLoginSettingsTab } from './components/UserLoginSettingsTab';
import {
  Card,
  PageHeader,
  SwitchField,
  cx
} from '../../components/ui';

interface AutomationSettings {
  email: {
    welcomeEmail: boolean;
    loginOtp: boolean;
    passwordReset: boolean;
    orderConfirmation: boolean;
    paymentReceipt: boolean;
    deliveryStatus: boolean;
    orderDelivered: boolean;
  };
  whatsapp: {
    orderConfirmation: boolean;
    deliveryUpdate: boolean;
    paymentReminder: boolean;
    reviewRequest: boolean;
  };
  notifications: {
    pushNotification: boolean;
    smsNotification: boolean;
    inAppMessage: boolean;
  };
  admin: {
    bulkOrderAlert: boolean;
    lowStockAlert: boolean;
    riderLocationShare: boolean;
    paymentFailureAlert: boolean;
  };
}

const AUTOMATION_CATEGORIES = [
  {
    id: 'email',
    label: '📧 Email Notifications',
    icon: Mail,
    description: 'Control automated email communications',
    color: 'bg-blue-50 border-blue-200'
  },
  {
    id: 'whatsapp',
    label: '💬 WhatsApp Messages',
    icon: MessageSquare,
    description: 'WhatsApp automation for orders & updates',
    color: 'bg-green-50 border-green-200'
  },
  {
    id: 'notifications',
    label: '🔔 Push Notifications',
    icon: Bell,
    description: 'In-app & mobile push notifications',
    color: 'bg-purple-50 border-purple-200'
  },
  {
    id: 'admin',
    label: '⚙️ Admin Alerts',
    icon: Settings,
    description: 'Internal alerts for business operations',
    color: 'bg-orange-50 border-orange-200'
  }
];

export const AdminAutomationPage: React.FC = () => {
  // Real customer notifications, user login verification controls, and channel settings
  const [view, setView] = useState<'notifications' | 'user-login' | 'channels'>('user-login');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'danger' } | null>(null);

  const notify = (message: string, tone: 'success' | 'danger' = 'success') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 4500);
  };

  const [settings, setSettings] = useState<AutomationSettings>({
    email: {
      welcomeEmail: true,
      loginOtp: true,
      passwordReset: true,
      orderConfirmation: true,
      paymentReceipt: true,
      deliveryStatus: true,
      orderDelivered: true,
    },
    whatsapp: {
      orderConfirmation: true,
      deliveryUpdate: true,
      paymentReminder: false,
      reviewRequest: true,
    },
    notifications: {
      pushNotification: true,
      smsNotification: false,
      inAppMessage: true,
    },
    admin: {
      bulkOrderAlert: true,
      lowStockAlert: true,
      riderLocationShare: true,
      paymentFailureAlert: true,
    },
  });

  const [expandedSection, setExpandedSection] = useState<string>('email');

  const handleToggle = (category: keyof AutomationSettings, setting: string, value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...(prev[category] as Record<string, boolean>),
        [setting]: value,
      },
    }));
  };

  const countEnabled = (category: keyof AutomationSettings) => {
    const cat = settings[category];
    return Object.values(cat).filter(Boolean).length;
  };

  const totalEnabled = (category: keyof AutomationSettings) => {
    return Object.keys(settings[category]).length;
  };

  return (
    <div className="flex flex-col gap-6 relative">
      {/* Toast Notification */}
      {toast && (
        <div
          className={cx(
            'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold text-white shadow-xl animate-in fade-in slide-in-from-bottom-2',
            toast.tone === 'danger' ? 'bg-red-600' : 'bg-emerald-600'
          )}
        >
          {toast.tone === 'danger' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      <PageHeader
        icon={<Settings className="h-5 w-5" />}
        title="Automation & Notifications"
        description="Configure user login/signup verification mode, manage automated WhatsApp & Email notifications, and channel settings"
      />

      <div role="tablist" className="flex flex-wrap gap-2">
        {([
          { id: 'user-login', label: '👤 User Login & Verification ⚡' },
          { id: 'notifications', label: '💬 Customer Notifications & Bot' },
          { id: 'channels', label: '⚙️ Channel Settings' },
        ] as const).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={view === item.id}
            onClick={() => setView(item.id)}
            className={cx(
              'h-9 rounded-full border px-4 text-xs font-semibold transition cursor-pointer',
              view === item.id ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {view === 'user-login' && (
        <UserLoginSettingsTab
          notify={notify}
          onNavigateToBot={() => setView('notifications')}
        />
      )}

      {view === 'notifications' && <AdminNotificationsPage embedded />}

      {view === 'channels' && (
      <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {AUTOMATION_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const enabled = countEnabled(category.id as keyof AutomationSettings);
          const total = totalEnabled(category.id as keyof AutomationSettings);
          return (
            <button
              key={category.id}
              onClick={() => setExpandedSection(expandedSection === category.id ? '' : category.id)}
              type="button"
              className={cx(
                'flex flex-col gap-2 rounded-2xl border-2 p-4 transition-all cursor-pointer',
                expandedSection === category.id
                  ? `${category.color} border-current`
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-2xl">{category.label.split(' ')[0]}</span>
                <span className="text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 px-2 py-1">
                  {enabled}/{total}
                </span>
              </div>
              <p className="text-left text-[11px] leading-relaxed text-slate-600">{category.description}</p>
            </button>
          );
        })}
      </div>

      {/* Email Notifications */}
      {expandedSection === 'email' && (
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <Mail className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Email Notifications</h2>
              <p className="text-xs text-slate-500">Automatic emails sent to customers</p>
            </div>
          </div>

          <div className="space-y-3">
            <SwitchField
              label="Welcome Email"
              description="Send welcome email when new user signs up"
              checked={settings.email.welcomeEmail}
              onChange={(value) => handleToggle('email', 'welcomeEmail', value)}
            />

            <SwitchField
              label="Login OTP Email"
              description="Send 4-digit OTP for email verification"
              checked={settings.email.loginOtp}
              onChange={(value) => handleToggle('email', 'loginOtp', value)}
            />

            <SwitchField
              label="Password Reset"
              description="Send password reset link & verification code"
              checked={settings.email.passwordReset}
              onChange={(value) => handleToggle('email', 'passwordReset', value)}
            />

            <SwitchField
              label="Order Confirmation"
              description="Confirm order placed with itemized receipt"
              checked={settings.email.orderConfirmation}
              onChange={(value) => handleToggle('email', 'orderConfirmation', value)}
            />

            <SwitchField
              label="Payment Receipt"
              description="Send payment confirmation & invoice"
              checked={settings.email.paymentReceipt}
              onChange={(value) => handleToggle('email', 'paymentReceipt', value)}
            />

            <SwitchField
              label="Delivery Status Updates"
              description="Real-time delivery tracking notifications"
              checked={settings.email.deliveryStatus}
              onChange={(value) => handleToggle('email', 'deliveryStatus', value)}
            />

            <SwitchField
              label="Order Delivered"
              description="Confirmation when gift has been delivered"
              checked={settings.email.orderDelivered}
              onChange={(value) => handleToggle('email', 'orderDelivered', value)}
            />
          </div>
        </Card>
      )}

      {/* WhatsApp Messages */}
      {expandedSection === 'whatsapp' && (
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-green-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">WhatsApp Messages</h2>
              <p className="text-xs text-slate-500">Automated WhatsApp communications</p>
            </div>
          </div>

          <div className="space-y-3">
            <SwitchField
              label="Order Confirmation"
              description="Send order details on WhatsApp after purchase"
              checked={settings.whatsapp.orderConfirmation}
              onChange={(value) => handleToggle('whatsapp', 'orderConfirmation', value)}
            />

            <SwitchField
              label="Delivery Updates"
              description="Send real-time delivery status to customer"
              checked={settings.whatsapp.deliveryUpdate}
              onChange={(value) => handleToggle('whatsapp', 'deliveryUpdate', value)}
            />

            <SwitchField
              label="Payment Reminders"
              description="Remind about pending payments (if applicable)"
              checked={settings.whatsapp.paymentReminder}
              onChange={(value) => handleToggle('whatsapp', 'paymentReminder', value)}
            />

            <SwitchField
              label="Review Requests"
              description="Ask for customer feedback after delivery"
              checked={settings.whatsapp.reviewRequest}
              onChange={(value) => handleToggle('whatsapp', 'reviewRequest', value)}
            />
          </div>
        </Card>
      )}

      {/* Push Notifications */}
      {expandedSection === 'notifications' && (
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <Bell className="h-6 w-6 text-purple-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Push Notifications</h2>
              <p className="text-xs text-slate-500">In-app alerts & mobile push notifications</p>
            </div>
          </div>

          <div className="space-y-3">
            <SwitchField
              label="Mobile Push Notifications"
              description="Send push alerts to mobile devices (iOS/Android)"
              checked={settings.notifications.pushNotification}
              onChange={(value) => handleToggle('notifications', 'pushNotification', value)}
            />

            <SwitchField
              label="SMS Notifications"
              description="Send text message updates for critical events"
              checked={settings.notifications.smsNotification}
              onChange={(value) => handleToggle('notifications', 'smsNotification', value)}
            />

            <SwitchField
              label="In-App Messages"
              description="Display notifications inside the app"
              checked={settings.notifications.inAppMessage}
              onChange={(value) => handleToggle('notifications', 'inAppMessage', value)}
            />
          </div>
        </Card>
      )}

      {/* Admin Alerts */}
      {expandedSection === 'admin' && (
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <Settings className="h-6 w-6 text-orange-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Admin Alerts</h2>
              <p className="text-xs text-slate-500">Internal notifications for business operations</p>
            </div>
          </div>

          <div className="space-y-3">
            <SwitchField
              label="Bulk Order Alerts"
              description="Notify when large orders (5+ items) are placed"
              checked={settings.admin.bulkOrderAlert}
              onChange={(value) => handleToggle('admin', 'bulkOrderAlert', value)}
            />

            <SwitchField
              label="Low Stock Alerts"
              description="Alert when product inventory drops below threshold"
              checked={settings.admin.lowStockAlert}
              onChange={(value) => handleToggle('admin', 'lowStockAlert', value)}
            />

            <SwitchField
              label="Rider Location Sharing"
              description="Real-time location updates from delivery partners"
              checked={settings.admin.riderLocationShare}
              onChange={(value) => handleToggle('admin', 'riderLocationShare', value)}
            />

            <SwitchField
              label="Payment Failure Alerts"
              description="Notify on failed payment transactions"
              checked={settings.admin.paymentFailureAlert}
              onChange={(value) => handleToggle('admin', 'paymentFailureAlert', value)}
            />
          </div>
        </Card>
      )}

      {/* Info Banner */}
      <Card className="border-l-4 border-l-amber-500 bg-amber-50 p-4">
        <p className="text-xs text-amber-900">
          <strong>Preview only:</strong> these switches are not connected to the server yet, so changes reset on refresh and do not stop any messages.
        </p>
      </Card>
      </>
      )}
    </div>
  );
};

export default AdminAutomationPage;
