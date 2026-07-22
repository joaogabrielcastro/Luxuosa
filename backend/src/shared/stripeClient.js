import Stripe from "stripe";
import { env } from "../config/env.js";

let stripeClient = null;

export function isStripeConfigured() {
  return Boolean(env.stripe.secretKey);
}

export function getStripe() {
  if (!env.stripe.secretKey) {
    const err = new Error("Stripe nao configurado (STRIPE_SECRET_KEY).");
    err.statusCode = 503;
    err.code = "STRIPE_NOT_CONFIGURED";
    throw err;
  }
  if (!stripeClient) {
    stripeClient = new Stripe(env.stripe.secretKey);
  }
  return stripeClient;
}
