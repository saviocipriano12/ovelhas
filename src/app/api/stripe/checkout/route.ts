import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireChurchBillingAdmin } from "@/lib/stripe/auth";
import { stripe } from "@/lib/stripe/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isSubscriptionTier } from "@/lib/subscription-plans";

const TIER_PRICE_ENV: Record<string, string | undefined> = {
  pequena: process.env.STRIPE_PRICE_PEQUENA,
  media: process.env.STRIPE_PRICE_MEDIA,
  grande: process.env.STRIPE_PRICE_GRANDE,
};

export async function POST(request: Request) {
  const limited = rateLimit(request, "stripe-checkout", 10, 5 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um pouco e tente novamente." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const churchId = typeof body?.churchId === "string" ? body.churchId : "";
  const tier = body?.tier;

  if (!churchId || !isSubscriptionTier(tier)) {
    return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const auth = await requireChurchBillingAdmin(request, churchId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const priceId = TIER_PRICE_ENV[tier];
  if (!priceId) {
    return NextResponse.json({ error: `Price da Stripe para o plano ${tier} nao configurado no servidor.` }, { status: 500 });
  }

  const { data: church, error: churchError } = await supabaseAdmin
    .from("churches")
    .select("id, name")
    .eq("id", churchId)
    .maybeSingle();

  if (churchError || !church) {
    return NextResponse.json({ error: "Igreja nao encontrada." }, { status: 404 });
  }

  const { data: existing } = await supabaseAdmin
    .from("church_subscriptions")
    .select("stripe_customer_id")
    .eq("church_id", churchId)
    .maybeSingle();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: existing?.stripe_customer_id || undefined,
    client_reference_id: churchId,
    metadata: { churchId, tier },
    subscription_data: {
      trial_period_days: 14,
      metadata: { churchId, tier },
    },
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${appUrl}/assinatura?status=sucesso`,
    cancel_url: `${appUrl}/assinatura?status=cancelado`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Nao foi possivel criar a sessao de checkout." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
