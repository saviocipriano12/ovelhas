export type SubscriptionTier = "pequena" | "media" | "grande";

export const SUBSCRIPTION_PLANS: Record<
  SubscriptionTier,
  { label: string; limit: number | null; priceLabel: string; priceCents: number }
> = {
  pequena: { label: "Pequena", limit: 300, priceLabel: "R$ 59,90/mes", priceCents: 5990 },
  media: { label: "Media", limit: 800, priceLabel: "R$ 89,90/mes", priceCents: 8990 },
  grande: { label: "Grande", limit: null, priceLabel: "R$ 129,90/mes", priceCents: 12990 },
};

export const SUBSCRIPTION_TIER_ORDER: SubscriptionTier[] = ["pequena", "media", "grande"];

export function suggestTier(peopleCount: number): SubscriptionTier {
  if (peopleCount <= SUBSCRIPTION_PLANS.pequena.limit!) {
    return "pequena";
  }

  if (peopleCount <= SUBSCRIPTION_PLANS.media.limit!) {
    return "media";
  }

  return "grande";
}

export function isSubscriptionTier(value: unknown): value is SubscriptionTier {
  return typeof value === "string" && value in SUBSCRIPTION_PLANS;
}

const BLOCKING_STATUSES = new Set(["canceled", "unpaid", "incomplete_expired"]);

export function isSubscriptionBlocked(status: string | null | undefined) {
  return Boolean(status && BLOCKING_STATUSES.has(status));
}

export const SUPPORT_WHATSAPP_NUMBER = "5531972545430";

export function getSupportWhatsAppLink(message: string) {
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
