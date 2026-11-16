import { supabase } from '../config/supabase.js';

// A sign-up waits in `pending_signups` until its email OTP is proven correct. Only then is a row created in `users`.
// Rows that stay unused are removed: an expired code can still be re-sent for a while, so rows are kept for a grace period.
const GRACE_PERIOD_MS = 60 * 60 * 1000;

export const pendingSignupModel = {
  findByEmail: async (email) => {
    const { data, error } = await supabase.from('pending_signups').select('*').eq('email', email).maybeSingle();
    if (error) {
      console.error('Error finding pending sign-up:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  // One waiting sign-up per email: a new request replaces the earlier one
  save: async ({ email, name, otp_code, otp_expiry }) => {
    const { error } = await supabase.from('pending_signups').upsert(
      { email, name: name || null, otp_code, otp_expiry, last_sent_at: new Date().toISOString() },
      { onConflict: 'email' }
    );
    if (error) {
      console.error('Error saving pending sign-up:', error.message);
      throw new Error(error.message);
    }
  },

  // A fresh code for a sign-up that is still waiting
  updateOtp: async (email, otp_code, otp_expiry) => {
    const { error } = await supabase
      .from('pending_signups')
      .update({ otp_code, otp_expiry, last_sent_at: new Date().toISOString() })
      .eq('email', email);
    if (error) {
      console.error('Error refreshing pending sign-up code:', error.message);
      throw new Error(error.message);
    }
  },

  remove: async (email) => {
    const { error } = await supabase.from('pending_signups').delete().eq('email', email);
    if (error) console.warn('Could not remove pending sign-up:', error.message);
  },

  // Sign-ups whose code ran out more than an hour ago are never coming back
  removeStale: async () => {
    const cutoff = new Date(Date.now() - GRACE_PERIOD_MS).toISOString();
    const { error } = await supabase.from('pending_signups').delete().lt('otp_expiry', cutoff);
    if (error) console.warn('Could not clean old pending sign-ups:', error.message);
  }
};
