import { describe, expect, it } from "vitest";
import { guessColumnMapping, normalizeImportedDate, parseCsv } from "@/lib/csv-import";

describe("parseCsv", () => {
  it("separa linhas e colunas simples", () => {
    const result = parseCsv("nome,telefone\nJoao,11999999999\nMaria,11888888888");
    expect(result).toEqual([
      ["nome", "telefone"],
      ["Joao", "11999999999"],
      ["Maria", "11888888888"],
    ]);
  });

  it("respeita campos entre aspas com virgula dentro", () => {
    const result = parseCsv('nome,endereco\n"Joao","Rua A, 123"');
    expect(result).toEqual([
      ["nome", "endereco"],
      ["Joao", "Rua A, 123"],
    ]);
  });

  it("ignora linhas totalmente vazias", () => {
    const result = parseCsv("nome\nJoao\n\nMaria\n");
    expect(result).toEqual([["nome"], ["Joao"], ["Maria"]]);
  });
});

describe("guessColumnMapping", () => {
  it("reconhece variacoes comuns de nome de coluna em portugues", () => {
    const mapping = guessColumnMapping(["Nome completo", "Celular", "E-mail", "Bairro"]);
    expect(mapping.name).toBe(0);
    expect(mapping.phone).toBe(1);
    expect(mapping.email).toBe(2);
    expect(mapping.neighborhood).toBe(3);
  });

  it("nao mapeia campo que nao existe no cabecalho", () => {
    const mapping = guessColumnMapping(["Nome"]);
    expect(mapping.phone).toBeUndefined();
  });
});

describe("normalizeImportedDate", () => {
  it("converte data no formato brasileiro para ISO", () => {
    expect(normalizeImportedDate("25/12/1990")).toBe("1990-12-25");
  });

  it("mantem data ja em formato ISO", () => {
    expect(normalizeImportedDate("1990-12-25")).toBe("1990-12-25");
  });

  it("retorna undefined para data invalida ou vazia", () => {
    expect(normalizeImportedDate("")).toBeUndefined();
    expect(normalizeImportedDate("nao e uma data")).toBeUndefined();
  });
});
