"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { Copy, Filter, MessageCircle, Plus, Share2, Upload, UserPlus, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { PersonCard } from "@/components/person-card";
import { SectionHeader } from "@/components/section-header";
import { useToast } from "@/components/toast-provider";
import { canManagePeople, getScopedCells, getScopedPeople } from "@/lib/access-control";
import {
  guessColumnMapping,
  normalizeImportedDate,
  parseCsv,
  PERSON_IMPORT_FIELDS,
  type PersonImportField,
} from "@/lib/csv-import";
import { useCells, useInvites, useLocalPeople } from "@/lib/local-store";
import { whatsappLink } from "@/lib/whatsapp";

function inviteUrl(token: string) {
  if (typeof window === "undefined") {
    return `/convite/${token}`;
  }

  return `${window.location.origin}/convite/${token}`;
}

export default function PeoplePage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people, addPerson, refreshPeople, isLoadingPeople, peopleLoadError } = useLocalPeople();
  const { cells, refreshCells, isLoadingCells } = useCells();
  const { createInvite } = useInvites();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "visitor" | "discipleship" | "attention" | "baptism">("all");
  const [open, setOpen] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState("");
  const [lastInviteName, setLastInviteName] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<string[][]>([]);
  const [importMapping, setImportMapping] = useState<Partial<Record<PersonImportField, number>>>({});
  const [importCellId, setImportCellId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{ ok: number; failed: number } | null>(null);
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);

  const filteredPeople = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const visiblePeople = getScopedPeople(currentUser, people, isDemoMode);

    return visiblePeople.filter((person) => {
      const matchesQuery =
        !normalizedQuery ||
        [person.name, person.stage, person.status, person.neighborhood]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const status = `${person.stage} ${person.status}`.toLowerCase();
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "visitor" && status.includes("visitante")) ||
        (activeFilter === "discipleship" && (status.includes("discipulado") || status.includes("fundamentos"))) ||
        (activeFilter === "attention" && (person.cellAbsences >= 2 || status.includes("precisa contato") || status.includes("atencao"))) ||
        (activeFilter === "baptism" && status.includes("batismo"));

      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, currentUser, isDemoMode, people, query]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const stage = String(formData.get("stage") || "Visitante");
    const neighborhood = String(formData.get("neighborhood") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const birthDate = String(formData.get("birthDate") || "").trim();
    const address = String(formData.get("address") || "").trim();
    const familyPhone = String(formData.get("familyPhone") || "").trim();
    const cellId = String(formData.get("cellId") || visibleCells[0]?.id || "");
    const selectedCell = visibleCells.find((cell) => cell.id === cellId);

    if (!name || !phone) {
      toast.error("Informe nome e WhatsApp para continuar.");
      return;
    }

    if (!selectedCell) {
      toast.error("Escolha uma celula valida antes de cadastrar a pessoa.");
      return;
    }

    const result = await addPerson({
      name,
      phone,
      stage,
      neighborhood,
      email,
      birthDate,
      address,
      familyPhone,
      createdByUserId: currentUser.id,
      leaderUserId: selectedCell.leaderUserId || (currentUser.role === "leader" ? currentUser.id : undefined),
      churchId: currentUser.churchId,
      cellId: selectedCell.id,
      cellName: selectedCell.name,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok || !result.person) {
      toast.error(`Nao consegui cadastrar: ${result.error}`);
      return;
    }

    const inviteResult = await createInvite({
      churchId: currentUser.churchId,
      name: result.person.name,
      email: result.person.email,
      role: "member",
      cellId: result.person.cellId,
      personId: result.person.id,
      createdBy: currentUser.id,
      persistToSupabase: !isDemoMode,
    });

    if (inviteResult.ok && inviteResult.invite) {
      setLastInviteLink(inviteUrl(inviteResult.invite.token));
      setLastInviteName(result.person.name);
      toast.success(`${result.person.name} foi cadastrado. Convite pronto para enviar ao membro.`);
    } else {
      toast.warning(`${result.person.name} foi cadastrado, mas nao consegui gerar convite: ${inviteResult.error}`);
    }

    await Promise.all([refreshPeople(), refreshCells()]);
    setOpen(false);
    event.currentTarget.reset();
  }

  async function copyLastInvite() {
    await navigator.clipboard?.writeText(lastInviteLink);
    toast.success("Link do convite copiado.");
  }

  async function shareLastInvite() {
    const text = `Ola, ${lastInviteName}! Aqui esta seu convite para entrar no Ovelhas: ${lastInviteLink}`;

    if (navigator.share) {
      await navigator.share({ title: `Convite Ovelhas - ${lastInviteName}`, text, url: lastInviteLink });
      return;
    }

    await navigator.clipboard?.writeText(text);
    toast.success("Mensagem do convite copiada.");
  }

  async function generateInviteForPerson(personId: string) {
    const person = filteredPeople.find((item) => item.id === personId) ?? people.find((item) => item.id === personId);

    if (!person) {
      toast.error("Pessoa nao encontrada para gerar convite.");
      return;
    }

    const result = await createInvite({
      churchId: currentUser.churchId,
      name: person.name,
      email: person.email,
      role: "member",
      cellId: person.cellId,
      personId: person.id,
      createdBy: currentUser.id,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok || !result.invite) {
      toast.error(`Nao consegui gerar convite para ${person.name}: ${result.error}`);
      return;
    }

    setLastInviteLink(inviteUrl(result.invite.token));
    setLastInviteName(person.name);
    toast.success(`Convite de ${person.name} pronto para enviar, sem duplicar cadastro.`);
  }

  function handleCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const rows = parseCsv(text);
      if (rows.length < 2) {
        toast.error("O arquivo precisa ter uma linha de cabecalho e pelo menos uma pessoa.");
        return;
      }

      const [headerRow, ...dataRows] = rows;
      setImportHeaders(headerRow);
      setImportRows(dataRows);
      setImportMapping(guessColumnMapping(headerRow));
      setImportCellId(visibleCells[0]?.id ?? "");
      setImportSummary(null);
      setImportOpen(true);
    };
    reader.readAsText(file, "utf-8");
  }

  async function confirmCsvImport() {
    const selectedCell = visibleCells.find((cell) => cell.id === importCellId);
    if (!selectedCell) {
      toast.error("Escolha a celula que vai receber as pessoas importadas.");
      return;
    }

    const nameColumn = importMapping.name;
    if (nameColumn === undefined) {
      toast.error("Escolha qual coluna do arquivo tem o nome da pessoa.");
      return;
    }

    setImporting(true);
    let ok = 0;
    let failed = 0;

    for (const row of importRows) {
      const name = row[nameColumn]?.trim();
      if (!name) {
        failed++;
        continue;
      }

      const birthDateRaw = importMapping.birthDate !== undefined ? row[importMapping.birthDate] ?? "" : "";

      const result = await addPerson({
        name,
        phone: importMapping.phone !== undefined ? (row[importMapping.phone] ?? "").trim() : "",
        stage: "Visitante",
        neighborhood: importMapping.neighborhood !== undefined ? (row[importMapping.neighborhood] ?? "").trim() : "",
        email: importMapping.email !== undefined ? (row[importMapping.email] ?? "").trim() : undefined,
        birthDate: normalizeImportedDate(birthDateRaw),
        address: importMapping.address !== undefined ? (row[importMapping.address] ?? "").trim() : undefined,
        createdByUserId: currentUser.id,
        leaderUserId: selectedCell.leaderUserId || (currentUser.role === "leader" ? currentUser.id : undefined),
        churchId: currentUser.churchId,
        cellId: selectedCell.id,
        cellName: selectedCell.name,
        persistToSupabase: !isDemoMode,
      });

      if (result.ok) {
        ok++;
      } else {
        failed++;
      }
    }

    setImporting(false);
    setImportSummary({ ok, failed });
    await Promise.all([refreshPeople(), refreshCells()]);

    if (ok > 0) {
      toast.success(`${ok} pessoa(s) importada(s) para ${selectedCell.name}.`);
    }
    if (failed > 0) {
      toast.warning(`${failed} linha(s) nao puderam ser importadas.`);
    }
  }

  function closeImport() {
    setImportOpen(false);
    setImportHeaders([]);
    setImportRows([]);
    setImportMapping({});
    setImportSummary(null);
  }

  return (
    <AppShell hideMobileNav={open} hidePwaStatus={open}>
      <section className="animate-enter space-y-4">
        {!open && (
          <>
        <SectionHeader
          eyebrow="Celula"
          title="Pessoas acompanhadas"
          action={
            canManagePeople(currentUser) ? (
              <div className="flex gap-2">
                <label
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm"
                  aria-label="Importar pessoas por CSV"
                >
                  <Upload size={17} />
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFile} />
                </label>
                <button
                  onClick={() => {
                    if (isLoadingCells) {
                      toast.warning("Aguarde as celulas carregarem antes de cadastrar pessoas.");
                      return;
                    }

                    if (visibleCells.length === 0) {
                      toast.error("Crie ou atribua uma celula antes de cadastrar pessoas.");
                      return;
                    }

                    setOpen(true);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900 text-white shadow-sm"
                  aria-label="Adicionar pessoa"
                >
                  <Plus size={18} />
                </button>
              </div>
            ) : null
          }
        />

        <div className="flex gap-2 overflow-x-auto pb-1 app-scrollbar">
          {[
            { id: "all", label: "Todos" },
            { id: "visitor", label: "Visitantes" },
            { id: "discipleship", label: "Em discipulado" },
            { id: "attention", label: "Sem contato" },
            { id: "baptism", label: "Batismo" },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id as typeof activeFilter)}
              className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-bold shadow-sm ${
                activeFilter === filter.id ? "border-emerald-900 bg-emerald-900 text-white" : "border-white/80 bg-white/90 text-slate-600"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-white/80 bg-white/75 p-3 shadow-sm">
          <label className="flex min-h-12 items-center gap-3 rounded-lg bg-slate-100 px-3 text-sm text-slate-500">
            <Filter size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
              placeholder="Buscar por nome, status ou bairro"
            />
          </label>
        </div>

        {lastInviteLink && (
          <section className="rounded-[24px] border border-emerald-100 bg-white/95 p-4 shadow-sm">
            <p className="text-xs font-black uppercase text-emerald-700">Convite do membro</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">{lastInviteName}</h3>
            <p className="mt-2 break-all rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">{lastInviteLink}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={copyLastInvite} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-3 text-xs font-black text-white">
                <Copy size={15} />
                Copiar
              </button>
              <button onClick={shareLastInvite} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-sky-700 px-3 text-xs font-black text-white">
                <Share2 size={15} />
                Enviar
              </button>
              <a
                href={whatsappLink("", `Ola, ${lastInviteName}! Aqui esta seu convite para entrar no Ovelhas: ${lastInviteLink}`)}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#25d366] px-3 text-xs font-black text-white"
              >
                <MessageCircle size={15} />
                WhatsApp
              </a>
            </div>
          </section>
        )}

        {peopleLoadError && (
          <div className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-800">
            Nao consegui carregar pessoas: {peopleLoadError}
          </div>
        )}

        {isLoadingPeople && (
          <div className="rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm font-semibold text-sky-800">
            Atualizando pessoas...
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredPeople.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              action={
                canManagePeople(currentUser) ? (
                  <button
                    onClick={() => generateInviteForPerson(person.id)}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-3 text-xs font-black text-emerald-900"
                  >
                    <UserPlus size={15} />
                    Gerar convite deste cadastro
                  </button>
                ) : null
              }
            />
          ))}
        </div>

        {filteredPeople.length === 0 && (
          <div className="rounded-lg border border-white/80 bg-white/90 p-5 text-center text-sm font-medium text-slate-500">
            Nenhuma pessoa visivel para este perfil de acesso.
          </div>
        )}

          </>
        )}

        {open && (
          <form
            onSubmit={handleSubmit}
            className="form-screen animate-enter mx-auto w-full max-w-6xl"
          >
              <div className="shrink-0 border-b border-slate-200/80 bg-white/95 px-1 py-3 backdrop-blur sm:px-0">
                <div className="flex w-full items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-emerald-700">Novo cuidado</p>
                    <h2 className="text-xl font-semibold text-slate-950">Adicionar pessoa</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-700"
                    aria-label="Voltar para pessoas"
                  >
                    <X size={18} />
                    <span className="hidden sm:inline">Cancelar</span>
                  </button>
                </div>
              </div>

              <div className="form-screen-body min-h-0 flex-1 py-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
                    <p className="mb-1 text-xs font-black uppercase text-emerald-700">Passo 1 de 2</p>
                    <h3 className="mb-4 text-lg font-black text-slate-950">Quem chegou para caminhar?</h3>
                    <div className="space-y-3">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-black uppercase text-slate-500">Nome completo</span>
                        <input name="name" required className="field-control" placeholder="Ex: Maria Silva" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-black uppercase text-slate-500">WhatsApp</span>
                        <input name="phone" required inputMode="tel" className="field-control" placeholder="(00) 00000-0000" />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-[24px] bg-emerald-50 p-4 ring-1 ring-emerald-100">
                    <p className="mb-1 text-xs font-black uppercase text-emerald-700">Passo 2 de 2</p>
                    <h3 className="mb-4 text-lg font-black text-slate-950">Onde ela vai ser cuidada?</h3>
                    <div className="space-y-3">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-black uppercase text-emerald-800">Celula</span>
                        <select name="cellId" required className="field-control">
                          {visibleCells.map((cell) => (
                            <option key={cell.id} value={cell.id}>
                              {cell.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-black uppercase text-emerald-800">Etapa atual</span>
                        <select name="stage" className="field-control">
                          <option>Visitante</option>
                          <option>Novo membro</option>
                          <option>Em discipulado</option>
                          <option>Batismo</option>
                          <option>Servindo</option>
                        </select>
                      </label>
                      <p className="rounded-2xl bg-white/80 p-3 text-xs font-bold leading-5 text-emerald-900">
                        Ao salvar, o Ovelhas tambem gera um convite para essa pessoa entrar no app vinculada a esta celula.
                      </p>
                    </div>
                  </div>

                  <details className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100 lg:col-span-2">
                    <summary className="cursor-pointer list-none text-sm font-black text-slate-800 marker:hidden">
                      Mais informacoes sobre a pessoa <span className="ml-1 text-xs font-semibold text-slate-400">opcional</span>
                    </summary>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-black uppercase text-slate-500">Email</span>
                        <input name="email" type="email" className="field-control" placeholder="Opcional" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-black uppercase text-slate-500">Nascimento</span>
                        <input name="birthDate" type="date" className="field-control" aria-label="Data de nascimento" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-black uppercase text-slate-500">Bairro</span>
                        <input name="neighborhood" className="field-control" placeholder="Ex: Centro" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-black uppercase text-slate-500">Telefone familiar</span>
                        <input name="familyPhone" inputMode="tel" className="field-control" placeholder="Opcional" />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-black uppercase text-slate-500">Endereco completo</span>
                        <input name="address" className="field-control" placeholder="Rua, numero e complemento" />
                      </label>
                    </div>
                  </details>
                </div>
              </div>

              <div className="form-screen-footer shrink-0 border-t border-slate-200/80 bg-white/95 py-3 backdrop-blur">
                <div className="flex w-full gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="hidden min-h-14 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-600 sm:block"
                  >
                    Cancelar
                  </button>
                  <button className="primary-action min-h-14 flex-1">
                    Salvar pessoa e gerar convite
                  </button>
                </div>
              </div>
          </form>
        )}

        {importOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px]">
              <div className="flex items-start justify-between gap-3">
                <SectionHeader eyebrow="Importar" title="Cadastrar pessoas por CSV" />
                <button onClick={closeImport} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500" aria-label="Fechar">
                  <X size={16} />
                </button>
              </div>

              {importSummary ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                    {importSummary.ok} pessoa(s) importada(s) com sucesso.
                    {importSummary.failed > 0 && ` ${importSummary.failed} linha(s) falharam (nome vazio ou erro ao salvar).`}
                  </div>
                  <button onClick={closeImport} className="primary-action w-full">
                    Concluir
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="mb-1 text-xs font-bold uppercase text-slate-400">Celula que vai receber essas pessoas</p>
                    <select value={importCellId} onChange={(event) => setImportCellId(event.target.value)} className="field-control">
                      <option value="" disabled>
                        Escolha a celula
                      </option>
                      {visibleCells.map((cell) => (
                        <option key={cell.id} value={cell.id}>
                          {cell.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-bold uppercase text-slate-400">
                      Confirme qual coluna do arquivo corresponde a cada campo ({importRows.length} pessoa(s) encontradas)
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {PERSON_IMPORT_FIELDS.map(({ field, label, required }) => (
                        <label key={field} className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-500">
                            {label}
                            {required && " *"}
                          </span>
                          <select
                            value={importMapping[field] ?? ""}
                            onChange={(event) =>
                              setImportMapping((current) => ({
                                ...current,
                                [field]: event.target.value === "" ? undefined : Number(event.target.value),
                              }))
                            }
                            className="field-control"
                          >
                            <option value="">Nao importar</option>
                            {importHeaders.map((header, index) => (
                              <option key={header + index} value={index}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>

                  {importRows.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase text-slate-400">Previa (primeiras linhas)</p>
                      <div className="overflow-x-auto rounded-lg border border-slate-100">
                        <table className="w-full text-left text-xs">
                          <tbody>
                            {importRows.slice(0, 3).map((row, rowIndex) => (
                              <tr key={rowIndex} className="border-b border-slate-100 last:border-0">
                                {row.map((cell, cellIndex) => (
                                  <td key={cellIndex} className="p-2 text-slate-600">
                                    {cell || "-"}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <button onClick={confirmCsvImport} disabled={importing} className="primary-action w-full disabled:opacity-60">
                    {importing ? "Importando..." : `Importar ${importRows.length} pessoa(s)`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
