// Ovelhas - cria o Produto e os 3 Prices de assinatura na Stripe.
// Rode uma vez por modo (test e depois live). Idempotente: se o produto
// "Ovelhas - Assinatura" ja existir, reaproveita em vez de duplicar.
//
// Uso:
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
//
// Ao final, copie os price IDs impressos para o .env.local
// (STRIPE_PRICE_PEQUENA / STRIPE_PRICE_MEDIA / STRIPE_PRICE_GRANDE).

import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  console.error("Defina STRIPE_SECRET_KEY antes de rodar este script.");
  console.error('Exemplo: STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs');
  process.exit(1);
}

const mode = secretKey.startsWith("sk_live_") ? "LIVE" : "TEST";
const stripe = new Stripe(secretKey);

const PRODUCT_NAME = "Ovelhas - Assinatura";

const PLANS = [
  { key: "pequena", nickname: "Pequena (ate 300 pessoas)", unitAmount: 5990 },
  { key: "media", nickname: "Media (ate 800 pessoas)", unitAmount: 8990 },
  { key: "grande", nickname: "Grande (acima de 800 pessoas)", unitAmount: 12990 },
];

async function findOrCreateProduct() {
  const existing = await stripe.products.search({
    query: `name:"${PRODUCT_NAME}" AND active:"true"`,
  });

  if (existing.data.length > 0) {
    console.log(`Produto existente reaproveitado: ${existing.data[0].id}`);
    return existing.data[0];
  }

  const product = await stripe.products.create({
    name: PRODUCT_NAME,
    description: "Assinatura mensal do Ovelhas, plataforma de cuidado pastoral.",
  });

  console.log(`Produto criado: ${product.id}`);
  return product;
}

async function findOrCreatePrice(productId, plan) {
  const existingPrices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const found = existingPrices.data.find(
    (price) =>
      price.nickname === plan.nickname &&
      price.unit_amount === plan.unitAmount &&
      price.recurring?.interval === "month",
  );

  if (found) {
    console.log(`Price existente reaproveitado (${plan.key}): ${found.id}`);
    return found;
  }

  const price = await stripe.prices.create({
    product: productId,
    currency: "brl",
    unit_amount: plan.unitAmount,
    recurring: { interval: "month" },
    nickname: plan.nickname,
    metadata: { tier: plan.key },
  });

  console.log(`Price criado (${plan.key}): ${price.id}`);
  return price;
}

async function main() {
  console.log(`Modo detectado pela chave: ${mode}`);
  console.log("Criando/reaproveitando produto e precos na Stripe...\n");

  const product = await findOrCreateProduct();
  const priceIds = {};

  for (const plan of PLANS) {
    const price = await findOrCreatePrice(product.id, plan);
    priceIds[plan.key] = price.id;
  }

  console.log("\nCole estas linhas no .env.local (substitua os valores atuais):\n");
  console.log(`STRIPE_PRICE_PEQUENA=${priceIds.pequena}`);
  console.log(`STRIPE_PRICE_MEDIA=${priceIds.media}`);
  console.log(`STRIPE_PRICE_GRANDE=${priceIds.grande}`);
}

main().catch((error) => {
  console.error("Falha ao configurar a Stripe:", error.message);
  process.exit(1);
});
