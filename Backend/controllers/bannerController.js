import { pick } from '../src/utils/input.js';
import { bannerModel } from '../models/index.js';
import { auditLogger } from '../services/auditLogger.js';;

export const bannerController = {
  // Get all banners or active only
  getBanners: async (req, res) => {
    
    try {
      const activeOnly = req.query.active === 'true';
      const banners = activeOnly
        ? await bannerModel.findActive()
        : await bannerModel.findAll();

      // The storefront list is the same for everyone, so browsers/CDNs may reuse it for a minute (and serve a stale copy
      // while refreshing). The admin list (all banners) is never cached so edits show up immediately.
      if (activeOnly) res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.status(200).json({ success: true, banners });
    } catch (error) {
      console.error('Error fetching banners:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch banners' });
    }
  },

  // Get banner by ID
  getBannerById: async (req, res) => {
    try {
      const { id } = req.params;
      const banner = await bannerModel.findById(id);
      if (!banner) {
        return res.status(404).json({ error: 'Banner not found' });
      }
      res.status(200).json({ success: true, banner });
    } catch (error) {
      console.error('Error fetching banner:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch banner' });
    }
  },

  // Create new banner
  createBanner: async (req, res) => {
    try {
      const { title, image_url, mobile_image_url, subtitle, cta_text, badge, occasion, show_overlay, link_url, is_active, display_order } = req.body;
      if (!image_url) {
        return res.status(400).json({ error: 'Image URL is required' });
      }

      const banner = await bannerModel.create({
        title: title || 'Customized Gifts',
        image_url,
        mobile_image_url,
        subtitle,
        cta_text,
        badge,
        occasion,
        show_overlay,
        link_url: link_url || '/catalog',
        is_active: is_active !== undefined ? is_active : true,
        display_order: display_order || 0
      });

      // Audit Log
      await auditLogger.log({
        action: 'CREATE_BANNER',
        table_affected: 'banners',
        record_id: banner?.id || null
      });

      res.status(201).json({ success: true, message: 'Banner created successfully', banner });
    } catch (error) {
      console.error('Error creating banner:', error);
      res.status(500).json({ error: error.message || 'Failed to create banner' });
    }
  },

  // Update existing banner
  updateBanner: async (req, res) => {
    try {
      const { id } = req.params;
      const banner = await bannerModel.update(id, pick(req.body, [
        'title', 'image_url', 'mobile_image_url', 'subtitle', 'cta_text', 'badge', 'occasion', 'show_overlay',
        'link_url', 'target_url', 'is_active', 'display_order'
      ]));

      // Audit Log
      await auditLogger.log({
        action: 'UPDATE_BANNER',
        table_affected: 'banners',
        record_id: id
      });

      res.status(200).json({ success: true, message: 'Banner updated successfully', banner });
    } catch (error) {
      console.error('Error updating banner:', error);
      res.status(500).json({ error: error.message || 'Failed to update banner' });
    }
  },

  // Toggle active status
  toggleBannerStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await bannerModel.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Banner not found' });
      }

      const newStatus = !existing.is_active;
      const banner = await bannerModel.update(id, { is_active: newStatus });

      // Audit Log
      await auditLogger.log({
        action: newStatus ? 'ENABLE_BANNER' : 'DISABLE_BANNER',
        table_affected: 'banners',
        record_id: id
      });

      res.status(200).json({ success: true, message: 'Banner status toggled', banner });
    } catch (error) {
      console.error('Error toggling banner status:', error);
      res.status(500).json({ error: error.message || 'Failed to toggle banner status' });
    }
  },

  // Delete banner
  deleteBanner: async (req, res) => {
    try {
      const { id } = req.params;
      await bannerModel.delete(id);

      // Audit Log
      await auditLogger.log({
        action: 'DELETE_BANNER',
        table_affected: 'banners',
        record_id: id
      });

      res.status(200).json({ success: true, message: 'Banner deleted successfully' });
    } catch (error) {
      console.error('Error deleting banner:', error);
      res.status(500).json({ error: error.message || 'Failed to delete banner' });
    }
  },

  // Delete one or many banners (SuperAdmin multi-select). Body: { ids: string[] }
  bulkDeleteBanners: async (req, res) => {
    try {
      const deletedIds = await bannerModel.deleteMany(req.body.ids);

      // Audit Log: one DELETE_BANNER row per banner, same as a single delete
      await auditLogger.logMany({
        action: 'DELETE_BANNER',
        table_affected: 'banners',
        record_ids: deletedIds
      });

      res.status(200).json({
        success: true,
        deleted: deletedIds.length,
        ids: deletedIds,
        message: `${deletedIds.length} banner(s) deleted successfully`
      });
    } catch (error) {
      console.error('Error bulk deleting banners:', error);
      res.status(error.status || 500).json({ error: error.message || 'Failed to delete banners' });
    }
  }
};

export default bannerController;
