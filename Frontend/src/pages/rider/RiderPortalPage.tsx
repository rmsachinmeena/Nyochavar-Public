import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bike,
  Truck,
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  LogOut,
  RefreshCw,
  Package,
  KeyRound,
  IndianRupee,
  Navigation,
  Eye,
  EyeOff,
  Search,
  Check,
  Copy,
  Zap,
  UserCheck,
  Lock,
  Volume2,
  VolumeX,
  MessageSquare,
  Power,
  BarChart2,
  User,
  Home,
  CircleDollarSign,
  ChevronDown,
  ChevronUp,
  X,
  SlidersHorizontal,
  Calendar,
  Wallet,
  Headphones,
  Settings,
  Bell,
  ArrowRight,
  LayoutDashboard,
  CheckCircle,
  Filter
} from 'lucide-react';
import { api } from '../../services/api';
import { onSessionEnded, tokenStore } from '../../services/apiClient';

interface DeliveryPartner {
  id: string;
  name: string;
  phone: string;
  city?: string;
  assigned_area?: string;
  duty_status?: 'on_duty' | 'on_leave';
}

interface RiderOrder {
  id: string;
  buyer_id: string | null;
  items: any[];
  total_amount: number;
  delivery_address: string;
  delivery_date: string | null;
  delivery_slot: string | null;
  is_same_day: boolean;
  payment_status: 'pending' | 'paid' | 'failed';
  payment_method: string;
  order_status: 'placed' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  delivery_partner_id?: string | null;
  delivery_partner_name?: string | null;
  delivery_partner_phone?: string | null;
  delivery_otp?: string | null;
  out_for_delivery_at?: string | null;
  delivered_at?: string | null;
  delivery_issue?: 'failed' | 'reschedule' | null;
  created_at: string;
}

type MainTab = 'dashboard' | 'deliveries' | 'earnings' | 'profile' | 'support' | 'settings';
type FilterType = 'all' | 'out_for_delivery' | 'assigned' | 'express' | 'cod' | 'prepaid';
type SortType = 'newest' | 'oldest' | 'amount_high' | 'amount_low';

// Web Audio API Chime Synthesizer
const playDeliveryAlertChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Tone 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.25, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);

    // Tone 2
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1);
    gain2.gain.setValueAtTime(0.35, ctx.currentTime + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.warn('Audio chime could not play:', e);
  }
};

export const RiderPortalPage: React.FC = () => {
  // Session State: the saved rider is restored only while a session exists; otherwise the login form shows
  const [rider, setRider] = useState<DeliveryPartner | null>(() => {
    try {
      const saved = localStorage.getItem('petal_pen_rider_profile');
      const hasSession = Boolean(tokenStore.get('rider') || tokenStore.getRefresh('rider'));
      return saved && hasSession ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Login Form State
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Tab State
  const [currentTab, setCurrentTab] = useState<MainTab>('dashboard');
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortType>('newest');
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showCircleMenu, setShowCircleMenu] = useState(false);

  // Audio Notification
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('petal_pen_rider_sound');
    return saved !== 'disabled';
  });
  const prevActiveCountRef = useRef<number | null>(null);

  // Duty Status
  const [isUpdatingDuty, setIsUpdatingDuty] = useState(false);

  // OTP Modal State
  const [otpModalOrder, setOtpModalOrder] = useState<RiderOrder | null>(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleCopyOrderId = (id: string) => {
    const short = id.slice(-6).toUpperCase();
    navigator.clipboard?.writeText(short);
    setCopiedId(id);
    showToast(`Order #${short} copied!`, 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('petal_pen_rider_sound', next ? 'enabled' : 'disabled');
    if (next) {
      playDeliveryAlertChime();
      showToast('🔊 Audio Chimes Enabled', 'info');
    } else {
      showToast('🔇 Audio Chimes Muted', 'info');
    }
  };

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrderIds(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const fetchRiderOrders = async (partnerId: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getRiderOrders(partnerId);
      const fetched: RiderOrder[] = data.orders || [];
      setOrders(fetched);

      const activeList = fetched.filter(
        o => o.order_status !== 'delivered' && o.order_status !== 'cancelled'
      );

      if (prevActiveCountRef.current !== null && activeList.length > prevActiveCountRef.current) {
        if (soundEnabled) {
          playDeliveryAlertChime();
          showToast(`🔔 New Order Assigned! (${activeList.length} Active)`, 'success');
        }
      }
      prevActiveCountRef.current = activeList.length;
    } catch (err: any) {
      console.warn('Failed to fetch rider orders from API:', err);
      setOrders([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (rider?.id) {
      fetchRiderOrders(rider.id);
      const interval = setInterval(() => {
        fetchRiderOrders(rider.id, true);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [rider?.id, soundEnabled]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await api.riderLogin({ phone: loginPhone, pin: loginPin });
      setRider(res.partner);
      fetchRiderOrders(res.partner.id);
      if (soundEnabled) playDeliveryAlertChime();
    } catch (err: any) {
      setLoginError(err.message || 'Invalid phone number or PIN.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    void api.riderLogout();
    setRider(null);
    setOrders([]);
    setShowProfileMenu(false);
  };

  useEffect(
    () =>
      onSessionEnded(({ role }) => {
        if (role !== 'rider') return;
        try {
          localStorage.removeItem('petal_pen_rider_profile');
        } catch {
          /* ignore */
        }
        setRider(null);
        setOrders([]);
      }),
    []
  );

  const handleToggleDutyStatus = async () => {
    if (!rider?.id || isUpdatingDuty) return;
    const currentDuty = rider.duty_status || 'on_duty';
    const nextDuty = currentDuty === 'on_duty' ? 'on_leave' : 'on_duty';

    setIsUpdatingDuty(true);
    try {
      await api.updateRiderDutyStatus(rider.id, nextDuty);
      const updatedRider: DeliveryPartner = {
        ...rider,
        duty_status: nextDuty
      };
      setRider(updatedRider);
      localStorage.setItem('petal_pen_rider_profile', JSON.stringify(updatedRider));
      
      showToast(
        nextDuty === 'on_duty' ? '🟢 You are ON DUTY (Ready to accept orders)' : '🔴 You are OFF DUTY (On Leave)',
        nextDuty === 'on_duty' ? 'success' : 'error'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to update duty status', 'error');
    } finally {
      setIsUpdatingDuty(false);
    }
  };

  const handleStartDelivery = async (orderId: string) => {
    if (!rider?.id) return;
    try {
      await api.markRiderOutForDelivery(orderId, rider.id);
      showToast('🚀 Marked Out for Delivery! Doorstep OTP verification is now active.', 'success');
      if (soundEnabled) playDeliveryAlertChime();
      fetchRiderOrders(rider.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to start delivery', 'error');
    }
  };

  // One tap: the order is flagged for the superadmin and this rider's buttons for it switch off
  const handleDeliveryIssue = async (order: RiderOrder, issue: 'failed' | 'reschedule') => {
    if (!rider?.id || order.delivery_issue) return;
    const label = issue === 'failed' ? 'delivery failed' : 'reschedule';
    if (!window.confirm(`Mark order #${order.id.slice(-6).toUpperCase()} as ${label}? You cannot undo this.`)) return;
    try {
      await api.reportDeliveryIssue(order.id, issue);
      showToast(issue === 'failed' ? 'Marked as delivery failed. The admin has been informed.' : 'Reschedule requested. The admin has been informed.', 'success');
      fetchRiderOrders(rider.id);
    } catch (err: any) {
      showToast(err.message || 'Could not report the delivery issue', 'error');
    }
  };

  const handleOpenOtpModal = (order: RiderOrder) => {
    if (order.order_status !== 'out_for_delivery') {
      showToast('⚠️ Click "Start Route" first before asking for Doorstep OTP.', 'info');
      return;
    }
    setOtpModalOrder(order);
    setEnteredOtp('');
    setOtpError(null);
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpModalOrder) return;
    if (enteredOtp.trim().length < 4) {
      setOtpError('Enter the 4-digit code provided by customer.');
      return;
    }

    setOtpLoading(true);
    setOtpError(null);

    try {
      await api.verifyDeliveryOtp(otpModalOrder.id, enteredOtp.trim(), rider?.id);
      showToast(`🎉 Order #${otpModalOrder.id.slice(-6).toUpperCase()} Delivered successfully!`, 'success');
      if (soundEnabled) playDeliveryAlertChime();
      setOtpModalOrder(null);
      setEnteredOtp('');
      if (rider?.id) fetchRiderOrders(rider.id);
    } catch (err: any) {
      setOtpError(err.message || 'Incorrect OTP. Ask customer for 4-digit code.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Extracts GPS coordinates from text like "Live location (26.4580, 74.6169), Near Foysagar, Ajmer"
  const extractCoordinates = (text: string): { lat: string; lng: string } | null => {
    if (!text) return null;
    const coordRegex = /(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/;
    const match = text.match(coordRegex);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat: match[1], lng: match[2] };
      }
    }
    return null;
  };

  const handleOpenGoogleMaps = (fullAddress: string) => {
    if (!fullAddress) return;
    const { addressText } = parseDeliveryDetails(fullAddress);

    // 1. If the address has coordinates (e.g. "Live location (26.4580, 74.6169), Near Foysagar, Ajmer"),
    // open Google Maps directly at the exact GPS coordinates pin.
    const coords = extractCoordinates(addressText) || extractCoordinates(fullAddress);
    if (coords) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`, '_blank');
      return;
    }

    // 2. If it is already a direct Google Maps URL
    if (addressText.startsWith('http://') || addressText.startsWith('https://')) {
      window.open(addressText, '_blank');
      return;
    }

    // 3. Normal text address: clean up and query Google Maps
    const cleanedText = addressText.replace(/live\s*location/gi, '').replace(/[()]/g, '').trim();
    const citySuffix = rider?.city && !cleanedText.toLowerCase().includes(rider.city.toLowerCase()) ? `, ${rider.city}` : '';
    const query = encodeURIComponent(`${cleanedText}${citySuffix}`.replace(/,\s*,/g, ',').trim());
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const parseDeliveryDetails = (rawAddress: string) => {
    const parts = (rawAddress || '').split('|').map(s => s.trim());
    if (parts.length >= 3) {
      return {
        customerName: parts[0],
        customerPhone: parts[1],
        addressText: parts.slice(2).join(', ')
      };
    }
    return {
      customerName: 'Customer',
      customerPhone: '',
      addressText: rawAddress || 'Customer Address'
    };
  };

  const activeOrders = useMemo(() => {
    return orders.filter(o => o.order_status !== 'delivered' && o.order_status !== 'cancelled');
  }, [orders]);

  const deliveredOrders = useMemo(() => {
    return orders.filter(o => o.order_status === 'delivered');
  }, [orders]);

  const inTransitCount = useMemo(() => {
    return activeOrders.filter(o => o.order_status === 'out_for_delivery').length;
  }, [activeOrders]);

  const codPendingTotal = useMemo(() => {
    return activeOrders
      .filter(o => o.payment_method?.toUpperCase() === 'COD' && o.payment_status !== 'paid')
      .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  }, [activeOrders]);

  const codCollectedTotal = useMemo(() => {
    return deliveredOrders
      .filter(o => o.payment_method?.toUpperCase() === 'COD')
      .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  }, [deliveredOrders]);

  const filterCounts = useMemo(() => {
    return {
      all: activeOrders.length,
      out_for_delivery: activeOrders.filter(o => o.order_status === 'out_for_delivery').length,
      assigned: activeOrders.filter(o => o.order_status !== 'out_for_delivery').length,
      express: activeOrders.filter(o => o.is_same_day).length,
      cod: activeOrders.filter(o => o.payment_method?.toUpperCase() === 'COD').length,
      prepaid: activeOrders.filter(o => o.payment_method?.toUpperCase() !== 'COD').length,
    };
  }, [activeOrders]);

  // Filtering & Sorting for Active Orders
  const displayedActiveOrders = useMemo(() => {
    let list = [...activeOrders];

    if (activeFilter === 'out_for_delivery') {
      list = list.filter(o => o.order_status === 'out_for_delivery');
    } else if (activeFilter === 'assigned') {
      list = list.filter(o => o.order_status !== 'out_for_delivery');
    } else if (activeFilter === 'express') {
      list = list.filter(o => o.is_same_day);
    } else if (activeFilter === 'cod') {
      list = list.filter(o => o.payment_method?.toUpperCase() === 'COD');
    } else if (activeFilter === 'prepaid') {
      list = list.filter(o => o.payment_method?.toUpperCase() !== 'COD');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(o => {
        const { customerName, customerPhone, addressText } = parseDeliveryDetails(o.delivery_address);
        return (
          o.id.toLowerCase().includes(q) ||
          customerName.toLowerCase().includes(q) ||
          customerPhone.includes(q) ||
          addressText.toLowerCase().includes(q) ||
          (Array.isArray(o.items) && o.items.some(i => i.name && i.name.toLowerCase().includes(q)))
        );
      });
    }

    list.sort((a, b) => {
      if (sortOrder === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortOrder === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortOrder === 'amount_high') {
        return (Number(b.total_amount) || 0) - (Number(a.total_amount) || 0);
      }
      if (sortOrder === 'amount_low') {
        return (Number(a.total_amount) || 0) - (Number(b.total_amount) || 0);
      }
      return 0;
    });

    return list;
  }, [activeOrders, activeFilter, searchQuery, sortOrder]);

  const displayedDeliveredOrders = useMemo(() => {
    if (!searchQuery.trim()) return deliveredOrders;
    const q = searchQuery.toLowerCase().trim();
    return deliveredOrders.filter(o => {
      const { customerName, customerPhone, addressText } = parseDeliveryDetails(o.delivery_address);
      return (
        o.id.toLowerCase().includes(q) ||
        customerName.toLowerCase().includes(q) ||
        customerPhone.includes(q) ||
        addressText.toLowerCase().includes(q)
      );
    });
  }, [deliveredOrders, searchQuery]);

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  // -------------------------------------------------------------
  // VIEW 1: Clean Minimalist Rider Login Screen
  // -------------------------------------------------------------
  if (!rider) {
    return (
      <div className="h-screen w-screen bg-[#f8faff] text-slate-800 flex flex-col justify-center items-center p-4 antialiased overflow-hidden">
        <div className="w-full max-w-sm bg-white border border-blue-100/80 rounded-3xl p-6 sm:p-7 shadow-xl shadow-blue-900/5">
          
          <div className="text-center mb-5">
            <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/25 mx-auto mb-3 ring-6 ring-blue-50">
              <Bike className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Rider Portal</h1>
            <p className="text-xs text-slate-400 mt-0.5">Delivering Happiness</p>
          </div>

          {loginError && (
            <div className="mb-3.5 p-2.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Mobile Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4 text-blue-600" />
                </div>
                <input
                  type="tel"
                  required
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-blue-50/20 border border-blue-100 rounded-xl text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-blue-600 focus:bg-white font-medium transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Security PIN
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4 text-blue-600" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value)}
                  placeholder="Your security PIN"
                  autoComplete="current-password"
                  inputMode="numeric"
                  className="w-full pl-10 pr-10 py-2.5 bg-blue-50/20 border border-blue-100 rounded-xl text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-blue-600 focus:bg-white font-medium tracking-wider transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              {loginLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    );
  }

  const isOnDuty = rider.duty_status !== 'on_leave';

  // -------------------------------------------------------------
  // VIEW 2: Fitted 1-Page Layout without outer screen scrollbars
  // -------------------------------------------------------------
  return (
    <div className="h-screen w-screen bg-[#f8faff] text-slate-800 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white overflow-hidden">
      
      {/* Toast Feedback Notification */}
      {feedback && (
        <div
          className={`fixed top-3 left-3 right-3 sm:left-auto sm:right-5 z-50 p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold shadow-lg animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : feedback.type === 'info'
              ? 'bg-blue-600 text-white border-blue-500'
              : 'bg-rose-600 text-white border-rose-500'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : feedback.type === 'info' ? (
            <Lock className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span className="flex-1 leading-tight">{feedback.text}</span>
        </div>
      )}

      {/* COMPACT TOP NAVBAR (Fixed Height 52px) */}
      <header className="h-[52px] shrink-0 bg-white border-b border-slate-100 px-3 sm:px-6 flex items-center justify-between z-30 shadow-2xs">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center shadow-xs shrink-0">
            <Bike className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black text-brand leading-tight tracking-tight">
              Rider Portal
            </h1>
            <p className="text-[9px] text-slate-400 font-medium hidden sm:block">Delivering Happiness</p>
          </div>
        </div>

        {/* Right: Quick Status, Notifications, Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          
          {/* Online Status Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50/70 border border-emerald-200/80 text-emerald-700 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{isOnDuty ? 'Online' : 'Offline'}</span>
            <ChevronDown className="w-3 h-3 text-emerald-600" />
          </div>

          {/* Sound / Notification Bell */}
          <button
            type="button"
            onClick={toggleSound}
            className="relative w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 cursor-pointer transition-all active:scale-95"
            title={soundEnabled ? 'Audio Chimes: ON' : 'Audio Chimes: MUTED'}
          >
            <Bell className="w-3.5 h-3.5 text-slate-600" />
            {activeOrders.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center ring-1 ring-white">
                {activeOrders.length}
              </span>
            )}
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => fetchRiderOrders(rider.id)}
            className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 cursor-pointer transition-all active:scale-95"
            title="Refresh Deliveries"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-0.5 rounded-full hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs ring-2 ring-blue-100 shrink-0">
                {rider.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-[11px] font-bold text-slate-900 leading-none">{rider.name}</p>
                <p className="text-[9px] text-slate-400 font-medium">Rider</p>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400 hidden md:block" />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-50 animate-fadeIn">
                <div className="px-2.5 py-1.5 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900 truncate">{rider.name}</p>
                  <p className="text-[10px] text-slate-400">{rider.phone}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTab('profile');
                    setShowProfileMenu(false);
                  }}
                  className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2 cursor-pointer mt-1"
                >
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTab('earnings');
                    setShowProfileMenu(false);
                  }}
                  className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2 cursor-pointer"
                >
                  <CircleDollarSign className="w-3.5 h-3.5 text-slate-500" />
                  <span>Earnings</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 cursor-pointer border-t border-slate-100 mt-1"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* BODY: SIDEBAR + MAIN AREA (No Outer Scrollbar, Fits 100vh) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        
        {/* DESKTOP COMPACT SIDEBAR (Hidden on mobile) */}
        <aside className="hidden lg:flex flex-col justify-between w-52 shrink-0 bg-white border-r border-slate-100 p-2.5 h-full overflow-hidden">
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => setCurrentTab('dashboard')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-brand-soft text-brand shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('deliveries')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'deliveries'
                  ? 'bg-brand-soft text-brand shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span className="flex-1 text-left">My Deliveries</span>
              {activeOrders.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-brand text-white text-[9px] font-black">
                  {activeOrders.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('earnings')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'earnings'
                  ? 'bg-brand-soft text-brand shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <IndianRupee className="w-3.5 h-3.5" />
              <span>Earnings</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('profile')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'profile'
                  ? 'bg-brand-soft text-brand shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Profile</span>
            </button>

            <button
              type="button"
              onClick={() => showToast('📞 Support: +91 9876543210', 'info')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Support</span>
            </button>

            <button
              type="button"
              onClick={toggleSound}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Sound Alert</span>
            </button>
          </nav>

          {/* Mini Promo Card */}
          <div className="bg-blue-50/50 border border-blue-100/60 rounded-2xl p-2.5 text-center">
            <Bike className="w-6 h-6 text-blue-600 mx-auto mb-1 animate-bounce" />
            <h4 className="text-[11px] font-black text-slate-900">Keep Going!</h4>
            <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">Every delivery counts.</p>
          </div>
        </aside>

        {/* MAIN OPERATIONS VIEW (Fitted flex column, with bottom padding for mobile dock) */}
        <main className="flex-1 flex flex-col min-h-0 p-2 sm:p-4 overflow-x-hidden overflow-y-auto pb-24 lg:pb-3 w-full max-w-full">
          
          {/* Greeting & Date/Duty bar (Shrink-0, compact height) */}
          <div className="shrink-0 flex items-center justify-between gap-2 mb-2 sm:mb-3">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-1.5 leading-tight">
                <span>Hello, {rider.name}!</span>
                <span>👋</span>
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">Here's your quick overview for today</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-[11px] font-bold shadow-2xs">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>{todayFormatted}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </div>

              <button
                type="button"
                onClick={handleToggleDutyStatus}
                disabled={isUpdatingDuty}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer shadow-2xs active:scale-95 ${
                  isOnDuty
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50/80 border-rose-200 text-rose-800'
                } ${isUpdatingDuty ? 'opacity-50' : ''}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isOnDuty ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span>{isOnDuty ? 'On Duty' : 'On Leave'}</span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>
            </div>
          </div>

          {/* 4 COMPACT METRIC CARDS (Phone size me 4 card small karke 1 single row me, perfectly fitted) */}
          <div className="shrink-0 grid grid-cols-4 gap-1 sm:gap-2 mb-2 w-full max-w-full">
            
            {/* Card 1: Active Tasks */}
            <div
              onClick={() => {
                setCurrentTab('dashboard');
                setActiveFilter('all');
              }}
              className="min-w-0 overflow-hidden bg-white border-2 border-brand/40 ring-1 ring-brand-soft rounded-xl sm:rounded-2xl p-1 sm:p-2.5 shadow-2xs cursor-pointer transition-all hover:shadow-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-brand-soft text-brand flex items-center justify-center shrink-0">
                  <Clock className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
                </div>
                <ArrowRight className="w-2.5 h-2.5 text-slate-300 hidden sm:block" />
              </div>
              <div className="mt-1 sm:mt-1.5 min-w-0">
                <span className="text-[7.5px] sm:text-[9px] font-black text-slate-400 uppercase tracking-tight block truncate">
                  ACTIVE
                </span>
                <p className="text-xs sm:text-base md:text-xl font-black text-slate-900 leading-tight truncate">
                  {activeOrders.length}
                </p>
                <p className="text-[7.5px] sm:text-[10px] text-brand font-semibold mt-0.5 truncate leading-tight">
                  {inTransitCount} transit
                </p>
              </div>
            </div>

            {/* Card 2: Completed */}
            <div
              onClick={() => setCurrentTab('deliveries')}
              className="min-w-0 overflow-hidden bg-white border border-slate-200/80 rounded-xl sm:rounded-2xl p-1 sm:p-2.5 shadow-2xs cursor-pointer transition-all hover:shadow-xs hover:border-emerald-300 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
                </div>
                <ArrowRight className="w-2.5 h-2.5 text-slate-300 hidden sm:block" />
              </div>
              <div className="mt-1 sm:mt-1.5 min-w-0">
                <span className="text-[7.5px] sm:text-[9px] font-black text-slate-400 uppercase tracking-tight block truncate">
                  DONE
                </span>
                <p className="text-xs sm:text-base md:text-xl font-black text-slate-900 leading-tight truncate">
                  {deliveredOrders.length}
                </p>
                <p className="text-[7.5px] sm:text-[10px] text-emerald-600 font-semibold mt-0.5 truncate leading-tight">
                  Delivered
                </p>
              </div>
            </div>

            {/* Card 3: COD to Collect */}
            <div
              onClick={() => {
                setCurrentTab('dashboard');
                setActiveFilter('cod');
              }}
              className="min-w-0 overflow-hidden bg-white border border-slate-200/80 rounded-xl sm:rounded-2xl p-1 sm:p-2.5 shadow-2xs cursor-pointer transition-all hover:shadow-xs hover:border-blue-300 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-brand-soft text-brand flex items-center justify-center shrink-0">
                  <IndianRupee className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
                </div>
                <ArrowRight className="w-2.5 h-2.5 text-slate-300 hidden sm:block" />
              </div>
              <div className="mt-1 sm:mt-1.5 min-w-0">
                <span className="text-[7.5px] sm:text-[9px] font-black text-slate-400 uppercase tracking-tight block truncate">
                  COD
                </span>
                <p className="text-xs sm:text-base md:text-xl font-black text-brand leading-tight truncate">
                  ₹{codPendingTotal}
                </p>
                <p className="text-[7.5px] sm:text-[10px] text-slate-500 font-semibold mt-0.5 truncate leading-tight">
                  {activeOrders.filter(o => o.payment_method?.toUpperCase() === 'COD').length} parcels
                </p>
              </div>
            </div>

            {/* Card 4: Est. Earnings */}
            <div
              onClick={() => setCurrentTab('earnings')}
              className="min-w-0 overflow-hidden bg-white border border-slate-200/80 rounded-xl sm:rounded-2xl p-1 sm:p-2.5 shadow-2xs cursor-pointer transition-all hover:shadow-xs hover:border-indigo-300 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Wallet className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
                </div>
                <ArrowRight className="w-2.5 h-2.5 text-slate-300 hidden sm:block" />
              </div>
              <div className="mt-1 sm:mt-1.5 min-w-0">
                <span className="text-[7.5px] sm:text-[9px] font-black text-slate-400 uppercase tracking-tight block truncate">
                  EARNED
                </span>
                <p className="text-xs sm:text-base md:text-xl font-black text-blue-600 leading-tight truncate">
                  ₹{deliveredOrders.length * 70}
                </p>
                <p className="text-[7.5px] sm:text-[10px] text-slate-500 font-semibold mt-0.5 truncate leading-tight">
                  ₹70 / del
                </p>
              </div>
            </div>

          </div>

          {/* SEARCH BAR & SMOOTH FILTER (100% screen fitted, no right cut) */}
          <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 mb-2 w-full max-w-full">
            
            {/* Bada Search Bar (Properly bounded with min-w-0) */}
            <div className="relative flex-1 min-w-0">
              <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search orders, phone, address..."
                className="w-full pl-8 sm:pl-9 pr-7 py-2 sm:py-2.5 bg-white border border-slate-200/90 rounded-xl text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Smooth Animated Filter & Sort Menu */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl border text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer ${
                  activeFilter !== 'all' || sortOrder !== 'newest'
                    ? 'bg-brand text-white border-brand shadow-brand/20'
                    : 'bg-white border-slate-200/90 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Filter className={`w-3.5 h-3.5 shrink-0 ${activeFilter !== 'all' || sortOrder !== 'newest' ? 'text-white' : 'text-brand'}`} />
                <span className="truncate max-w-[62px] sm:max-w-none">
                  {activeFilter === 'all'
                    ? 'Filter'
                    : activeFilter === 'out_for_delivery'
                    ? 'Transit'
                    : activeFilter === 'assigned'
                    ? 'Hub'
                    : activeFilter === 'express'
                    ? 'Express'
                    : activeFilter === 'cod'
                    ? 'COD'
                    : 'Prepaid'}
                </span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeFilter !== 'all' || sortOrder !== 'newest'
                    ? 'bg-white/25 text-white'
                    : 'bg-brand-soft text-brand'
                }`}>
                  {filterCounts[activeFilter]}
                </span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showFilterDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Smooth Floating Popover Menu (Aligned to right-0, perfectly fitted, zero overflow) */}
              {showFilterDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-[1px]"
                    onClick={() => setShowFilterDropdown(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-64 max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-xl border border-slate-200/90 p-2 animate-in fade-in zoom-in-95 duration-150">
                    
                    {/* Header with Reset */}
                    <div className="flex items-center justify-between px-2.5 py-1.5 mb-1 border-b border-slate-100">
                      <span className="text-[10px] font-black tracking-wider uppercase text-slate-400">Filter Deliveries</span>
                      {(activeFilter !== 'all' || sortOrder !== 'newest') && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFilter('all');
                            setSortOrder('newest');
                            setShowFilterDropdown(false);
                          }}
                          className="text-[10px] font-bold text-brand hover:underline cursor-pointer"
                        >
                          Reset All
                        </button>
                      )}
                    </div>

                    {/* Filter Options */}
                    <div className="space-y-0.5">
                      {[
                        { id: 'all', label: 'All Active Parcels', count: filterCounts.all, icon: LayoutDashboard, color: 'text-brand bg-brand-soft' },
                        { id: 'out_for_delivery', label: 'Out for Delivery', count: filterCounts.out_for_delivery, icon: Bike, color: 'text-rose-600 bg-rose-50' },
                        { id: 'assigned', label: 'Ready at Hub', count: filterCounts.assigned, icon: Package, color: 'text-amber-600 bg-amber-50' },
                        { id: 'express', label: 'Express Delivery', count: filterCounts.express, icon: Zap, color: 'text-indigo-600 bg-indigo-50' },
                        { id: 'cod', label: 'Cash on Delivery (COD)', count: filterCounts.cod, icon: IndianRupee, color: 'text-emerald-600 bg-emerald-50' },
                        { id: 'prepaid', label: 'Prepaid Orders', count: filterCounts.prepaid, icon: Wallet, color: 'text-sky-600 bg-sky-50' },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = activeFilter === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setActiveFilter(item.id as FilterType);
                              setShowFilterDropdown(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-brand text-white shadow-2xs'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-white/20 text-white' : item.color
                              }`}>
                                <Icon className="w-3 h-3" />
                              </span>
                              <span className="truncate">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                                isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {item.count}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Sort Section */}
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <div className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase text-slate-400">Sort By</div>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        {[
                          { id: 'newest', label: '⚡ Newest' },
                          { id: 'oldest', label: '⏳ Oldest' },
                          { id: 'amount_high', label: '💰 Highest ₹' },
                          { id: 'amount_low', label: '🪙 Lowest ₹' },
                        ].map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSortOrder(s.id as SortType);
                              setShowFilterDropdown(false);
                            }}
                            className={`px-2 py-1.5 rounded-lg text-[11px] font-bold text-center transition-colors cursor-pointer ${
                              sortOrder === s.id
                                ? 'bg-brand-soft text-brand border border-brand/30'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>
                </>
              )}
            </div>

          </div>

          {/* SCROLLABLE MAIN CONTENT (Takes remaining height: flex-1 min-h-0) */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            {currentTab === 'dashboard' || currentTab === 'deliveries' ? (
              loading && orders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 bg-white border border-slate-200/80 rounded-2xl text-center">
                  <RefreshCw className="w-7 h-7 text-blue-600 animate-spin mb-2" />
                  <p className="text-xs font-bold text-slate-800">Fetching live deliveries...</p>
                </div>
              ) : displayedActiveOrders.length === 0 ? (
                
                /* COMPACT EMPTY STATE (Fits 1 page beautifully!) */
                <div className="h-full min-h-[160px] flex flex-col items-center justify-center p-6 bg-white border border-slate-200/80 rounded-2xl text-center shadow-2xs">
                  <div className="relative inline-flex items-center justify-center mb-3">
                    <div className="w-16 h-16 rounded-full bg-blue-50/80 border border-blue-100/70 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-2xs flex items-center justify-center text-blue-600 border border-blue-100">
                        <Package className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="absolute -left-3 text-blue-400 text-xs font-black select-none">−</div>
                    <div className="absolute -right-3 text-blue-400 text-xs font-black select-none">−</div>
                  </div>

                  <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                    {searchQuery || activeFilter !== 'all' ? 'No Matching Deliveries' : 'No Active Tasks'}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs leading-normal">
                    {searchQuery || activeFilter !== 'all'
                      ? 'Try clearing the search or category filter.'
                      : 'You have cleared all active deliveries! New customer orders will show up here automatically.'}
                  </p>

                  {(searchQuery || activeFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setActiveFilter('all');
                      }}
                      className="mt-2.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

              ) : (
                /* RESPONSIVE ORDER CARDS GRID (Scrollable inside, compact padding) */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {displayedActiveOrders.map((order) => {
                    const { customerName, customerPhone, addressText } = parseDeliveryDetails(order.delivery_address);
                    const isOut = order.order_status === 'out_for_delivery';
                    const isCod = order.payment_method?.toUpperCase() === 'COD';
                    const shortId = order.id.slice(-6).toUpperCase();
                    const isExpanded = !!expandedOrderIds[order.id];
                    const rawItems = Array.isArray(order.items) ? order.items.filter(i => !i.__delivery_meta) : [];

                    return (
                      <div
                        key={order.id}
                        className={`bg-white border rounded-2xl p-3 sm:p-3.5 shadow-2xs transition-all flex flex-col justify-between hover:shadow-xs ${
                          isOut ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200/90'
                        }`}
                      >
                        <div>
                          {/* Top Row: Order ID, Badges */}
                          <div className="flex items-center justify-between gap-1.5 mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-slate-900 tracking-wider">
                                #{shortId}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyOrderId(order.id)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                                title="Copy ID"
                              >
                                {copiedId === order.id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                              {order.is_same_day && (
                                <span className="px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-extrabold uppercase flex items-center gap-0.5">
                                  <Zap className="w-2 h-2 fill-current" />
                                  <span>Express</span>
                                </span>
                              )}
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border flex items-center gap-1 ${
                                isOut
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isOut ? 'bg-blue-600 animate-ping' : 'bg-slate-400'}`} />
                              <span>{isOut ? 'In Transit' : 'Ready (Step 1)'}</span>
                            </span>
                          </div>

                          {/* Customer & Address Details */}
                          <div className="p-2.5 bg-slate-50/80 border border-slate-200/70 rounded-xl space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {customerName.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-800 truncate">{customerName}</p>
                                  {customerPhone && (
                                    <p className="text-[10px] text-slate-400 font-medium truncate">{customerPhone}</p>
                                  )}
                                </div>
                              </div>

                              {customerPhone && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <a
                                    href={`tel:${customerPhone}`}
                                    className="px-2 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold flex items-center gap-1"
                                  >
                                    <Phone className="w-3 h-3 text-blue-600" />
                                    <span>Call</span>
                                  </a>
                                  <a
                                    href={`https://wa.me/91${customerPhone.replace(/[^0-9]/g, '').slice(-10)}?text=${encodeURIComponent(
                                      `Hello ${customerName}, I am your delivery partner from the gift store with order #${shortId}.`
                                    )}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold flex items-center gap-1"
                                  >
                                    <MessageSquare className="w-3 h-3 text-emerald-600" />
                                    <span>WhatsApp</span>
                                  </a>
                                </div>
                              )}
                            </div>

                            <div className="pt-1.5 border-t border-slate-200/60 flex items-start justify-between gap-2">
                              <div className="flex items-start gap-1 text-[11px] text-slate-700 min-w-0">
                                <MapPin className="w-3 h-3 text-blue-600 shrink-0 mt-0.5" />
                                <p className="line-clamp-1 leading-snug">{addressText}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenGoogleMaps(order.delivery_address)}
                                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold shrink-0 flex items-center gap-1 cursor-pointer"
                              >
                                <Navigation className="w-2.5 h-2.5 fill-current" />
                                <span>Map</span>
                              </button>
                            </div>
                          </div>

                          {/* Parcel Items Accordion Toggle */}
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => toggleOrderExpand(order.id)}
                              className="w-full flex items-center justify-between px-1 py-0.5 text-[11px] font-bold text-slate-500 hover:text-blue-600 cursor-pointer"
                            >
                              <span className="flex items-center gap-1">
                                <Package className="w-3 h-3 text-slate-400" />
                                <span>{rawItems.length || 1} Item(s) in Parcel</span>
                              </span>
                              <span className="text-blue-600 text-[10px] font-semibold flex items-center">
                                {isExpanded ? 'Hide' : 'Details'}
                                {isExpanded ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
                              </span>
                            </button>

                            {isExpanded && (
                              <div className="mt-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200/70 space-y-1.5 text-[11px] animate-fadeIn">
                                {rawItems.map((item: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between gap-1.5 py-0.5 border-b border-slate-200/40 last:border-0">
                                    <span className="text-slate-700 font-medium truncate">{item.name || 'Gift Item'}</span>
                                    <span className="text-slate-500 font-bold shrink-0">x{item.quantity || 1}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                        </div>

                        {/* Bottom: Payment Summary & Actions */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                              isCod ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              {isCod ? '💵 Collect COD' : '✓ Prepaid'}
                            </span>
                            <span className="text-sm font-black text-slate-900">
                              ₹{order.total_amount}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            {!isOut ? (
                              <button
                                type="button"
                                disabled={Boolean(order.delivery_issue)}
                                onClick={() => handleStartDelivery(order.id)}
                                className="py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 shadow-2xs cursor-pointer active:scale-98 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Truck className="w-3 h-3" />
                                <span>1. Start Route</span>
                              </button>
                            ) : (
                              <div className="py-1.5 px-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold flex items-center justify-center gap-1">
                                <Check className="w-3 h-3 text-blue-600" />
                                <span>Route Active</span>
                              </div>
                            )}

                            <button
                              type="button"
                              disabled={!isOut || Boolean(order.delivery_issue)}
                              onClick={() => handleOpenOtpModal(order)}
                              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                                isOut && !order.delivery_issue
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs active:scale-98'
                                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-75'
                              }`}
                            >
                              {isOut ? <KeyRound className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                              <span>2. Enter OTP</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            {(['failed', 'reschedule'] as const).map((issue) => {
                              const chosen = order.delivery_issue === issue;
                              return (
                                <button
                                  key={issue}
                                  type="button"
                                  disabled={Boolean(order.delivery_issue)}
                                  onClick={() => handleDeliveryIssue(order, issue)}
                                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 border ${
                                    chosen
                                      ? issue === 'failed'
                                        ? 'bg-rose-50 text-rose-700 border-rose-300'
                                        : 'bg-amber-50 text-amber-700 border-amber-300'
                                      : order.delivery_issue
                                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-75'
                                        : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50 cursor-pointer active:scale-98'
                                  }`}
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  <span>{chosen ? (issue === 'failed' ? 'Failed reported' : 'Reschedule asked') : issue === 'failed' ? 'Delivery failed' : 'Reschedule'}</span>
                                </button>
                              );
                            })}
                          </div>
                          {order.delivery_issue && (
                            <p className="text-[10px] font-medium text-slate-500">Waiting for the admin to act on this order.</p>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )
            ) : currentTab === 'earnings' ? (
              
              /* EARNINGS VIEW (Fits page) */
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Payout & Cash Statement</h3>
                  <p className="text-[11px] text-slate-400">Track all earnings, delivered orders, and cash to deposit</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Total Estimated Payout
                    </span>
                    <p className="text-2xl font-black text-slate-900 mt-1">₹{deliveredOrders.length * 70}</p>
                    <p className="text-[11px] text-blue-700 font-semibold mt-0.5">
                      {deliveredOrders.length} successful deliveries × ₹70
                    </p>
                  </div>

                  <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      COD Cash Collected
                    </span>
                    <p className="text-2xl font-black text-emerald-800 mt-1">₹{codCollectedTotal}</p>
                    <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                      Cash to submit at hub
                    </p>
                  </div>
                </div>
              </div>

            ) : (
              
              /* PROFILE VIEW (Fits page) */
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-4 max-w-lg">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black text-lg shadow-xs ring-4 ring-blue-50">
                    {rider.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">{rider.name}</h3>
                    <p className="text-xs text-slate-500">{rider.phone} • {rider.city || 'Ajmer'}</p>
                    <span className="inline-block mt-0.5 px-2 py-0.2 rounded-full bg-slate-100 text-slate-700 text-[9px] font-bold">
                      ID: {rider.id.slice(-8).toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Assigned Delivery Area</span>
                    <span className="font-bold text-slate-900">{rider.assigned_area || rider.city || 'Central Hub'}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Duty State</span>
                    <span className={`font-bold ${isOnDuty ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isOnDuty ? '🟢 Online (Accepting Deliveries)' : '🔴 Offline (On Leave)'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleToggleDutyStatus}
                    className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer"
                  >
                    {isOnDuty ? 'Go On Leave' : 'Go Online'}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex-1 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>

        </main>

      </div>

      {/* OTP MODAL */}
      {otpModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 w-full sm:max-w-xs rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-3.5 animate-slideUp">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Verify Doorstep OTP</h3>
                  <p className="text-[10px] text-slate-400">
                    Order #{otpModalOrder.id.slice(-6).toUpperCase()} • {parseDeliveryDetails(otpModalOrder.delivery_address).customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOtpModalOrder(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Ask customer for 4-digit security PIN shown on their phone.
            </p>

            {otpError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                <span>{otpError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtpSubmit} className="space-y-3">
              <div>
                <input
                  type="text"
                  maxLength={4}
                  required
                  autoFocus
                  inputMode="numeric"
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="• • • •"
                  className="w-full py-2.5 text-center tracking-[0.5em] text-2xl font-black bg-slate-50 border-2 border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl text-slate-900 focus:outline-none transition-all placeholder:text-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOtpModalOrder(null)}
                  className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={otpLoading || enteredOtp.length < 4}
                  className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs shadow-md shadow-emerald-600/25 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60"
                >
                  {otpLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Verify</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* CIRCLE RADIAL SPEED-DIAL OVERLAY (Opens when Center 'More' Button is clicked) */}
      {showCircleMenu && (
        <>
          {/* Backdrop to close on tap */}
          <div
            className="lg:hidden fixed inset-0 bg-slate-950/45 backdrop-blur-xs z-40 transition-opacity animate-fadeIn"
            onClick={() => setShowCircleMenu(false)}
            aria-hidden="true"
          />

          {/* CIRCULAR POP-OUT OPTIONS (Arranged in a radial fan arc above the center More button) */}
          <div className="lg:hidden fixed bottom-18 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            
            {/* 1. Duty Toggle (Far Left - 170 deg) */}
            <div
              className="absolute pointer-events-auto transition-all duration-300 ease-out animate-scaleIn"
              style={{ transform: 'translate(calc(-50% - 108px), calc(-50% - 22px))' }}
            >
              <button
                type="button"
                onClick={() => {
                  handleToggleDutyStatus();
                  setShowCircleMenu(false);
                }}
                className="flex flex-col items-center gap-1 group cursor-pointer active:scale-90 transition-transform"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl border-2 border-white transition-all group-hover:scale-105 ${
                    isOnDuty
                      ? 'bg-emerald-500 text-white shadow-emerald-500/40 ring-4 ring-emerald-100'
                      : 'bg-rose-500 text-white shadow-rose-500/40 ring-4 ring-rose-100'
                  }`}
                >
                  <Power className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-white/95 text-[10px] font-bold text-slate-800 shadow-md border border-slate-100/80 whitespace-nowrap">
                  {isOnDuty ? 'Online' : 'Offline'}
                </span>
              </button>
            </div>

            {/* 2. Audio Chime Toggle (Mid Left - 130 deg) */}
            <div
              className="absolute pointer-events-auto transition-all duration-300 ease-out animate-scaleIn"
              style={{ transform: 'translate(calc(-50% - 70px), calc(-50% - 84px))' }}
            >
              <button
                type="button"
                onClick={() => {
                  toggleSound();
                  setShowCircleMenu(false);
                }}
                className="flex flex-col items-center gap-1 group cursor-pointer active:scale-90 transition-transform"
              >
                <div className="w-12 h-12 rounded-full bg-white text-blue-600 shadow-xl border-2 border-white flex items-center justify-center shadow-blue-900/15 ring-4 ring-blue-50 group-hover:scale-105 transition-all">
                  {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-slate-400" />}
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-white/95 text-[10px] font-bold text-slate-800 shadow-md border border-slate-100/80 whitespace-nowrap">
                  {soundEnabled ? 'Chime ON' : 'Muted'}
                </span>
              </button>
            </div>

            {/* 3. Doorstep OTP Modal (Top Center - 90 deg Crown) */}
            <div
              className="absolute pointer-events-auto transition-all duration-300 ease-out animate-scaleIn"
              style={{ transform: 'translate(calc(-50% + 0px), calc(-50% - 116px))' }}
            >
              <button
                type="button"
                onClick={() => {
                  const activeOut = activeOrders.find(o => o.order_status === 'out_for_delivery');
                  const activeReady = activeOrders.find(o => o.order_status !== 'out_for_delivery');
                  if (activeOut) {
                    handleOpenOtpModal(activeOut);
                  } else if (activeReady) {
                    handleStartDelivery(activeReady.id);
                  } else {
                    showToast('No active orders to verify', 'info');
                  }
                  setShowCircleMenu(false);
                }}
                className="flex flex-col items-center gap-1 group cursor-pointer active:scale-90 transition-transform"
              >
                <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-brand via-[#1e6eff] to-[#38bdf8] text-white shadow-xl shadow-brand/40 border-2 border-white flex items-center justify-center ring-4 ring-blue-100 group-hover:scale-105 transition-all">
                  <KeyRound className="w-6 h-6" />
                </div>
                <span className="px-3 py-0.5 rounded-full bg-brand text-[10px] font-black text-white shadow-md whitespace-nowrap">
                  Enter OTP
                </span>
              </button>
            </div>

            {/* 4. Support Helpdesk (Mid Right - 50 deg) */}
            <div
              className="absolute pointer-events-auto transition-all duration-300 ease-out animate-scaleIn"
              style={{ transform: 'translate(calc(-50% + 70px), calc(-50% - 84px))' }}
            >
              <button
                type="button"
                onClick={() => {
                  showToast('📞 Support Helpdesk: +91 9876543210', 'info');
                  setShowCircleMenu(false);
                }}
                className="flex flex-col items-center gap-1 group cursor-pointer active:scale-90 transition-transform"
              >
                <div className="w-12 h-12 rounded-full bg-white text-indigo-600 shadow-xl border-2 border-white flex items-center justify-center shadow-indigo-900/15 ring-4 ring-indigo-50 group-hover:scale-105 transition-all">
                  <Headphones className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-white/95 text-[10px] font-bold text-slate-800 shadow-md border border-slate-100/80 whitespace-nowrap">
                  Support
                </span>
              </button>
            </div>

            {/* 5. Sync Tasks (Far Right - 10 deg) */}
            <div
              className="absolute pointer-events-auto transition-all duration-300 ease-out animate-scaleIn"
              style={{ transform: 'translate(calc(-50% + 108px), calc(-50% - 22px))' }}
            >
              <button
                type="button"
                onClick={() => {
                  if (rider?.id) fetchRiderOrders(rider.id);
                  setShowCircleMenu(false);
                }}
                className="flex flex-col items-center gap-1 group cursor-pointer active:scale-90 transition-transform"
              >
                <div className="w-12 h-12 rounded-full bg-white text-slate-700 shadow-xl border-2 border-white flex items-center justify-center shadow-slate-900/15 ring-4 ring-slate-100 group-hover:scale-105 transition-all">
                  <RefreshCw className={`w-5 h-5 text-slate-600 ${loading ? 'animate-spin text-brand' : ''}`} />
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-white/95 text-[10px] font-bold text-slate-800 shadow-md border border-slate-100/80 whitespace-nowrap">
                  Sync Tasks
                </span>
              </button>
            </div>

          </div>
        </>
      )}

      {/* MOBILE FLOATING NAVBAR (EXACT REPLICA OF USER'S ATTACHED IMAGE WITH BUYER-THEME LIGHT BRAND BLUE) */}
      <div className="lg:hidden fixed bottom-4 left-0 right-0 z-40 flex justify-center pointer-events-none px-4">
        <div className="relative w-full max-w-sm pointer-events-auto">

          {/* Smooth curved hump behind center button matching image curve */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-3 w-19 h-9 bg-white rounded-t-full shadow-2xs pointer-events-none" />

          <nav
            aria-label="Bottom Navigation"
            className="w-full bg-white border border-slate-100/80 shadow-[0_10px_35px_-5px_rgba(0,82,255,0.14)] rounded-full h-[62px] relative flex items-center justify-between px-3"
          >
            {/* TAB 1: Home (Active Capsule Pill matching Buyer Side Light Brand Blue Theme) */}
            <button
              type="button"
              onClick={() => setCurrentTab('dashboard')}
              className={`transition-all duration-200 cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-gradient-to-r from-brand via-[#1a6eff] to-[#38bdf8] text-white rounded-full px-4.5 py-2 flex flex-col items-center justify-center shadow-md shadow-brand/35'
                  : 'text-slate-500 hover:text-slate-800 flex flex-col items-center justify-center px-3 py-1'
              }`}
            >
              <Home className={`w-4.5 h-4.5 ${currentTab === 'dashboard' ? 'fill-white stroke-white' : 'stroke-[1.8]'}`} />
              <span className={`text-[10px] mt-0.5 ${currentTab === 'dashboard' ? 'font-bold text-white' : 'font-medium'}`}>
                Home
              </span>
            </button>

            {/* TAB 2: Deliveries */}
            <button
              type="button"
              onClick={() => setCurrentTab('deliveries')}
              className={`transition-all duration-200 cursor-pointer relative ${
                currentTab === 'deliveries'
                  ? 'bg-gradient-to-r from-brand via-[#1a6eff] to-[#38bdf8] text-white rounded-full px-4.5 py-2 flex flex-col items-center justify-center shadow-md shadow-brand/35'
                  : 'text-slate-500 hover:text-slate-800 flex flex-col items-center justify-center px-3 py-1'
              }`}
            >
              <div className="relative">
                <Package className={`w-4.5 h-4.5 ${currentTab === 'deliveries' ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
                {activeOrders.length > 0 && currentTab !== 'deliveries' && (
                  <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                )}
              </div>
              <span className={`text-[10px] mt-0.5 ${currentTab === 'deliveries' ? 'font-bold text-white' : 'font-medium'}`}>
                Deliveries
              </span>
            </button>

            {/* CENTER ELEVATED BUTTON: DELIVERY VEHICLE / MORE RADIAL TRIGGER (Buyer Theme Lighter Electric Gradient) */}
            <div className="relative flex items-center justify-center -top-4">
              <button
                type="button"
                onClick={() => setShowCircleMenu(!showCircleMenu)}
                className={`w-14 h-14 rounded-full bg-gradient-to-tr from-brand via-[#1a6eff] to-[#38bdf8] text-white shadow-[0_8px_24px_rgba(0,82,255,0.42)] border-4 border-white flex items-center justify-center cursor-pointer active:scale-95 transition-all duration-200 z-30 ${
                  showCircleMenu ? 'rotate-90 bg-rose-600 shadow-rose-600/45' : 'hover:scale-105'
                }`}
                title="More: Tap to open circular options"
                aria-label="More options"
              >
                {showCircleMenu ? (
                  <X className="w-6 h-6 stroke-[2.5]" />
                ) : (
                  /* Custom Delivery Cargo Loader Icon exactly matching image */
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-6.5 h-6.5"
                  >
                    {/* Rear Cargo Box */}
                    <path d="M14 6h5a1 1 0 0 1 1 1v6h-7.5V6z" />
                    <line x1="16.5" y1="6" x2="16.5" y2="13" />
                    {/* Front Cabin & Chassis */}
                    <path d="M4 11h9" />
                    <path d="M6 7.5h3.5l3.5 5.5" />
                    {/* Front & Rear Wheels */}
                    <circle cx="7" cy="17" r="2.2" fill="currentColor" />
                    <circle cx="16.5" cy="17" r="2.2" fill="currentColor" />
                  </svg>
                )}
              </button>
            </div>

            {/* TAB 3: Earnings (Rupee inside circle matching screenshot) */}
            <button
              type="button"
              onClick={() => setCurrentTab('earnings')}
              className={`transition-all duration-200 cursor-pointer ${
                currentTab === 'earnings'
                  ? 'bg-gradient-to-r from-brand via-[#1a6eff] to-[#38bdf8] text-white rounded-full px-4.5 py-2 flex flex-col items-center justify-center shadow-md shadow-brand/35'
                  : 'text-slate-500 hover:text-slate-800 flex flex-col items-center justify-center px-3 py-1'
              }`}
            >
              <div
                className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center ${
                  currentTab === 'earnings' ? 'border-white text-white' : 'border-slate-500 text-slate-500'
                }`}
              >
                <span className="text-[9.5px] font-bold leading-none">₹</span>
              </div>
              <span className={`text-[10px] mt-0.5 ${currentTab === 'earnings' ? 'font-bold text-white' : 'font-medium'}`}>
                Earnings
              </span>
            </button>

            {/* TAB 4: Profile (Outline user icon matching screenshot) */}
            <button
              type="button"
              onClick={() => setCurrentTab('profile')}
              className={`transition-all duration-200 cursor-pointer ${
                currentTab === 'profile'
                  ? 'bg-gradient-to-r from-brand via-[#1a6eff] to-[#38bdf8] text-white rounded-full px-4.5 py-2 flex flex-col items-center justify-center shadow-md shadow-brand/35'
                  : 'text-slate-500 hover:text-slate-800 flex flex-col items-center justify-center px-3 py-1'
              }`}
            >
              <User className={`w-4.5 h-4.5 ${currentTab === 'profile' ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
              <span className={`text-[10px] mt-0.5 ${currentTab === 'profile' ? 'font-bold text-white' : 'font-medium'}`}>
                Profile
              </span>
            </button>
          </nav>
        </div>
      </div>

    </div>
  );
};

export default RiderPortalPage;
