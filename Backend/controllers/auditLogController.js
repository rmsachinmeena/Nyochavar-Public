import { clampInt } from '../src/utils/input.js';
import { auditLogModel } from '../models/auditLogModel.js';
import { supabase } from '../config/supabase.js';

export const auditLogController = {
  // Get all audit logs with optional filter
  getAllLogs: async (req, res) => {
    try {
      const { action, table_affected, admin_id, limit = 100 } = req.query;

      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(clampInt(limit, 1, 500, 100));

      if (action) {
        query = query.ilike('action', `%${action}%`);
      }
      if (table_affected) {
        query = query.eq('table_affected', table_affected);
      }
      if (admin_id) {
        query = query.eq('admin_id', admin_id);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      // Names for the people behind the actions, so the log is readable
      const [{ data: admins }, { data: riders }] = await Promise.all([
        supabase.from('admins').select('id, name, email'),
        supabase.from('delivery_partners').select('id, name, phone')
      ]);
      const adminMap = {};
      (admins || []).forEach((a) => { adminMap[a.id] = a; });
      const riderMap = {};
      (riders || []).forEach((r) => { riderMap[r.id] = r; });

      const enrichedLogs = (data || []).map((log) => {
        // Rows written before migration 016 have no actor_role: they were all recorded under an admin
        const role = log.actor_role || (log.admin_id ? 'admin' : 'system');
        const actorId = log.actor_id || log.admin_id;
        if (role === 'rider') {
          const rider = riderMap[actorId];
          return { ...log, actor_role: role, admin_name: rider?.name || 'Rider', admin_email: rider?.phone || '' };
        }
        if (role === 'buyer') return { ...log, actor_role: role, admin_name: 'Customer', admin_email: '' };
        if (role === 'system') return { ...log, actor_role: role, admin_name: 'System', admin_email: '' };
        return { ...log, actor_role: role, admin_name: adminMap[actorId]?.name || 'Admin', admin_email: adminMap[actorId]?.email || '' };
      });

      res.status(200).json({
        success: true,
        logs: enrichedLogs,
        count: enrichedLogs.length
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch audit logs' });
    }
  },

  // Get logs by Admin ID
  getLogsByAdminId: async (req, res) => {
    try {
      const { adminId } = req.params;
      const logs = await auditLogModel.findByAdminId(adminId);
      res.status(200).json({ success: true, logs });
    } catch (error) {
      console.error('Error fetching admin logs:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch admin logs' });
    }
  }
};

export default auditLogController;
