import { NextResponse } from "next/server";
import { requireChurchBillingAdmin } from "@/lib/stripe/auth";
import { stripe } from "@/lib/stripe/client";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const churchId = typeof body?.churchId === "string" ? body.churchId : "";

  if (!churchId) {
    return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const auth = await requireChurchBillingAdmin(request, churchId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: subscription, error: subscriptionError } = await supabaseAdmin
    .from("church_subscriptions")
    .select("stripe_customer_id")
    .eq("church_id", churchId)
    .maybeSingle();

  if (subscriptionError || !subscription?.stripe_customer_id) {
    return NextResponse.json({ error: "Esta igreja ainda nao tem uma assinatura ativa." }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${appUrl}/assinatura`,
  });

  return NextResponse.json({ url: portalSession.url });
}
