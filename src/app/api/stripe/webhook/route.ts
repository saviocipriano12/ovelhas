import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isSubscriptionTier, type SubscriptionTier } from "@/lib/subscription-plans";

async function upsertSubscriptionFromStripe(input: {
  churchId: string;
  tier?: SubscriptionTier;
  customerId: string;
  subscriptionId: string;
  subscription?: Stripe.Subscription;
}) {
  const subscription = input.subscription ?? (await stripe.subscriptions.retrieve(input.subscriptionId));
  const periodEndSeconds = subscription.items.data[0]?.current_period_end ?? null;
  const metadataTier = subscription.metadata?.tier;

  await supabaseAdmin.from("church_subscriptions").upsert(
    {
      church_id: input.churchId,
      stripe_customer_id: input.customerId,
      stripe_subscription_id: input.subscriptionId,
      tier: input.tier ?? (isSubscriptionTier(metadataTier) ? metadataTier : null),
      status: subscription.status,
      trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      current_period_end: periodEndSeconds ? new Date(periodEndSeconds * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "church_id" },
  );
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook nao configurado." }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("[stripe/webhook] assinatura invalida:", error);
    return NextResponse.json({ error: "Assinatura invalida." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const churchId = session.client_reference_id || session.metadata?.churchId;
        const tier = session.metadata?.tier;

        if (churchId && session.customer && session.subscription) {
          await upsertSubscriptionFromStripe({
            churchId,
            tier: isSubscriptionTier(tier) ? tier : undefined,
            customerId: String(session.customer),
            subscriptionId: String(session.subscription),
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const churchId = subscription.metadata?.churchId;

        if (churchId) {
          await upsertSubscriptionFromStripe({
            churchId,
            customerId: String(subscription.customer),
            subscriptionId: subscription.id,
            subscription,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const churchId = subscription.metadata?.churchId;

        if (churchId) {
          await supabaseAdmin
            .from("church_subscriptions")
            .update({ status: "canceled", updated_at: new Date().toISOString() })
            .eq("church_id", churchId);
        }
        break;
      }

      case "invoice.payment_failed":
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionRef = invoice.parent?.subscription_details?.subscription;
        const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const churchId = subscription.metadata?.churchId;

          if (churchId) {
            await upsertSubscriptionFromStripe({
              churchId,
              customerId: String(subscription.customer),
              subscriptionId: subscription.id,
              subscription,
            });
          }
        }
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error("[stripe/webhook] falha ao processar evento:", event.type, error);
    return NextResponse.json({ error: "Falha ao processar evento." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
