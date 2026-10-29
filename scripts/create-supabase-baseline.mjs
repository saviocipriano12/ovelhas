import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = resolve(projectRoot, "supabase", "migrations");

const copies = [
  ["src/lib/supabase/full-setup.sql", "20261013000100_core_baseline.sql"],
  ["src/lib/supabase/consolidation.sql", "20261013000200_consolidation.sql"],
  ["src/lib/supabase/producao-atualizacao-final.sql", "20261013000400_production_hardening.sql"],
];

await mkdir(migrationsDir, { recursive: true });

for (const [sourceName, targetName] of copies) {
  const source = await readFile(resolve(projectRoot, sourceName), "utf8");
  const target = resolve(migrationsDir, targetName);

  try {
    const existing = await readFile(target, "utf8");
    if (existing !== source) {
      throw new Error(`${targetName} ja existe com conteudo diferente; migrations aplicadas sao imutaveis.`);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
    await writeFile(target, source, "utf8");
  }
}

console.log("Baseline de migrations criado/verificado.");
