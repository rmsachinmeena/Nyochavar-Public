import { productModel } from '../models/productModel.js';
import { auditLogger } from '../services/auditLogger.js';

export const productController = {
  // GET /api/products
  getAllProducts: async (req, res) => {
    try {
      const filters = {};
      if (req.query.active_only === 'true') {
        filters.is_active = true;
      }
      if (req.query.category_id) {
        filters.category_id = req.query.category_id;
      }
      if (req.query.is_customizable !== undefined) {
        filters.is_customizable = req.query.is_customizable === 'true';
      }

      const products = await productModel.findAll(filters);
      return res.status(200).json({
        success: true,
        count: products.length,
        products
      });
    } catch (error) {
      console.error('Error in getAllProducts:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch products',
        error: error.message
      });
    }
  },

  // GET /api/products/:id
  getProductById: async (req, res) => {
    try {
      const { id } = req.params;
      const product = await productModel.findById(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      return res.status(200).json({
        success: true,
        product
      });
    } catch (error) {
      console.error('Error in getProductById:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch product',
        error: error.message
      });
    }
  },

  // POST /api/products
  createProduct: async (req, res) => {
    try {
      const {
        name,
        description,
        base_price,
        price,
        category,
        category_id,
        images,
        image,
        is_customizable,
        is_trending,
        has_gift_wrap,
        express_delivery_available,
        review_snippet,
        is_eco_friendly,
        is_top_rated_this_week,
        is_personalization_available,
        loyalty_points_value,
        stock,
        is_active,
        tagline,
        mrp,
        is_new,
        isNew,
        is_bestseller,
        isBestSeller,
        is_budget_friendly,
        rating,
        review_count,
        reviewCount,
        occasions,
        badges,
        delivery_charge,
        is_free_delivery,
        delivery_time_text,
        coupon_code,
        min_order_amount,
        max_discount,
        variants
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Product name is required'
        });
      }

      const effectivePrice = base_price !== undefined ? base_price : price;
      if (effectivePrice === undefined || effectivePrice === null) {
        return res.status(400).json({
          success: false,
          message: 'Product price is required'
        });
      }

      const newProduct = await productModel.create({
        name: name.trim(),
        tagline: tagline ? String(tagline).trim() : '',
        description: description || '',
        base_price: Number(effectivePrice),
        mrp: mrp ? Number(mrp) : null,
        category: category || null,
        category_id: category_id || null,
        images: images || (image ? [image] : []),
        occasions: occasions || [],
        badges: badges || [],
        is_customizable: is_customizable !== undefined ? Boolean(is_customizable) : false,
        is_trending: Boolean(is_trending),
        has_gift_wrap: Boolean(has_gift_wrap),
        express_delivery_available: Boolean(express_delivery_available),
        review_snippet: review_snippet ? String(review_snippet).trim() : null,
        is_eco_friendly: Boolean(is_eco_friendly),
        is_top_rated_this_week: Boolean(is_top_rated_this_week),
        is_personalization_available: Boolean(is_personalization_available),
        is_bestseller: Boolean(is_bestseller || isBestSeller),
        is_budget_friendly: Boolean(is_budget_friendly),
        is_new: is_new !== undefined ? Boolean(is_new) : Boolean(isNew),
        rating: Number(rating) || 0,
        review_count: Number(review_count !== undefined ? review_count : reviewCount) || 0,
        loyalty_points_value: Number(loyalty_points_value) || 0,
        stock: stock !== undefined ? Number(stock) : 0,
        is_active: is_active !== undefined ? Boolean(is_active) : true,
        delivery_charge: delivery_charge !== undefined && delivery_charge !== '' ? Number(delivery_charge) : null,
        is_free_delivery: Boolean(is_free_delivery),
        delivery_time_text: delivery_time_text ? String(delivery_time_text).trim() : null,
        coupon_code: coupon_code ? String(coupon_code).trim().toUpperCase() : null,
        min_order_amount: min_order_amount !== undefined && min_order_amount !== '' ? Number(min_order_amount) : null,
        max_discount: max_discount !== undefined && max_discount !== '' ? Number(max_discount) : null,
        variants: variants || []
      });

      // Audit Log
      await auditLogger.log({
        action: 'CREATE_PRODUCT',
        table_affected: 'products',
        record_id: newProduct?.id || null
      });

      return res.status(201).json({
        success: true,
        message: 'Product created successfully',
        product: newProduct
      });
    } catch (error) {
      console.error('Error in createProduct:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create product',
        error: error.message
      });
    }
  },

  // PUT /api/products/:id
  updateProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const updatedProduct = await productModel.update(id, updates);

      if (!updatedProduct) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Audit Log
      await auditLogger.log({
        action: 'UPDATE_PRODUCT',
        table_affected: 'products',
        record_id: id
      });

      return res.status(200).json({
        success: true,
        message: 'Product updated successfully',
        product: updatedProduct
      });
    } catch (error) {
      console.error('Error in updateProduct:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update product',
        error: error.message
      });
    }
  },

  // PATCH /api/products/:id/stock
  updateStock: async (req, res) => {
    try {
      const { id } = req.params;
      const { stock } = req.body;

      if (stock === undefined || isNaN(Number(stock))) {
        return res.status(400).json({
          success: false,
          message: 'Valid stock number is required'
        });
      }

      const updated = await productModel.updateStock(id, Number(stock));

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Audit Log
      await auditLogger.log({
        action: `UPDATE_STOCK_${stock}`,
        table_affected: 'products',
        record_id: id
      });

      return res.status(200).json({
        success: true,
        message: 'Stock updated successfully',
        product: updated
      });
    } catch (error) {
      console.error('Error in updateStock:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update stock',
        error: error.message
      });
    }
  },

  // PATCH /api/products/:id/toggle
  toggleProductStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await productModel.findById(id);

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      const newStatus = !existing.is_active;
      const updated = await productModel.update(id, { is_active: newStatus });

      // Audit Log
      await auditLogger.log({
        action: newStatus ? 'PUBLISH_PRODUCT' : 'UNPUBLISH_PRODUCT',
        table_affected: 'products',
        record_id: id
      });

      return res.status(200).json({
        success: true,
        message: `Product is now ${newStatus ? 'active' : 'hidden'}`,
        is_active: newStatus,
        product: updated
      });
    } catch (error) {
      console.error('Error in toggleProductStatus:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to toggle product status',
        error: error.message
      });
    }
  },

  // DELETE /api/products/:id
  deleteProduct: async (req, res) => {
    try {
      const { id } = req.params;
      await productModel.delete(id);

      // Audit Log
      await auditLogger.log({
        action: 'DELETE_PRODUCT',
        table_affected: 'products',
        record_id: id
      });

      return res.status(200).json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteProduct:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete product',
        error: error.message
      });
    }
  },

  // Delete one or many products (SuperAdmin multi-select). Body: { ids: string[] }
  bulkDeleteProducts: async (req, res) => {
    try {
      const deletedIds = await productModel.deleteMany(req.body.ids);

      // Audit Log: one DELETE_PRODUCT row per product, same as a single delete
      await auditLogger.logMany({
        action: 'DELETE_PRODUCT',
        table_affected: 'products',
        record_ids: deletedIds
      });

      return res.status(200).json({
        success: true,
        deleted: deletedIds.length,
        ids: deletedIds,
        message: `${deletedIds.length} product(s) deleted successfully`
      });
    } catch (error) {
      console.error('Error in bulkDeleteProducts:', error);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to delete products',
        error: error.message
      });
    }
  }
};
