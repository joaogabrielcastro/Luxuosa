import { z } from "zod";
import { billingService } from "./billing.service.js";
import { env } from "../../config/env.js";
import { getStripe } from "../../shared/stripeClient.js";

export const billingController = {
  async status(req, res, next) {
    try {
      const data = await billingService.getStatus(req.tenantId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async checkout(req, res, next) {
    try {
      const body = z
        .object({
          plan: z.enum(["PRO", "ENTERPRISE"])
        })
        .parse(req.body);
      const data = await billingService.createCheckoutSession(req.tenantId, body.plan);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async portal(req, res, next) {
    try {
      const data = await billingService.createPortalSession(req.tenantId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async sync(req, res, next) {
    try {
      const data = await billingService.syncFromStripe(req.tenantId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async webhook(req, res, next) {
    try {
      const signature = req.headers["stripe-signature"];
      if (!env.stripe.webhookSecret) {
        const err = new Error("STRIPE_WEBHOOK_SECRET nao configurado.");
        err.statusCode = 503;
        throw err;
      }
      if (!signature) {
        const err = new Error("Assinatura Stripe ausente.");
        err.statusCode = 400;
        throw err;
      }

      const stripe = getStripe();
      const event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        env.stripe.webhookSecret
      );
      await billingService.handleWebhookEvent(event);
      res.json({ received: true });
    } catch (error) {
      if (error?.type === "StripeSignatureVerificationError") {
        error.statusCode = 400;
        error.message = "Assinatura Stripe invalida.";
      }
      next(error);
    }
  }
};
