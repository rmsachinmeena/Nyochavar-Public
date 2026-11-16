import { supabase } from '../config/supabase.js';

// Default initial delivery partners for instant testing & deployment
let DEFAULT_PARTNERS = [
  
  
];

// pin_hash never leaves the model except through findAuthByPhone (rider login);
// login_pin is only exposed to the superadmin list (findAll)
const formatPartner = (p) => {
  if (!p) return null;
  const { pin_hash, login_pin, ...safe } = p;
  return {
    ...safe,
    duty_status: p.duty_status || (p.is_active !== false ? 'on_duty' : 'on_leave')
  };
};

export const deliveryPartnerModel = {
  // Ensure default partners exist in DB
  ensureDefaults: async () => {
    try {
      const { data: existing } = await supabase.from('delivery_partners').select('id');
      if (!existing || existing.length === 0) {
        await supabase.from('delivery_partners').insert(DEFAULT_PARTNERS);
      }
    } catch (e) {
      console.warn('Could not seed default delivery partners:', e.message);
    }
  },

  findAll: async (filters = {}) => {
    await deliveryPartnerModel.ensureDefaults();
    let query = supabase
      .from('delivery_partners')
      .select('*')
      .order('created_at', { ascending: false });

    if (typeof filters.is_active === 'boolean') {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters.city) {
      query = query.eq('city', filters.city);
    }
    if (filters.assigned_area) {
      query = query.eq('assigned_area', filters.assigned_area);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching delivery partners:', error.message);
      return DEFAULT_PARTNERS.map(formatPartner);
    }
    const list = (data && data.length > 0) ? data : DEFAULT_PARTNERS;
    return list.map((p) => ({ ...formatPartner(p), login_pin: p.login_pin || null }));
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('delivery_partners')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding delivery partner:', error.message);
    }
    if (data) return formatPartner(data);
    const fallback = DEFAULT_PARTNERS.find(p => p.id === id) || null;
    return formatPartner(fallback);
  },

  findByPhone: async (phone) => {
    const cleanPhone = String(phone).trim();
    const { data, error } = await supabase
      .from('delivery_partners')
      .select('*')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (data) return formatPartner(data);
    const fallback = DEFAULT_PARTNERS.find(p => p.phone === cleanPhone) || null;
    return formatPartner(fallback);
  },

  // Rider login only: same as findByPhone but keeps the PIN hash for verification
  findAuthByPhone: async (phone) => {
    const cleanPhone = String(phone).trim();
    const { data } = await supabase
      .from('delivery_partners')
      .select('*')
      .eq('phone', cleanPhone)
      .maybeSingle();
    if (!data) return null;
    return { ...formatPartner(data), pin_hash: data.pin_hash || null };
  },

  // Store the login PIN: bcrypt hash for rider login (migration 007) and the plain PIN
  // so the superadmin can always see it (migration 008)
  setPin: async (id, pin_hash, login_pin) => {
    const { error } = await supabase.from('delivery_partners').update({ pin_hash, login_pin }).eq('id', id);
    if (!error) return true;

    // login_pin column missing: keep rider login working, only the admin-side display is lost
    console.warn('Could not store visible PIN (run migration 008?):', error.message);
    const { error: hashError } = await supabase.from('delivery_partners').update({ pin_hash }).eq('id', id);
    if (hashError) throw new Error(`Could not save PIN (run migration 007?): ${hashError.message}`);
    return true;
  },

  findActive: async (city = null) => {
    await deliveryPartnerModel.ensureDefaults();
    let query = supabase
      .from('delivery_partners')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (city) {
      query = query.eq('city', city);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      return DEFAULT_PARTNERS.filter(p => p.is_active !== false).map(formatPartner);
    }
    return data.map(formatPartner);
  },

  create: async (partnerData) => {
    const is_active = partnerData.is_active !== undefined 
      ? partnerData.is_active 
      : (partnerData.duty_status !== 'on_leave');

    const dbPayload = {
      id: partnerData.id || `partner_${Date.now()}`,
      name: partnerData.name,
      phone: partnerData.phone,
      city: partnerData.city || 'Ajmer',
      assigned_area: partnerData.assigned_area || null,
      is_active,
      created_at: new Date().toISOString()
    };

    const fullPartner = {
      ...dbPayload,
      duty_status: partnerData.duty_status || (is_active ? 'on_duty' : 'on_leave')
    };

    try {
      const { data, error } = await supabase
        .from('delivery_partners')
        .insert([dbPayload])
        .select()
        .single();

      if (!error && data) {
        const saved = { ...data, duty_status: fullPartner.duty_status };
        DEFAULT_PARTNERS.unshift(saved);
        return saved;
      }
    } catch (e) {
      console.warn('Supabase insert warning, using fallback:', e.message);
    }

    DEFAULT_PARTNERS.unshift(fullPartner);
    return fullPartner;
  },

  update: async (id, updates) => {
    const dbPayload = {};
    if (updates.name !== undefined) dbPayload.name = updates.name;
    if (updates.phone !== undefined) dbPayload.phone = updates.phone;
    if (updates.city !== undefined) dbPayload.city = updates.city;
    if (updates.assigned_area !== undefined) dbPayload.assigned_area = updates.assigned_area;
    if (updates.is_active !== undefined) {
      dbPayload.is_active = updates.is_active;
    } else if (updates.duty_status !== undefined) {
      dbPayload.is_active = updates.duty_status !== 'on_leave';
    }

    try {
      const { data, error } = await supabase
        .from('delivery_partners')
        .update(dbPayload)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        const computedDuty = updates.duty_status || (data.is_active !== false ? 'on_duty' : 'on_leave');
        const updated = { ...data, duty_status: computedDuty };
        const idx = DEFAULT_PARTNERS.findIndex(p => p.id === id);
        if (idx !== -1) DEFAULT_PARTNERS[idx] = updated;
        return updated;
      }
    } catch (e) {
      console.warn('Supabase update warning, using fallback:', e.message);
    }

    const idx = DEFAULT_PARTNERS.findIndex(p => p.id === id);
    if (idx !== -1) {
      DEFAULT_PARTNERS[idx] = { ...DEFAULT_PARTNERS[idx], ...updates, ...dbPayload };
      return DEFAULT_PARTNERS[idx];
    }
    return { id, ...updates, ...dbPayload };
  },

  delete: async (id) => {
    try {
      await supabase
        .from('delivery_partners')
        .delete()
        .eq('id', id);
    } catch (e) {
      console.warn('Supabase delete warning, using fallback:', e.message);
    }

    DEFAULT_PARTNERS = DEFAULT_PARTNERS.filter(p => p.id !== id);
    return true;
  },

  // Delete many riders in one statement. Returns the deleted ids.
  deleteMany: async (ids) => {
    const { data, error } = await supabase
      .from('delivery_partners')
      .delete()
      .in('id', ids)
      .select('id');

    if (error) {
      console.error('Error deleting delivery partners:', error.message);
      throw new Error(error.message);
    }
    DEFAULT_PARTNERS = DEFAULT_PARTNERS.filter(p => !ids.includes(p.id));
    return (data || []).map((row) => row.id);
  }
};

export default deliveryPartnerModel;
