import { couponModel } from '../models/couponModel.js';
import { auditLogger } from '../services/auditLogger.js';

export const couponController = {
  // Validate a coupon for checkout
  validateCoupon: async (req, res) => {
    try {
      const { code, order_amount, orderAmount, items } = req.body;
      // Cart lines let product-specific coupons find their product; the subtotal is then derived from the same lines
      const cartItems = Array.isArray(items) ? items.slice(0, 100) : [];
      const amount = cartItems.length > 0
        ? couponModel.cartSubtotal(cartItems)
        : (order_amount !== undefined ? order_amount : (orderAmount !== undefined ? orderAmount : 0));

      if (!code || typeof code !== 'string') {
        return res.status(400).json({
          success: false,
          valid: false,
          message: 'Please provide a coupon code.'
        });
      }

      const userId = req.body?.user_id || req.body?.userId || req.user?.id || req.auth?.id || null;
      const result = await couponModel.validateCoupon(code, Number(amount), userId, cartItems);

      if (!result.valid) {
        return res.status(400).json({
          success: false,
          valid: false,
          message: result.message,
          shortfall: result.shortfall || 0,
          min_order_amount: result.min_order_amount || 0
        });
      }

      return res.status(200).json({
        success: true,
        valid: true,
        ...result
      });
    } catch (error) {
      console.error('Error validating coupon:', error);
      return res.status(500).json({
        success: false,
        valid: false,
        message: error.message || 'Server error validating coupon.'
      });
    }
  },

  // Get all active coupons (public promo listing)
  getActiveCoupons: async (req, res) => {
    try {
      const coupons = await couponModel.findAll({ is_active: true });
      // Exclude expired ones from active listing
      const now = new Date();
      const validCoupons = coupons.filter(c => {
        if (!c.expiry_date) return true;
        const expiry = c.expiry_date.length === 10
          ? new Date(`${c.expiry_date}T23:59:59.999Z`)
          : new Date(c.expiry_date);
        return expiry >= now;
      });

      return res.status(200).json({
        success: true,
        coupons: validCoupons
      });
    } catch (error) {
      console.error('Error fetching active coupons:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch active coupons.'
      });
    }
  },

  // Create a coupon (admin)
  createCoupon: async (req, res) => {
    try {
      const {
        code,
        discount_type,
        discount_value,
        min_order_amount,
        max_discount,
        expiry_date,
        usage_limit,
        per_user_limit,
        first_order_only,
        is_active
      } = req.body;

      if (!code || !discount_type || discount_value === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Code, discount_type (flat/percentage), and discount_value are required.'
        });
      }

      const newCoupon = await couponModel.create({
        code,
        discount_type,
        discount_value: Number(discount_value),
        min_order_amount: Number(min_order_amount) || 0,
        max_discount: max_discount ? Number(max_discount) : null,
        expiry_date: expiry_date || null,
        usage_limit: usage_limit ? Number(usage_limit) : null,
        per_user_limit: per_user_limit ? Number(per_user_limit) : 1,
        first_order_only: first_order_only !== undefined ? Boolean(first_order_only) : false,
        is_active: is_active !== undefined ? Boolean(is_active) : true
      });

      await auditLogger.log({
        action: 'CREATE_COUPON',
        table_affected: 'coupons',
        record_id: newCoupon?.id || null
      });

      return res.status(201).json({
        success: true,
        message: `Coupon "${newCoupon.code}" created successfully.`,
        coupon: newCoupon
      });
    } catch (error) {
      console.error('Error creating coupon:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to create coupon.'
      });
    }
  },

  // Get all coupons for Admin (active and inactive, with stats)
  getAllCouponsAdmin: async (req, res) => {
    try {
      const coupons = await couponModel.findAll();
      return res.status(200).json({
        success: true,
        coupons
      });
    } catch (error) {
      console.error('Error fetching admin coupons:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch coupons.'
      });
    }
  },

  // Update an existing coupon (admin)
  updateCoupon: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        code,
        discount_type,
        discount_value,
        min_order_amount,
        max_discount,
        expiry_date,
        usage_limit,
        per_user_limit,
        first_order_only,
        is_active
      } = req.body;

      const updates = {};
      if (code !== undefined) updates.code = code.trim().toUpperCase();
      if (discount_type !== undefined) updates.discount_type = discount_type;
      if (discount_value !== undefined) updates.discount_value = Number(discount_value);
      if (min_order_amount !== undefined) updates.min_order_amount = Number(min_order_amount);
      if (max_discount !== undefined) updates.max_discount = max_discount ? Number(max_discount) : null;
      if (expiry_date !== undefined) updates.expiry_date = expiry_date || null;
      if (usage_limit !== undefined) updates.usage_limit = usage_limit ? Number(usage_limit) : null;
      if (per_user_limit !== undefined) updates.per_user_limit = per_user_limit ? Number(per_user_limit) : 1;
      if (first_order_only !== undefined) updates.first_order_only = Boolean(first_order_only);
      if (is_active !== undefined) updates.is_active = Boolean(is_active);

      const updated = await couponModel.update(id, updates);

      await auditLogger.log({
        action: 'UPDATE_COUPON',
        table_affected: 'coupons',
        record_id: id
      });

      return res.status(200).json({
        success: true,
        message: 'Coupon updated successfully.',
        coupon: updated
      });
    } catch (error) {
      console.error('Error updating coupon:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to update coupon.'
      });
    }
  },

  // Toggle coupon status (admin)
  toggleCouponStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const coupon = await couponModel.findById(id);
      if (!coupon) {
        return res.status(404).json({ success: false, message: 'Coupon not found.' });
      }

      const updated = await couponModel.update(id, { is_active: !coupon.is_active });

      await auditLogger.log({
        action: 'TOGGLE_COUPON_STATUS',
        table_affected: 'coupons',
        record_id: id
      });

      return res.status(200).json({
        success: true,
        message: `Coupon is now ${updated.is_active ? 'Active' : 'Disabled'}.`,
        coupon: updated
      });
    } catch (error) {
      console.error('Error toggling coupon status:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to toggle coupon status.'
      });
    }
  },

  // Delete a coupon (admin)
  deleteCoupon: async (req, res) => {
    try {
      const { id } = req.params;
      await couponModel.delete(id);

      await auditLogger.log({
        action: 'DELETE_COUPON',
        table_affected: 'coupons',
        record_id: id
      });

      return res.status(200).json({
        success: true,
        message: 'Coupon deleted successfully.'
      });
    } catch (error) {
      console.error('Error deleting coupon:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete coupon.'
      });
    }
  }
};

export default couponController;
