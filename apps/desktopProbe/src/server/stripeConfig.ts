import { StripeConfig } from '@first2apply/core';

/**
 * Stripe payment links.
 *
 * Foundation has no paid plans set up yet, so every link is empty. While the customer portal
 * link is empty the app treats subscriptions as never expiring and the upgrade buttons explain
 * that upgrades aren't available. (The links inherited from First 2 Apply were removed because
 * they took payments into that company's Stripe account.)
 *
 * To turn payments on, create payment links in your own Stripe account and paste them here.
 */
const stripeConfig: StripeConfig = {
  customerPortalLink: '',
  plans: [
    {
      tier: 'basic',
      monthlyCheckoutLink: '',
      quarterlyCheckoutLink: '',
      biannuallyCheckoutLink: '',
      yearlyCheckoutLink: '',
    },
    {
      tier: 'pro',
      monthlyCheckoutLink: '',
      quarterlyCheckoutLink: '',
      biannuallyCheckoutLink: '',
      yearlyCheckoutLink: '',
    },
  ],
};

export function getStripeConfig(_nodeEnv: string) {
  return stripeConfig;
}
