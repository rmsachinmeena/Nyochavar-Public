import { currentActor } from '../src/services/requestContext.js';
import { supabase } from '../config/supabase.js';

// Who did it, in this order: an explicit { role, id } (for example a rider logging in, before any token exists), an
// explicit admin_id (admin login), or whoever is behind the current request. Nobody known => 'system'.
// It is never a made-up admin: an action is only ever recorded under the person who really did it.
const resolveActor = ({ actor, admin_id } = {}) => {
  if (actor?.role) return { role: actor.role, id: actor.id ? String(actor.id) : null };
  if (admin_id) return { role: 'admin', id: String(admin_id) };
  return currentActor() || { role: 'system', id: null };
};

// admin_id has a foreign key to `admins`, so it is filled only for a real admin; everyone else is told apart by actor_role/actor_id
const actorColumns = async (actor) => {
  let admin_id = null;
  if (actor.role === 'admin' && actor.id) {
    const { data } = await supabase.from('admins').select('id').eq('id', actor.id).maybeSingle();
    if (data?.id) admin_id = data.id;
  }
  return { admin_id, actor_role: actor.role, actor_id: actor.id };
};

const insertAuditRows = async (rows) => {
  let { data, error } = await supabase.from('audit_logs').insert(rows).select();

  // Migration 016 not run yet: keep logging admin actions the old way (rider/system actions cannot be stored without it)
  if (error && /actor_(role|id)/.test(error.message)) {
    const legacy = rows.filter((row) => row.admin_id).map(({ actor_role, actor_id, ...rest }) => rest);
    if (legacy.length > 0) ({ data, error } = await supabase.from('audit_logs').insert(legacy).select());
  }
  return { data, error };
};

export const auditLogger = {
  /**
   * Log one action for many records with a single insert (used by bulk deletes)
   * @param {Object} param0
   * @param {string} param0.action - e.g. 'DELETE_PRODUCT'
   * @param {string} param0.table_affected - e.g. 'products'
   * @param {string[]} param0.record_ids - IDs of the affected records
   * @param {string} [param0.admin_id] - only when the admin is known from outside the request
   * @param {{role: string, id: string}} [param0.actor] - who did it, when it is not the current request's user
   */
  logMany: async ({ admin_id, actor, action, table_affected = null, record_ids = [] }) => {
    try {
      if (!action || record_ids.length === 0) return null;

      const who = await actorColumns(resolveActor({ actor, admin_id }));
      const rows = record_ids.map((record_id) => ({
        ...who,
        action: String(action),
        table_affected: table_affected ? String(table_affected) : null,
        record_id: String(record_id)
      }));

      const { error } = await insertAuditRows(rows);
      if (error) {
        console.warn('⚠️ Could not write to audit_logs (non-fatal):', error.message);
      } else {
        console.log(`📝 [AuditLog] ${action} on ${table_affected || 'system'} (${rows.length} records) by ${who.actor_role}${who.actor_id ? `:${who.actor_id}` : ''}`);
      }
      return rows.length;
    } catch (err) {
      console.warn('⚠️ Audit log error (ignored):', err.message);
      return null;
    }
  },

  log: async ({ admin_id, actor, action, table_affected = null, record_id = null }) => {
    try {
      if (!action) return null;

      const who = await actorColumns(resolveActor({ actor, admin_id }));
      const row = {
        ...who,
        action: String(action),
        table_affected: table_affected ? String(table_affected) : null,
        record_id: record_id ? String(record_id) : null
      };

      const { data, error } = await insertAuditRows([row]);
      if (error) {
        console.warn('⚠️ Could not write to audit_logs (non-fatal):', error.message);
      } else {
        console.log(`📝 [AuditLog] ${action} on ${table_affected || 'system'} (#${record_id || 'N/A'}) by ${who.actor_role}${who.actor_id ? `:${who.actor_id}` : ''}`);
      }
      return data?.[0] ?? null;
    } catch (err) {
      console.warn('⚠️ Audit log error (ignored):', err.message);
      return null;
    }
  }
};
