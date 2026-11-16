import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { deliveryPartnerModel } from '../models/deliveryPartnerModel.js';
import { requireAdmin } from '../src/middlewares/authenticate.js';
import { createRouter } from '../src/middlewares/rateLimiter.js';
import { bulkIdsSchema, validateBody } from '../src/middlewares/validate.js';
import { revokeAllSessionsForUser } from '../src/services/tokenService.js';
import { auditLogger } from '../services/auditLogger.js';

const router = createRouter();

// GET /api/delivery-partners - List active partners for assignment
router.get('/', requireAdmin, async (req, res) => {
  try {
    const partners = await deliveryPartnerModel.findAll();
    res.status(200).json({ success: true, partners });
  } catch (error) {
    console.error('Error fetching delivery partners:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch delivery partners' });
  }
});

// POST /api/delivery-partners - Create new delivery partner
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, phone, city, assigned_area, is_active, duty_status } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone number are required' });
    }
    const created = await deliveryPartnerModel.create({ name, phone, city, assigned_area, is_active, duty_status });
    const { pin_hash, ...partner } = created;
    res.status(201).json({ success: true, partner });
  } catch (error) {
    console.error('Error creating delivery partner:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create delivery partner' });
  }
});

// PUT /api/delivery-partners/:id - Update delivery partner details
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, city, assigned_area, is_active, duty_status } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (city !== undefined) updates.city = city;
    if (assigned_area !== undefined) updates.assigned_area = assigned_area;
    if (is_active !== undefined) updates.is_active = is_active;
    if (duty_status !== undefined) updates.duty_status = duty_status;

    const updated = await deliveryPartnerModel.update(id, updates);
    // A disabled account must not keep using a session it already has
    if (is_active === false) await revokeAllSessionsForUser('rider', id, 'deactivated');
    const { pin_hash, login_pin, ...partner } = updated;
    res.status(200).json({ success: true, partner });
  } catch (error) {
    console.error('Error updating delivery partner:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update delivery partner' });
  }
});

// POST /api/delivery-partners/:id/reset-pin - Issue a new login PIN (hash for login, plain PIN kept for the superadmin list)
router.post('/:id/reset-pin', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const partner = await deliveryPartnerModel.findById(id);
    if (!partner) return res.status(404).json({ success: false, message: 'Delivery partner not found' });

    const requested = req.body?.pin !== undefined ? String(req.body.pin).trim() : null;
    if (requested !== null && !/^\d{4}$/.test(requested)) {
      return res.status(400).json({ success: false, message: 'PIN must be exactly 4 digits' });
    }
    // Generate a cryptographically random 4-digit PIN (1000–9999, never 0-prefixed)
    const pin = requested ?? String(randomInt(1000, 10_000));

    await deliveryPartnerModel.setPin(id, await bcrypt.hash(pin, 10), pin);
    // A new PIN means any device holding the old one must sign in again
    await revokeAllSessionsForUser('rider', id);

    res.status(200).json({ success: true, pin, message: 'Share this PIN with the rider.' });
  } catch (error) {
    console.error('Error resetting rider PIN:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to reset PIN' });
  }
});

// DELETE /api/delivery-partners/:id - Delete delivery partner
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await deliveryPartnerModel.delete(id);
    await revokeAllSessionsForUser('rider', id, 'deactivated');
    res.status(200).json({ success: true, message: 'Delivery partner deleted successfully' });
  } catch (error) {
    console.error('Error deleting delivery partner:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete delivery partner' });
  }
});

// POST /api/delivery-partners/bulk-delete - Delete one or many delivery partners. Body: { ids: string[] }
router.post('/bulk-delete', requireAdmin, validateBody(bulkIdsSchema), async (req, res) => {
  try {
    const deletedIds = await deliveryPartnerModel.deleteMany(req.body.ids);
    // Sign the removed riders out of the rider app right away
    await Promise.all(deletedIds.map((id) => revokeAllSessionsForUser('rider', id, 'deactivated')));
    await auditLogger.logMany({ action: 'DELETE_DELIVERY_PARTNER', table_affected: 'delivery_partners', record_ids: deletedIds });
    res.status(200).json({
      success: true,
      deleted: deletedIds.length,
      ids: deletedIds,
      message: `${deletedIds.length} delivery partner(s) deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting delivery partners:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to delete delivery partners' });
  }
});

export default router;
