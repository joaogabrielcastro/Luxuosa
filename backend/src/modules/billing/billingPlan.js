import { STRIPE_PLAN_LOOKUP_KEYS, normalizeStripePlan } from "../../shared/planCatalog.js";

export function subscriptionPeriodEnd(subscription) {
  if (!subscription?.current_period_end) return null;
  return new Date(subscription.current_period_end * 1000);
}

export function planFromSubscription(subscription) {
  const metaPlan = normalizeStripePlan(subscription?.metadata?.plan);
  if (metaPlan && metaPlan !== "BASIC") return metaPlan;

  const lookup =
    subscription?.items?.data?.[0]?.price?.lookup_key ||
    subscription?.items?.data?.[0]?.price?.metadata?.plan;
  const fromLookup = normalizeStripePlan(lookup?.replace(/^luxuosa_/i, "").replace(/_monthly$/i, ""));
  if (fromLookup && fromLookup !== "BASIC") return fromLookup;

  for (const [plan, key] of Object.entries(STRIPE_PLAN_LOOKUP_KEYS)) {
    if (lookup === key) return plan;
  }
  return "PRO";
}
