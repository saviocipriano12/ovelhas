import { describe, expect, it } from "vitest";
import { isSubscriptionBlocked, isSubscriptionTier, suggestTier } from "@/lib/subscription-plans";

describe("isSubscriptionBlocked", () => {
  it("bloqueia status que representam falta de pagamento", () => {
    expect(isSubscriptionBlocked("canceled")).toBe(true);
    expect(isSubscriptionBlocked("unpaid")).toBe(true);
    expect(isSubscriptionBlocked("incomplete_expired")).toBe(true);
  });

  it("nao bloqueia status saudaveis, mesmo em atraso temporario", () => {
    expect(isSubscriptionBlocked("active")).toBe(false);
    expect(isSubscriptionBlocked("trialing")).toBe(false);
    expect(isSubscriptionBlocked("past_due")).toBe(false);
    expect(isSubscriptionBlocked("lifetime")).toBe(false);
  });

  it("nao bloqueia quando nao ha assinatura ainda", () => {
    expect(isSubscriptionBlocked(undefined)).toBe(false);
    expect(isSubscriptionBlocked(null)).toBe(false);
  });
});

describe("suggestTier", () => {
  it("sugere pequena ate 300 pessoas", () => {
    expect(suggestTier(1)).toBe("pequena");
    expect(suggestTier(300)).toBe("pequena");
  });

  it("sugere media entre 301 e 800 pessoas", () => {
    expect(suggestTier(301)).toBe("media");
    expect(suggestTier(800)).toBe("media");
  });

  it("sugere grande acima de 800 pessoas", () => {
    expect(suggestTier(801)).toBe("grande");
    expect(suggestTier(5000)).toBe("grande");
  });
});

describe("isSubscriptionTier", () => {
  it("aceita apenas os tiers validos", () => {
    expect(isSubscriptionTier("pequena")).toBe(true);
    expect(isSubscriptionTier("media")).toBe(true);
    expect(isSubscriptionTier("grande")).toBe(true);
    expect(isSubscriptionTier("premium")).toBe(false);
    expect(isSubscriptionTier(undefined)).toBe(false);
  });
});
