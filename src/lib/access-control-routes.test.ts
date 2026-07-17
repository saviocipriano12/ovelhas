import { describe, expect, it } from "vitest";
import { canAccessRoute, getDefaultRoute, isPendingAccount } from "@/lib/access-control";
import type { AppUser } from "@/lib/data";

function makeUser(overrides: Partial<AppUser>): AppUser {
  return {
    id: "user-1",
    name: "Usuario Teste",
    role: "member",
    churchId: "church-a",
    ...overrides,
  };
}

describe("conta pendente (convite ainda nao vinculado a uma pessoa/igreja)", () => {
  it("membro sem igreja atribuida fica pendente", () => {
    const user = makeUser({ role: "member", churchId: "sem-igreja" });
    expect(isPendingAccount(user)).toBe(true);
  });

  it("membro sem cadastro de pessoa vinculado fica pendente, mesmo com igreja definida", () => {
    const user = makeUser({ role: "member", churchId: "church-a", personId: undefined });
    expect(isPendingAccount(user)).toBe(true);
  });

  it("membro com pessoa vinculada nao fica pendente", () => {
    const user = makeUser({ role: "member", churchId: "church-a", personId: "person-1" });
    expect(isPendingAccount(user)).toBe(false);
  });

  it("lideranca (nao-membro) nunca fica pendente so por nao ter personId", () => {
    const leader = makeUser({ role: "leader", churchId: "church-a" });
    expect(isPendingAccount(leader)).toBe(false);
  });

  it("admin geral da plataforma nunca fica pendente", () => {
    const platformAdmin = makeUser({ role: "admin", churchId: "sem-igreja", platformAdmin: true });
    expect(isPendingAccount(platformAdmin)).toBe(false);
  });
});

describe("rota padrao apos login, por tipo de conta", () => {
  it("conta pendente sempre cai em /aguardando, nao importa o papel", () => {
    const user = makeUser({ role: "leader", churchId: "sem-igreja" });
    expect(getDefaultRoute(user)).toBe("/aguardando");
  });

  it("membro com conta ativa vai para meu-discipulado", () => {
    const user = makeUser({ role: "member", churchId: "church-a", personId: "person-1" });
    expect(getDefaultRoute(user)).toBe("/meu-discipulado");
  });
});

describe("acesso bloqueado para conta pendente", () => {
  it("conta pendente so acessa /aguardando e /configuracao, nada mais", () => {
    const pending = makeUser({ role: "member", churchId: "sem-igreja" });

    expect(canAccessRoute(pending, "/aguardando")).toBe(true);
    expect(canAccessRoute(pending, "/dashboard")).toBe(false);
    expect(canAccessRoute(pending, "/pessoas")).toBe(false);
  });

  it("assinatura fica bloqueada tambem para conta pendente, ate ela ser vinculada", () => {
    const pending = makeUser({ role: "member", churchId: "sem-igreja" });
    expect(canAccessRoute(pending, "/assinatura")).toBe(false);
  });

  it("assinatura fica acessivel assim que a conta deixa de ser pendente", () => {
    const active = makeUser({ role: "member", churchId: "church-a", personId: "person-1" });
    expect(canAccessRoute(active, "/assinatura")).toBe(true);
  });
});

describe("isolamento de rota da plataforma (admin geral)", () => {
  it("admin comum de uma igreja sem ser platformAdmin nao acessa /plataforma se nao tiver igreja", () => {
    const adminSemIgreja = makeUser({ role: "admin", churchId: "sem-igreja", platformAdmin: false });
    expect(canAccessRoute(adminSemIgreja, "/plataforma")).toBe(false);
  });

  it("membro comum nunca acessa /plataforma", () => {
    const member = makeUser({ role: "member", churchId: "church-a", personId: "person-1" });
    expect(canAccessRoute(member, "/plataforma")).toBe(false);
  });

  it("platformAdmin acessa /plataforma independente do papel", () => {
    const platformAdmin = makeUser({ role: "admin", churchId: "church-a", platformAdmin: true });
    expect(canAccessRoute(platformAdmin, "/plataforma")).toBe(true);
  });
});
