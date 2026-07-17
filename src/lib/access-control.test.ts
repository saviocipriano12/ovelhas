import { describe, expect, it } from "vitest";
import { canViewCell, canViewPerson, getScopedCells, getScopedPeople } from "@/lib/access-control";
import type { AppUser, Cell, Person } from "@/lib/data";

function makeUser(overrides: Partial<AppUser>): AppUser {
  return {
    id: "user-1",
    name: "Usuario Teste",
    role: "member",
    churchId: "church-a",
    ...overrides,
  };
}

function makePerson(overrides: Partial<Person>): Person {
  return {
    id: "person-1",
    name: "Pessoa Teste",
    initials: "PT",
    stage: "Visitante",
    status: "Boas-vindas",
    phone: "",
    email: "",
    cell: "",
    leader: "",
    discipleshipLeader: "",
    neighborhood: "",
    firstVisit: "",
    birthday: "",
    progress: 0,
    cellAbsences: 0,
    servicePresent: false,
    tone: "",
    churchId: "church-a",
    cellId: "cell-a",
    createdByUserId: "leader-a",
    leaderUserId: "leader-a",
    ...overrides,
  };
}

function makeCell(overrides: Partial<Cell>): Cell {
  return {
    id: "cell-a",
    churchId: "church-a",
    name: "Celula A",
    leaderUserId: "leader-a",
    leaderName: "Lider A",
    supervisorUserId: "supervisor-a",
    neighborhood: "",
    meetingDay: "",
    meetingTime: "",
    address: "",
    active: true,
    ...overrides,
  };
}

describe("isolamento entre igrejas (multi-tenant)", () => {
  it("admin nunca ve pessoas de outra igreja, mesmo com o mesmo id de usuario", () => {
    const admin = makeUser({ role: "admin", churchId: "church-a" });
    const personOtherChurch = makePerson({ churchId: "church-b" });

    expect(canViewPerson(admin, personOtherChurch)).toBe(false);
  });

  it("pastor nunca ve celulas de outra igreja", () => {
    const pastor = makeUser({ role: "pastor", churchId: "church-a" });
    const cellOtherChurch = makeCell({ churchId: "church-b" });

    expect(canViewCell(pastor, cellOtherChurch)).toBe(false);
  });

  it("getScopedPeople filtra estritamente por igreja para admin", () => {
    const admin = makeUser({ role: "admin", churchId: "church-a" });
    const people = [
      makePerson({ id: "p1", churchId: "church-a" }),
      makePerson({ id: "p2", churchId: "church-b" }),
    ];

    const visible = getScopedPeople(admin, people, false);
    expect(visible.map((p) => p.id)).toEqual(["p1"]);
  });
});

describe("escopo dentro da mesma igreja por papel", () => {
  it("supervisor so ve celulas atribuidas a ele, nao todas da igreja", () => {
    const supervisor = makeUser({ role: "supervisor", churchId: "church-a", cellIds: ["cell-1"] });
    const cells = [
      makeCell({ id: "cell-1", churchId: "church-a", supervisorUserId: "user-1" }),
      makeCell({ id: "cell-2", churchId: "church-a", supervisorUserId: "outro-supervisor" }),
    ];

    const visible = getScopedCells(supervisor, cells, false);
    expect(visible.map((c) => c.id)).toEqual(["cell-1"]);
  });

  it("lider so ve pessoas da propria celula, nao pessoas de outro lider na mesma igreja", () => {
    const leader = makeUser({ role: "leader", churchId: "church-a", id: "leader-1", cellIds: ["cell-1"] });
    const people = [
      makePerson({ id: "p1", churchId: "church-a", cellId: "cell-1", leaderUserId: "leader-1" }),
      makePerson({ id: "p2", churchId: "church-a", cellId: "cell-2", leaderUserId: "leader-2" }),
    ];

    const visible = getScopedPeople(leader, people, false);
    expect(visible.map((p) => p.id)).toEqual(["p1"]);
  });

  it("admin e pastor veem toda a propria igreja, sem restricao de celula", () => {
    const pastor = makeUser({ role: "pastor", churchId: "church-a" });
    const people = [
      makePerson({ id: "p1", churchId: "church-a", cellId: "cell-1" }),
      makePerson({ id: "p2", churchId: "church-a", cellId: "cell-2" }),
    ];

    const visible = getScopedPeople(pastor, people, false);
    expect(visible.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });
});

describe("membro comum", () => {
  it("membro so ve o proprio cadastro, nunca o de outra pessoa", () => {
    const member = makeUser({ role: "member", churchId: "church-a", personId: "person-1" });
    const people = [
      makePerson({ id: "person-1", churchId: "church-a" }),
      makePerson({ id: "person-2", churchId: "church-a" }),
    ];

    const visible = getScopedPeople(member, people, false);
    expect(visible.map((p) => p.id)).toEqual(["person-1"]);
  });
});
