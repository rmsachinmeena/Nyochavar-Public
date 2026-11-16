import bcrypt from 'bcryptjs';
import { deliveryPartnerModel } from '../models/deliveryPartnerModel.js';
import { orderModel } from '../models/orderModel.js';
import { auditLogger } from '../services/auditLogger.js';
import { deliveryOtpAttempts, riderLoginAttempts } from '../src/services/attemptGuard.js';
import { issueSession } from '../src/services/tokenService.js';
import { notifyUser } from '../services/notificationService.js';

// Same cost as a real check so "unknown phone" and "wrong PIN" take equally long
const DUMMY_HASH = bcrypt.hashSync('not-a-real-pin', 10);

// The customer's delivery OTP is what proves the handover: the rider must never be able to read it
const withoutOtp = (order) => {
  if (!order) return order;
  const { delivery_otp, ...rest } = order;
  return rest;
};

const publicPartner = (partner) => ({
  id: partner.id,
  name: partner.name,
  phone: partner.phone,
  city: partner.city,
  assigned_area: partner.assigned_area,
  duty_status: partner.duty_status || 'on_duty'
});

const ISSUE_OPEN_MESSAGE = 'A delivery issue is already reported for this order. Please wait for the admin to act on it.';

// A rider may only act on orders assigned to them
const loadAssignedOrder = async (orderId, riderId) => {
  const order = await orderModel.findById(orderId);
  if (!order) return { error: { status: 404, message: 'Order not found' } };
  if (order.delivery_partner_id !== riderId) {
    return { error: { status: 403, message: 'This order is not assigned to you.' } };
  }
  return { order };
};

export const riderController = {
  // Rider Login using Phone & PIN (PIN is set/reset by a superadmin)
  login: async (req, res) => {
    try {
      const cleanPhone = String(req.body?.phone || '').trim();
      const enteredPin = String(req.body?.pin || req.body?.password || '').trim();

      if (!cleanPhone || !enteredPin) {
        return res.status(400).json({ success: false, message: 'Phone number and PIN are required' });
      }

      const lockedFor = riderLoginAttempts.lockedFor(cleanPhone);
      if (lockedFor > 0) {
        return res.status(429).json({
          success: false,
          code: 'ACCOUNT_LOCKED',
          retryAfter: lockedFor,
          message: `Too many wrong PIN attempts. Try again in ${Math.ceil(lockedFor / 60)} minute(s).`
        });
      }

      const partner = await deliveryPartnerModel.findAuthByPhone(cleanPhone);
      // Always run one bcrypt compare, so unknown numbers cannot be told apart by response time
      const pinOk = await bcrypt.compare(enteredPin, partner?.pin_hash || DUMMY_HASH);

      if (!partner || !partner.pin_hash || !pinOk) {
        riderLoginAttempts.fail(cleanPhone);
        return res.status(401).json({ success: false, message: 'Invalid phone number or PIN.' });
      }

      if (partner.is_active === false) {
        return res.status(403).json({
          success: false,
          message: 'Your delivery partner account is currently deactivated.'
        });
      }

      riderLoginAttempts.reset(cleanPhone);

      const { token, refreshToken, expiresIn } = await issueSession(
        'rider',
        { id: partner.id, email: partner.phone, name: partner.name },
        res
      );

      await auditLogger.log({
        actor: { role: 'rider', id: partner.id },
        action: 'RIDER_LOGIN',
        table_affected: 'delivery_partners',
        record_id: partner.id
      });

      const profile = publicPartner(partner);
      return res.status(200).json({
        success: true,
        message: 'Rider authenticated successfully',
        token,
        refreshToken,
        expiresIn,
        partner: profile,
        rider: profile
      });
    } catch (error) {
      console.error('Rider login error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Server error during rider login' });
    }
  },

  // Get all orders assigned to this rider (route is guarded: :riderId must be the caller)
  getMyOrders: async (req, res) => {
    try {
      const orders = (await orderModel.findByRiderId(req.auth.id)).map(withoutOtp);

      // Separate into active and completed
      const active = orders.filter(o => o.order_status !== 'delivered' && o.order_status !== 'cancelled');
      const delivered = orders.filter(o => o.order_status === 'delivered');

      return res.status(200).json({
        success: true,
        orders,
        activeOrders: active,
        deliveredOrders: delivered,
        counts: {
          total: orders.length,
          active: active.length,
          delivered: delivered.length
        }
      });
    } catch (error) {
      console.error('Error fetching rider orders:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to fetch assigned orders' });
    }
  },

  // Rider marks an assigned order as Out for Delivery
  markOutForDelivery: async (req, res) => {
    try {
      const { orderId } = req.params;
      const { error, order } = await loadAssignedOrder(orderId, req.auth.id);
      if (error) return res.status(error.status).json({ success: false, message: error.message });
      if (order.delivery_issue) return res.status(409).json({ success: false, message: ISSUE_OPEN_MESSAGE });

      const updatedOrder = await orderModel.markOutForDelivery(orderId, req.auth.id);
      void notifyUser('out_for_delivery', { userId: updatedOrder.buyer_id, order: updatedOrder, deliveryOtp: updatedOrder.delivery_otp });

      await auditLogger.log({
        action: 'ORDER_OUT_FOR_DELIVERY',
        table_affected: 'orders',
        record_id: orderId
      });

      return res.status(200).json({
        success: true,
        message: 'Order status updated to Out for Delivery! Customer has been notified with Delivery OTP.',
        order: withoutOtp(updatedOrder)
      });
    } catch (error) {
      console.error('Error marking out for delivery:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to update order status' });
    }
  },

  // Rider enters the customer's Delivery OTP to finalize delivery
  verifyDeliveryOtp: async (req, res) => {
    try {
      const { orderId } = req.params;
      const otp = String(req.body?.otp || '').trim();

      if (!/^\d{4}$/.test(otp)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide the 4-digit Delivery Confirmation OTP received by the customer.'
        });
      }

      const { error, order: assigned } = await loadAssignedOrder(orderId, req.auth.id);
      if (error) return res.status(error.status).json({ success: false, message: error.message });
      if (assigned.delivery_issue) return res.status(409).json({ success: false, message: ISSUE_OPEN_MESSAGE });

      const lockedFor = deliveryOtpAttempts.lockedFor(orderId);
      if (lockedFor > 0) {
        return res.status(429).json({
          success: false,
          code: 'ACCOUNT_LOCKED',
          retryAfter: lockedFor,
          message: `Too many wrong OTP attempts for this order. Try again in ${Math.ceil(lockedFor / 60)} minute(s).`
        });
      }

      let deliveredOrder;
      try {
        deliveredOrder = await orderModel.verifyDeliveryOtp(orderId, otp);
      } catch (verifyError) {
        if (/Invalid Delivery/i.test(verifyError.message)) deliveryOtpAttempts.fail(orderId);
        throw verifyError;
      }
      deliveryOtpAttempts.reset(orderId);
      void notifyUser('delivered', { userId: deliveredOrder.buyer_id, order: deliveredOrder });

      await auditLogger.log({
        action: 'ORDER_DELIVERED_WITH_OTP',
        table_affected: 'orders',
        record_id: orderId
      });

      return res.status(200).json({
        success: true,
        message: '🎉 Delivery Confirmation OTP Verified! Order successfully completed.',
        order: withoutOtp(deliveredOrder)
      });
    } catch (error) {
      if (/^Invalid Delivery Confirmation OTP/.test(error?.message || '')) {
        console.warn(`⚠️ Wrong delivery OTP entered for order ${req.params.orderId}`);
      } else {
        console.error('Delivery OTP verification error:', error);
      }
      return res.status(400).json({
        success: false,
        message: error.message || 'Invalid Delivery OTP'
      });
    }
  },

  // Rider reports "failed" or "reschedule" for an assigned order. One tap: the order is flagged for the superadmin
  // and the rider can no longer start the route or enter an OTP for it.
  reportDeliveryIssue: async (req, res) => {
    try {
      const { orderId } = req.params;
      const issue = String(req.body?.issue || '').trim();
      if (issue !== 'failed' && issue !== 'reschedule') {
        return res.status(400).json({ success: false, message: "issue must be 'failed' or 'reschedule'" });
      }

      const { error, order } = await loadAssignedOrder(orderId, req.auth.id);
      if (error) return res.status(error.status).json({ success: false, message: error.message });
      if (order.delivery_issue) return res.status(409).json({ success: false, message: ISSUE_OPEN_MESSAGE });

      const updated = await orderModel.reportDeliveryIssue(orderId, req.auth.id, issue);
      if (!updated) {
        return res.status(409).json({ success: false, message: 'This order is no longer open for delivery.' });
      }

      return res.status(200).json({
        success: true,
        message: issue === 'failed' ? 'Marked as delivery failed. The admin has been informed.' : 'Reschedule requested. The admin has been informed.',
        order: withoutOtp(updated)
      });
    } catch (error) {
      console.error('Error reporting delivery issue:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to report the delivery issue' });
    }
  },

  // Toggle Rider Duty Status (on_duty vs on_leave): always the caller's own status
  updateDutyStatus: async (req, res) => {
    try {
      const { duty_status } = req.body;
      if (duty_status !== 'on_duty' && duty_status !== 'on_leave') {
        return res.status(400).json({ success: false, message: "duty_status must be 'on_duty' or 'on_leave'" });
      }
      const updated = await deliveryPartnerModel.update(req.auth.id, { duty_status });
      return res.status(200).json({
        success: true,
        partner: updated,
        message: `Rider is now ${duty_status === 'on_duty' ? 'On Work (Available)' : 'On Leave'}`
      });
    } catch (error) {
      console.error('Update duty status error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};

export default riderController;
