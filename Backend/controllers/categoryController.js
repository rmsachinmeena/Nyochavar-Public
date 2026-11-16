import { pick } from '../src/utils/input.js';
import { categoryModel } from '../models/categoryModel.js';
import { auditLogger } from '../services/auditLogger.js';

export const categoryController = {
  // GET /api/categories
  getAllCategories: async (req, res) => {
    try {
      const filters = {};
      if (req.query.active_only === 'true') {
        filters.is_active = true;
      }
      if (req.query.occasion_type) {
        filters.occasion_type = req.query.occasion_type;
      }

      const categories = await categoryModel.findAll(filters);
      return res.status(200).json({
        success: true,
        count: categories.length,
        categories
      });
    } catch (error) {
      console.error('Error in getAllCategories:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch categories',
        error: error.message
      });
    }
  },

  // GET /api/categories/:id
  getCategoryById: async (req, res) => {
    try {
      const { id } = req.params;
      const category = await categoryModel.findById(id);

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      return res.status(200).json({
        success: true,
        category
      });
    } catch (error) {
      console.error('Error in getCategoryById:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch category',
        error: error.message
      });
    }
  },

  // POST /api/categories
  createCategory: async (req, res) => {
    try {
      const { name, slug, image_url, occasion_type, is_active } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Category name is required'
        });
      }

      const newCategory = await categoryModel.create({
        name: name.trim(),
        slug,
        image_url,
        occasion_type,
        is_active: is_active !== undefined ? is_active : true
      });

      // Audit Log
      await auditLogger.log({
        action: 'CREATE_CATEGORY',
        table_affected: 'categories',
        record_id: newCategory?.id || null
      });

      return res.status(201).json({
        success: true,
        message: 'Category created successfully',
        category: newCategory
      });
    } catch (error) {
      console.error('Error in createCategory:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create category',
        error: error.message
      });
    }
  },

  // PUT /api/categories/:id
  updateCategory: async (req, res) => {
    try {
      const { id } = req.params;
      const updates = pick(req.body, ['name', 'slug', 'image_url', 'occasion_type', 'is_active']);

      const updatedCategory = await categoryModel.update(id, updates);

      // Audit Log
      await auditLogger.log({
        action: 'UPDATE_CATEGORY',
        table_affected: 'categories',
        record_id: id
      });

      return res.status(200).json({
        success: true,
        message: 'Category updated successfully',
        category: updatedCategory
      });
    } catch (error) {
      console.error('Error in updateCategory:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update category',
        error: error.message
      });
    }
  },

  // DELETE /api/categories/:id
  deleteCategory: async (req, res) => {
    try {
      const { id } = req.params;
      await categoryModel.delete(id);

      // Audit Log
      await auditLogger.log({
        action: 'DELETE_CATEGORY',
        table_affected: 'categories',
        record_id: id
      });

      return res.status(200).json({
        success: true,
        message: 'Category deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteCategory:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete category',
        error: error.message
      });
    }
  },

  // Delete one or many categories (SuperAdmin multi-select). Body: { ids: string[] }
  bulkDeleteCategories: async (req, res) => {
    try {
      const deletedIds = await categoryModel.deleteMany(req.body.ids);

      // Audit Log: one DELETE_CATEGORY row per category, same as a single delete
      await auditLogger.logMany({
        action: 'DELETE_CATEGORY',
        table_affected: 'categories',
        record_ids: deletedIds
      });

      return res.status(200).json({
        success: true,
        deleted: deletedIds.length,
        ids: deletedIds,
        message: `${deletedIds.length} categor${deletedIds.length === 1 ? 'y' : 'ies'} deleted successfully`
      });
    } catch (error) {
      console.error('Error in bulkDeleteCategories:', error);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to delete categories',
        error: error.message
      });
    }
  }
};
