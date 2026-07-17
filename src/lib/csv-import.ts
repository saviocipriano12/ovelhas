export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === "," || char === ";") {
      row.push(field.trim());
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") i++;
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell !== ""));
}

export type PersonImportField = "name" | "phone" | "email" | "birthDate" | "neighborhood" | "address";

export const PERSON_IMPORT_FIELDS: { field: PersonImportField; label: string; required: boolean }[] = [
  { field: "name", label: "Nome", required: true },
  { field: "phone", label: "Telefone", required: false },
  { field: "email", label: "E-mail", required: false },
  { field: "birthDate", label: "Data de nascimento", required: false },
  { field: "neighborhood", label: "Bairro", required: false },
  { field: "address", label: "Endereco", required: false },
];

const HEADER_GUESSES: Record<PersonImportField, string[]> = {
  name: ["nome", "name", "nome completo"],
  phone: ["telefone", "celular", "whatsapp", "phone", "fone"],
  email: ["email", "e-mail"],
  birthDate: ["nascimento", "data de nascimento", "aniversario", "aniversário", "data nascimento", "birthdate"],
  neighborhood: ["bairro", "neighborhood"],
  address: ["endereco", "endereço", "address", "rua"],
};

export function guessColumnMapping(headers: string[]): Partial<Record<PersonImportField, number>> {
  const mapping: Partial<Record<PersonImportField, number>> = {};
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());

  for (const { field } of PERSON_IMPORT_FIELDS) {
    const guesses = HEADER_GUESSES[field];
    const index = normalizedHeaders.findIndex((header) => guesses.includes(header));
    if (index !== -1) {
      mapping[field] = index;
    }
  }

  return mapping;
}

export function normalizeImportedDate(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;

  const brMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return undefined;
}
