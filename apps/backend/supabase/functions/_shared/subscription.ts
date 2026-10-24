import { DbSchema, Profile } from '@first2apply/core';
import { SupabaseClient } from '@supabase/supabasefork';

/**
 * Retrieve the user profile and check if his subscription allows advanced matching.
 */
export async function checkUserSubscription({
  supabaseAdminClient,
  userId,
}: {
  supabaseAdminClient: SupabaseClient<DbSchema, 'public'>;
  userId: string;
}): Promise<{
  profile: Profile;
  subscriptionHasExpired: boolean;
  hasAdvancedMatching: boolean;
  hasCustomJobsParsing: boolean;
}> {
  const { data: profile, error } = await supabaseAdminClient
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    throw error;
  }

  if (!profile) {
    throw new Error('Profile not found');
  }

  // paywall removed: every user gets all features
  return {
    profile,
    subscriptionHasExpired: false,
    hasAdvancedMatching: true,
    hasCustomJobsParsing: true,
  };
}
