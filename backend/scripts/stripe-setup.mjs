/**
 * Cria/atualiza Products + Prices no Stripe (lookup_key) para PRO e ENTERPRISE.
 * Se o preco ativo tiver valor diferente do catalogo, cria um novo e transfere o lookup_key.
 * Uso: node scripts/stripe-setup.mjs
 */
import dotenv from "dotenv";
import Stripe from "stripe";
import { PLAN_CATALOG, STRIPE_PLAN_LOOKUP_KEYS } from "../src/shared/planCatalog.js";

dotenv.config();

const secret = process.env.STRIPE_SECRET_KEY?.trim();
if (!secret) {
  console.error("Defina STRIPE_SECRET_KEY no .env");
  process.exit(1);
}

const stripe = new Stripe(secret);

async function upsertPlan(planId) {
  const catalog = PLAN_CATALOG[planId];
  const lookupKey = STRIPE_PLAN_LOOKUP_KEYS[planId];
  if (!catalog || !lookupKey) return null;

  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const current = existing.data[0];

  if (current && current.unit_amount === catalog.amountCents) {
    console.log(`[ok] ${planId}: price existente ${current.id} (${lookupKey})`);
    return current;
  }

  let productId = current?.product;
  if (typeof productId === "object" && productId?.id) productId = productId.id;
  if (!productId) {
    const product = await stripe.products.create({
      name: `Luxuosa ${catalog.name}`,
      description: catalog.description,
      metadata: { plan: planId, app: "luxuosa" }
    });
    productId = product.id;
  }

  if (current) {
    await stripe.prices.update(current.id, {
      lookup_key: null,
      transfer_lookup_key: true,
      active: false
    });
    console.log(`[arquivado] ${planId}: ${current.id} (R$ ${((current.unit_amount || 0) / 100).toFixed(2)})`);
  }

  const price = await stripe.prices.create({
    product: productId,
    currency: "brl",
    unit_amount: catalog.amountCents,
    recurring: { interval: "month" },
    lookup_key: lookupKey,
    transfer_lookup_key: true,
    metadata: { plan: planId }
  });

  console.log(`[criado] ${planId}: ${price.id} · ${lookupKey} · R$ ${(catalog.amountCents / 100).toFixed(2)}/mes`);
  return price;
}

const pro = await upsertPlan("PRO");
const enterprise = await upsertPlan("ENTERPRISE");

console.log("\nAdicione ao .env (opcional se lookup_key funcionar):");
if (pro) console.log(`STRIPE_PRICE_PRO=${pro.id}`);
if (enterprise) console.log(`STRIPE_PRICE_ENTERPRISE=${enterprise.id}`);
console.log("\nWebhook (Stripe CLI): stripe listen --forward-to localhost:3001/api/v1/billing/webhook");
