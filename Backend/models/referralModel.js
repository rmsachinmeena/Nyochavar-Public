import { supabase } from '../config/supabase.js';

export const referralModel = {
  findAll: async (filters = {}) => {
    let query = supabase
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.referrer_id) {
      query = query.eq('referrer_id', filters.referrer_id);
    }
    if (filters.reward_status) {
      query = query.eq('reward_status', filters.reward_status);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching referrals:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding referral:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  findByCode: async (referralCode) => {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referral_code', referralCode.trim().toUpperCase())
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(`Error finding referral with code ${referralCode}:`, error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  findByReferrerId: async (referrerId) => {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', referrerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error finding referrals for referrer ${referrerId}:`, error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  create: async (referralData) => {
    const payload = {
      referrer_id: referralData.referrer_id,
      referred_user_id: referralData.referred_user_id || null,
      referral_code: referralData.referral_code.trim().toUpperCase(),
      reward_status: referralData.reward_status || 'pending'
    };

    const { data, error } = await supabase
      .from('referrals')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating referral:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  updateRewardStatus: async (id, rewardStatus) => {
    const valid = ['pending', 'rewarded', 'expired'];
    if (!valid.includes(rewardStatus)) {
      throw new Error(`Invalid reward status: ${rewardStatus}. Must be one of ${valid.join(', ')}`);
    }

    const { data, error } = await supabase
      .from('referrals')
      .update({ reward_status: rewardStatus })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating referral reward status:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('referrals')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting referral:', error.message);
      throw new Error(error.message);
    }
    return true;
  }
};
