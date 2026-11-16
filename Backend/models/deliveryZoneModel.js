import { supabase } from '../config/supabase.js';

export const deliveryZoneModel = {
  findAll: async (filters = {}) => {
    let query = supabase
      .from('delivery_zones')
      .select('*, cities:city_id(id, city_name, state)')
      .order('zone_name', { ascending: true });

    if (filters.city_id) {
      query = query.eq('city_id', filters.city_id);
    }
    if (filters.pincode) {
      query = query.eq('pincode', filters.pincode);
    }
    if (typeof filters.is_same_day_available === 'boolean') {
      query = query.eq('is_same_day_available', filters.is_same_day_available);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching delivery zones:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*, cities:city_id(id, city_name, state)')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding delivery zone:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  findByCityId: async (city_id) => {
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('city_id', city_id)
      .order('zone_name', { ascending: true });

    if (error) {
      console.error(`Error fetching zones for city ${city_id}:`, error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findByPincode: async (pincode) => {
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*, cities:city_id(id, city_name, state)')
      .eq('pincode', pincode)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(`Error finding zone for pincode ${pincode}:`, error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  create: async (zoneData) => {
    const payload = {
      city_id: zoneData.city_id || null,
      zone_name: zoneData.zone_name || zoneData.name,
      pincode: zoneData.pincode,
      radius_km: zoneData.radius_km !== undefined ? zoneData.radius_km : null,
      is_same_day_available: zoneData.is_same_day_available !== undefined ? zoneData.is_same_day_available : true
    };

    const { data, error } = await supabase
      .from('delivery_zones')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating delivery zone:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  update: async (id, updates) => {
    const payload = { ...updates };
    if (payload.name && !payload.zone_name) {
      payload.zone_name = payload.name;
      delete payload.name;
    }

    const { data, error } = await supabase
      .from('delivery_zones')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating delivery zone:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('delivery_zones')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting delivery zone:', error.message);
      throw new Error(error.message);
    }
    return true;
  }
};
