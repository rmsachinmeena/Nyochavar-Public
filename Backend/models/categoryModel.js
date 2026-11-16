import { supabase } from '../config/supabase.js';

export const categoryModel = {
  findAll: async (filters = {}) => {
    let query = supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (typeof filters.is_active === 'boolean') {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters.occasion_type) {
      query = query.eq('occasion_type', filters.occasion_type);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching categories:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding category:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  findBySlug: async (slug) => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(`Error finding category with slug ${slug}:`, error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  create: async (categoryData) => {
    const payload = {
      name: categoryData.name,
      slug: categoryData.slug || categoryData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      image_url: categoryData.image_url || null,
      occasion_type: categoryData.occasion_type || null,
      is_active: categoryData.is_active !== undefined ? categoryData.is_active : true
    };

    const { data, error } = await supabase
      .from('categories')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating category:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting category:', error.message);
      throw new Error(error.message);
    }
    return true;
  },

  // Delete many categories in one statement: all of them or (on error) none. Returns the deleted ids.
  deleteMany: async (ids) => {
    const { data, error } = await supabase
      .from('categories')
      .delete()
      .in('id', ids)
      .select('id');

    if (error) {
      console.error('Error deleting categories:', error.message);
      // 23503 = foreign key violation: products are still filed under a category
      if (error.code === '23503') {
        throw Object.assign(
          new Error('Some of these categories still have products, so nothing was deleted. Move or delete those products first.'),
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }
    return (data || []).map((row) => row.id);
  }
};
