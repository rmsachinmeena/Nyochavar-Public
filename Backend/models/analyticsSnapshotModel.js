import { supabase } from '../config/supabase.js';

export const analyticsSnapshotModel = {
  findAll: async (limit = 30) => {
    const { data, error } = await supabase
      .from('analytics_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching analytics snapshots:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findByDate: async (snapshotDate) => {
    const { data, error } = await supabase
      .from('analytics_snapshots')
      .select('*')
      .eq('snapshot_date', snapshotDate)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(`Error finding analytics snapshot for ${snapshotDate}:`, error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  findByDateRange: async (startDate, endDate) => {
    const { data, error } = await supabase
      .from('analytics_snapshots')
      .select('*')
      .gte('snapshot_date', startDate)
      .lte('snapshot_date', endDate)
      .order('snapshot_date', { ascending: true });

    if (error) {
      console.error('Error fetching analytics snapshots in date range:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  create: async (snapshotData) => {
    const payload = {
      snapshot_date: snapshotData.snapshot_date,
      total_orders: snapshotData.total_orders || 0,
      total_revenue: snapshotData.total_revenue || 0,
      new_users: snapshotData.new_users || 0
    };

    const { data, error } = await supabase
      .from('analytics_snapshots')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating analytics snapshot:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  upsert: async (snapshotData) => {
    const payload = {
      snapshot_date: snapshotData.snapshot_date,
      total_orders: snapshotData.total_orders || 0,
      total_revenue: snapshotData.total_revenue || 0,
      new_users: snapshotData.new_users || 0
    };

    const { data, error } = await supabase
      .from('analytics_snapshots')
      .upsert([payload], { onConflict: 'snapshot_date' })
      .select()
      .single();

    if (error) {
      console.error('Error upserting analytics snapshot:', error.message);
      throw new Error(error.message);
    }
    return data;
  }
};
