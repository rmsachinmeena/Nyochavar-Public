import { orderModel } from '../models/orderModel.js';
import { couponModel } from '../models/couponModel.js';
import { auditLogger } from '../services/auditLogger.js';
import { deliveryPartnerModel } from '../models/deliveryPartnerModel.js';
import { prepareOrder, runOrderPlacedEffects } from '../services/orderPricing.js';
import { notifyUser } from '../services/notificationService.js';
import { checkPreviousCheckouts, flagRefundDue, markRefundedByHand, parsePaymentRef } from '../services/paymentSettlement.js';

// What customers are told about refunds (keep in line with the Refund & Cancellation Policy page)
const REFUND_PROMISE = 'We start your refund within 2 business days, and your bank usually takes 5 to 7 business days after that.';

// An online order whose payment never went through (still waiting, or given up): not a real order yet
const isUnpaidOnline = (order) =>
  Boolean(parsePaymentRef(order.payment_ref).rzpOrderId) && order.payment_status !== 'paid' && order.payment_status !== 'refunded';

// A cancelled order that Razorpay still holds money for
const needsRefund = (order) => order.payment_status === 'paid' && Boolean(parsePaymentRef(order.payment_ref).rzpPaymentId);

export const orderController = {
  // Get all orders (for SuperAdmin with optional filters)
  getAllOrders: async (req, res) => {
    try {
      const { status, payment_status, payment_method, buyer_id } = req.query;
      const filters = {};
      if (status) filters.order_status = status;
      if (payment_status) filters.payment_status = payment_status;
      if (payment_method) filters.payment_method = payment_method;
      if (buyer_id) filters.buyer_id = buyer_id;

      const orders = await orderModel.findAll(filters);
      res.status(200).json({ success: true, orders, count: orders.length });
    } catch (error) {
      console.error('Error fetching all orders for admin:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch all orders' });
    }
  },

  // Place a cash-on-delivery order. Online payments (UPI / card) go through /api/payments so the money is really
  // collected and verified before the order counts as paid.
  createOrder: async (req, res) => {
    try {
      const prepared = await prepareOrder(req.body);
      if (!prepared.ok) {
        return res.status(prepared.status).json({ success: false, message: prepared.message });
      }

      const { orderData, meta } = prepared;
      if (orderData.payment_method !== 'COD') {
        return res.status(400).json({
          success: false,
          code: 'ONLINE_PAYMENT_REQUIRED',
          message: 'Please complete the online payment to place this order.'
        });
      }

      // A shopper whose earlier online payment went through (but the page never heard back) should not order twice.
      // If Razorpay cannot be reached the COD order still goes ahead: nobody is charged twice for cash on delivery.
      const previous = await checkPreviousCheckouts(orderData.buyer_id).catch((err) => {
        console.warn('Could not check earlier online checkouts before a COD order:', err.message);
        return null;
      });
      if (previous) {
        return res.status(409).json({ success: false, code: previous.code, message: previous.message });
      }

      // ATOMIC CLAIM: Strictly claim coupon slot before order creation to prevent race conditions
      let couponClaimed = false;
      if (meta.couponCode) {
        const claimResult = await couponModel.claimCouponAtomic(meta.couponCode, orderData.buyer_id);
        if (!claimResult.success) {
          return res.status(400).json({
            success: false,
            code: claimResult.error_code || 'COUPON_LIMIT_REACHED',
            message: claimResult.message || `Coupon "${meta.couponCode}" limit reached or unavailable.`
          });
        }
        couponClaimed = true;
        meta.couponAlreadyClaimed = true;
      }

      let createdOrder;
      try {
        createdOrder = await orderModel.create(orderData);
      } catch (orderErr) {
        if (couponClaimed) {
          await couponModel.releaseCouponAtomic(meta.couponCode).catch(() => {});
        }
        throw orderErr;
      }

      await runOrderPlacedEffects(createdOrder, meta);
      void notifyUser('order_placed', { userId: createdOrder.buyer_id, order: createdOrder });

      res.status(201).json({
        success: true,
        message: 'Order placed successfully',
        order: createdOrder
      });
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({ error: error.message || 'Failed to place order' });
    }
  },

  // Get orders by buyer ID
  getBuyerOrders: async (req, res) => {
    try {
      const { buyerId } = req.params;
      // Checkouts that were given up without paying are not orders: keep them out of "My Orders". An order whose
      // payment is still being confirmed stays visible (shown as "Confirming payment").
      const orders = (await orderModel.findByBuyerId(buyerId)).filter(
        (order) => !(order.order_status === 'cancelled' && isUnpaidOnline(order))
      );
      res.status(200).json({ success: true, orders });
    } catch (error) {
      console.error('Error fetching buyer orders:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch orders' });
    }
  },

  // Get order by ID
  getOrderById: async (req, res) => {
    try {
      const { id } = req.params;
      const order = await orderModel.findById(id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      // Buyers may only read their own orders (admins may read any)
      if (req.auth?.role === 'buyer' && order.buyer_id !== req.auth.id) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN_OWNER', error: 'You can only access your own data.' });
      }
      res.status(200).json({ success: true, order });
    } catch (error) {
      console.error('Error fetching order:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch order' });
    }
  },

  // Customer cancels their own order (only before it is out for delivery)
  cancelMyOrder: async (req, res) => {
    try {
      const { id } = req.params;
      const order = await orderModel.findById(id);
      if (!order || order.buyer_id !== req.auth.id) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      // Once a delivery partner is assigned the order is being handled, so the customer can no longer cancel it
      const cancelled = order.delivery_partner_id ? null : await orderModel.cancelByBuyer(id, req.auth.id);
      if (!cancelled) {
        const message = order.order_status === 'cancelled'
          ? 'This order is already cancelled.'
          : order.delivery_partner_id && ['placed', 'processing'].includes(order.order_status)
            ? 'A delivery partner is already assigned, so this order can no longer be cancelled.'
            : 'This order can no longer be cancelled because it is already on its way or delivered.';
        return res.status(409).json({ success: false, error: message });
      }

      void notifyUser('order_cancelled', { userId: cancelled.buyer_id, order: cancelled });

      // Release coupon usage if this order used a coupon
      if (order.coupon_code) {
        await couponModel.releaseCouponAtomic(order.coupon_code).catch((err) => {
          console.warn('⚠️ Could not release coupon on customer cancellation:', err.message);
        });
      }

      // Paid online: flag the refund for the store team, who issue it from the Razorpay dashboard
      const paidOnline = needsRefund(cancelled);
      const finalOrder = paidOnline ? await flagRefundDue(cancelled, 'Cancelled by the customer') : cancelled;
      res.status(200).json({
        success: true,
        message: paidOnline ? `Your order has been cancelled. ${REFUND_PROMISE}` : 'Your order has been cancelled.',
        order: finalOrder
      });
    } catch (error) {
      console.error('Error cancelling order:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to cancel order' });
    }
  },

  // Update order status
  updateOrderStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const current = await orderModel.findById(id);
      if (!current) return res.status(404).json({ success: false, error: 'Order not found' });
      // An online order waiting for payment changes by itself once Razorpay answers; moving it by hand could send an unpaid gift
      if (current.order_status === 'awaiting_payment') {
        return res.status(409).json({
          success: false,
          error: 'This order is waiting for the customer’s online payment. It becomes "Placed" automatically once paid, or is cancelled if not.'
        });
      }

      const cancelling = String(status).toLowerCase() === 'cancelled';
      // Money already given back (fully or partly): re-opening the order would ship a gift nobody paid for
      if (['processed', 'partial'].includes(current.refund_status) && !cancelling) {
        return res.status(409).json({ success: false, error: 'This order has been refunded, so it cannot be re-opened. Ask the customer to order again.' });
      }

      let updated = await orderModel.updateStatus(id, status);

      // Release coupon usage if order was cancelled by admin
      if (cancelling && current.coupon_code && current.order_status !== 'cancelled') {
        await couponModel.releaseCouponAtomic(current.coupon_code).catch((err) => {
          console.warn('⚠️ Could not release coupon on admin order cancellation:', err.message);
        });
      }

      if (cancelling && updated && needsRefund(updated)) {
        // Cancelling a paid online order: the refund is due, to be issued from the Razorpay dashboard
        updated = await flagRefundDue(updated, 'Cancelled by the store');
      } else if (!cancelling && current.refund_status === 'due') {
        // Re-opened before anyone refunded it: the money is still with us, so no refund is due any more
        await orderModel.clearRefundDue(id);
        updated = await orderModel.findById(id);
      }

      // Customer-facing messages for the statuses a customer cares about (each is sent once per order)
      const statusEvent = { cancelled: 'order_cancelled', delivered: 'delivered', out_for_delivery: 'out_for_delivery' }[String(status).toLowerCase()];
      if (statusEvent && updated) {
        void notifyUser(statusEvent, { userId: updated.buyer_id, order: updated, deliveryOtp: statusEvent === 'out_for_delivery' ? updated.delivery_otp : undefined });
      }
      
      // Record in audit log
      await auditLogger.log({
        action: `ORDER_${status.toUpperCase()}`,
        table_affected: 'orders',
        record_id: id
      });

      res.status(200).json({ success: true, order: updated });
    } catch (error) {
      console.error('Error updating order status:', error);
      res.status(500).json({ error: error.message || 'Failed to update status' });
    }
  },

  // SuperAdmin assigns an order to a delivery partner
  assignRider: async (req, res) => {
    try {
      const { id } = req.params;
      const { partnerId, partnerName, partnerPhone } = req.body;

      if (!partnerId) {
        return res.status(400).json({ success: false, message: 'Delivery partner ID is required' });
      }

      const order = await orderModel.findById(id);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
      if (order.order_status === 'cancelled' || isUnpaidOnline(order)) {
        return res.status(400).json({
          success: false,
          message: order.order_status === 'cancelled'
            ? 'This order is cancelled.'
            : 'This order has not been paid yet, so it cannot be sent out for delivery.'
        });
      }

      // Check partner duty status to ensure riders on break cannot be assigned
      const partner = await deliveryPartnerModel.findById(partnerId);
      if (partner) {
        if (partner.is_active === false) {
          return res.status(400).json({
            success: false,
            message: `Rider ${partner.name || 'partner'} account is inactive/disabled and cannot receive assignments.`
          });
        }
        if (partner.duty_status === 'on_leave') {
          return res.status(400).json({
            success: false,
            message: `Rider ${partner.name || 'partner'} is currently on break / offline. Orders cannot be assigned to riders on break.`
          });
        }
      }

      const updated = await orderModel.assignRider(id, {
        id: partnerId,
        name: partner?.name || partnerName || 'Assigned Delivery Partner',
        phone: partner?.phone || partnerPhone || ''
      });

      void notifyUser('rider_assigned', { userId: updated.buyer_id, order: updated, riderName: partner?.name || partnerName });

      await auditLogger.log({
        action: 'ORDER_ASSIGNED_RIDER',
        table_affected: 'orders',
        record_id: id
      });

      return res.status(200).json({
        success: true,
        message: `Order #${id.slice(-6).toUpperCase()} assigned to ${partner?.name || partnerName || 'delivery partner'}! Delivery OTP generated.`,
        order: updated
      });
    } catch (error) {
      console.error('Error assigning rider to order:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to assign rider' });
    }
  },

  // SuperAdmin: "Mark as refunded" after issuing the refund in the Razorpay dashboard. Normally the refund webhook does
  // this by itself; this is the fallback when the webhook did not update the order. Body: { refund_id?: 'rfnd_...' }
  markRefunded: async (req, res) => {
    try {
      const { id } = req.params;
      const refundId = String(req.body?.refund_id || '').trim();
      if (refundId && !/^rfnd_[A-Za-z0-9]{6,30}$/.test(refundId)) {
        return res.status(400).json({ success: false, message: 'A Razorpay refund ID looks like rfnd_XXXXXXXXXXXXXX. Leave it empty if you do not have it.' });
      }

      const order = await orderModel.findById(id);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
      if (order.payment_status === 'refunded') {
        return res.status(200).json({ success: true, message: 'This order is already marked refunded.', order });
      }
      if (order.refund_status !== 'due') {
        return res.status(400).json({ success: false, message: 'Only orders with a refund due can be marked refunded.' });
      }

      const updated = (await markRefundedByHand(order, refundId || null)) || (await orderModel.findById(id));
      await auditLogger.log({ action: 'ORDER_MARKED_REFUNDED', table_affected: 'orders', record_id: id });
      return res.status(200).json({ success: true, message: 'Order marked as refunded. The customer has been told.', order: updated });
    } catch (error) {
      console.error('Error marking order refunded:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to mark the order refunded' });
    }
  },

  // Permanently delete one or many orders (SuperAdmin multi-select). Body: { ids: string[] }
  bulkDeleteOrders: async (req, res) => {
    try {
      const deletedIds = await orderModel.deleteMany(req.body.ids);

      await auditLogger.logMany({
        action: 'DELETE_ORDER',
        table_affected: 'orders',
        record_ids: deletedIds
      });

      return res.status(200).json({
        success: true,
        deleted: deletedIds.length,
        ids: deletedIds,
        message: `${deletedIds.length} order(s) deleted successfully`
      });
    } catch (error) {
      console.error('Error deleting orders:', error);
      return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to delete orders' });
    }
  }
};
