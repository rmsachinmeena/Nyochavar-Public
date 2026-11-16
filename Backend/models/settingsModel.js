import { supabase } from '../config/supabase.js';

export const settingsModel = {
  findAll: async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .order('key_name', { ascending: true });

    if (error) {
      console.error('Error fetching settings:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findByKey: async (keyName) => {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('key_name', keyName)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(`Error finding setting ${keyName}:`, error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  get: async (keyName, defaultValue = null) => {
    const setting = await settingsModel.findByKey(keyName);
    return setting ? setting.value : defaultValue;
  },

  set: async (keyName, value, description = null) => {
    const payload = {
      key_name: keyName,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      updated_at: new Date().toISOString()
    };
    if (description !== null) {
      payload.description = description;
    }

    const { data, error } = await supabase
      .from('settings')
      .upsert([payload], { onConflict: 'key_name' })
      .select()
      .single();

    if (error) {
      console.error(`Error saving setting ${keyName}:`, error.message);
      throw new Error(error.message);
    }
    return data;
  },

  updateByKey: async (keyName, updates) => {
    const payload = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    if (payload.key && !payload.key_name) {
      payload.key_name = payload.key;
      delete payload.key;
    }

    const { data, error } = await supabase
      .from('settings')
      .update(payload)
      .eq('key_name', keyName)
      .select()
      .single();

    if (error) {
      console.error(`Error updating setting ${keyName}:`, error.message);
      throw new Error(error.message);
    }
    return data;
  },

  deleteByKey: async (keyName) => {
    const { data, error } = await supabase
      .from('settings')
      .delete()
      .eq('key_name', keyName);

    if (error) {
      console.error(`Error deleting setting ${keyName}:`, error.message);
      throw new Error(error.message);
    }
    return true;
  }
};
