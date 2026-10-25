import { DbSchema, Profile } from '@first2apply/core';
import { SupabaseClient } from '@supabase/supabasefork';

/**
 * Retrieve the user profile and check if his subscription allows AI filters.
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
  hasAiFilters: boolean;
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

  // check if the user's subscription has expired
  const subscriptionHasExpired = new Date(profile.subscription_end_date) < new Date();
  const hasProTier = profile.subscription_tier === 'pro';

  return {
    profile,
    subscriptionHasExpired,
    // Foundation gives AI AI filters to every user, whatever their plan
    hasAiFilters: true,
    hasCustomJobsParsing: hasProTier && !subscriptionHasExpired,
  };
}
