"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Church,
  Edit3,
  FileText,
  MapPin,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { PersonAvatar } from "@/components/person-avatar";
import { ProgressBar } from "@/components/progress-bar";
import { SectionHeader } from "@/components/section-header";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { canViewPastoralNote, canViewPerson, canWritePastoralNote } from "@/lib/access-control";
import { getCareScore, roleLabels } from "@/lib/data";
import { useActivityEvents, useLocalPeople, usePastoralNotes } from "@/lib/local-store";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function noteLabel(visibility: string) {
  if (visibility === "pastor_private") {
    return "Somente pastor/admin";
  }

  if (visibility === "member_visible") {
    return "Visivel ao membro";
  }

  return "Lideranca";
}

export default function PersonProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { currentUser, isDemoMode } = useAuth();
  const { people, updatePerson, deletePerson } = useLocalPeople();
  const { notes, addNote } = usePastoralNotes();
  const { events, addEvent } = useActivityEvents();
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"leadership_private" | "pastor_private" | "member_visible">("leadership_private");
  const person = people.find((item) => item.id === params.id);

  const personNotes = useMemo(() => {
    if (!person) {
      return [];
    }

    return notes
      .filter((note) => note.personId === person.id && canViewPastoralNote(currentUser, note, person))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [currentUser, notes, person]);

  const personEvents = useMemo(
    () =>
      events
        .filter((event) => event.personId === person?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 6),
    [events, person?.id],
  );

  if (!person || !canViewPerson(currentUser, person)) {
    return (
      <AppShell>
        <section className="rounded-lg border border-white/80 bg-white/90 p-5 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Pessoa nao encontrada</h2>
          <p className="mt-2 text-sm text-slate-500">Volte para a lista e selecione alguem acompanhado.</p>
          <Link href="/pessoas" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white">
            Voltar para pessoas
          </Link>
        </section>
      </AppShell>
    );
  }

  const activePerson = person;
  const careScore = getCareScore(activePerson);
  const canEdit = canWritePastoralNote(currentUser, activePerson);

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const result = await updatePerson(activePerson.id, {
      name: String(formData.get("name") || activePerson.name).trim(),
      phone: String(formData.get("phone") || activePerson.phone).trim(),
      email: String(formData.get("email") || "").trim(),
      birthDate: String(formData.get("birthDate") || "").trim(),
      address: String(formData.get("address") || "").trim(),
      familyPhone: String(formData.get("familyPhone") || "").trim(),
      photoUrl: String(formData.get("photoUrl") || "").trim(),
      neighborhood: String(formData.get("neighborhood") || "").trim(),
      status: String(formData.get("status") || activePerson.status).trim(),
      stage: String(formData.get("stage") || activePerson.stage).trim(),
      maritalStatus: String(formData.get("maritalStatus") || "").trim(),
      privateNotes: String(formData.get("privateNotes") || "").trim(),
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok) {
      setFeedback(`Nao consegui salvar: ${result.error}`);
      return;
    }

    await addEvent({
      churchId: activePerson.churchId,
      actorUserId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "Atualizou perfil",
      description: `${currentUser.name} atualizou dados de ${activePerson.name}.`,
      targetType: "person",
      targetId: activePerson.id,
      targetName: activePerson.name,
      personId: activePerson.id,
      cellId: activePerson.cellId,
      visibility: "leadership",
      persistToSupabase: !isDemoMode,
    });

    setFeedback("Perfil atualizado.");
    setEditing(false);
  }

  async function handleDelete() {
    if (!window.confirm(`Apagar ${activePerson.name}? Esta acao remove o cadastro e os registros vinculados a esta pessoa.`)) {
      return;
    }

    const result = await deletePerson(activePerson.id, !isDemoMode);

    if (!result.ok) {
      setFeedback(`Nao consegui apagar: ${result.error}`);
      return;
    }

    router.push("/pessoas");
    router.refresh();
  }

  async function handleAddNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!noteText.trim()) {
      return;
    }

    const result = await addNote({
      personId: activePerson.id,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      note: noteText.trim(),
      visibility: noteVisibility,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok) {
      setFeedback(`Nao consegui registrar nota: ${result.error}`);
      return;
    }

    await addEvent({
      churchId: activePerson.churchId,
      actorUserId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "Registrou nota pastoral",
      description: `${currentUser.name} registrou um acompanhamento para ${activePerson.name}.`,
      targetType: "person",
      targetId: activePerson.id,
      targetName: activePerson.name,
      personId: activePerson.id,
      cellId: activePerson.cellId,
      visibility: "leadership",
      persistToSupabase: !isDemoMode,
    });

    setNoteText("");
    setFeedback("Nota registrada.");
  }

  return (
    <AppShell>
      <section className="animate-enter grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <Link href="/pessoas" className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600" aria-label="Voltar">
              <ArrowLeft size={18} />
            </Link>
            {canEdit && (
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-bold text-slate-700">
                  <Edit3 size={16} />
                  Editar
                </button>
                <button onClick={handleDelete} className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-700" aria-label={`Apagar ${person.name}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>

          <PersonAvatar person={person} size="lg" />
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">{person.name}</h2>
          <p className="text-slate-500">{person.stage}</p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-400">Cuidado</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">{careScore}%</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-400">Trilha</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">{person.progress}%</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-600">Discipulado</span>
              <span className="font-bold text-emerald-700">{person.progress}%</span>
            </div>
            <ProgressBar value={person.progress} />
          </div>

          <div className="mt-5 space-y-3 text-sm text-slate-600">
            <p className="flex items-center gap-2"><Church size={16} className="text-emerald-700" />{person.cell}</p>
            <p className="flex items-center gap-2"><UserRound size={16} className="text-emerald-700" />Lider e discipulado: {person.leader}</p>
            <p className="flex items-center gap-2"><MapPin size={16} className="text-emerald-700" />{person.address || person.neighborhood || "Endereco nao informado"}</p>
            <p className="flex items-center gap-2"><CalendarCheck size={16} className="text-emerald-700" />Primeira visita em {person.firstVisit}</p>
            <p className="flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-700" />Acesso atual: {roleLabels[currentUser.role]}</p>
          </div>

          <div className="mt-5 grid gap-2">
            <WhatsAppButton phone={person.phone} label="Abrir WhatsApp" message={`Ola, ${person.name}! Que alegria caminhar com voce. Como posso orar por voce hoje?`} className="w-full" />
          </div>
        </div>

        <div className="space-y-5">
          {feedback && <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{feedback}</div>}

          {editing && (
            <form onSubmit={handleUpdate} className="native-form rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm sm:p-5">
              <SectionHeader eyebrow="Dados" title="Editar perfil" />
              <div className="grid gap-3 md:grid-cols-2">
                <input name="name" defaultValue={person.name} className="field-control" placeholder="Nome" />
                <input name="photoUrl" defaultValue={person.photoUrl} className="field-control" placeholder="URL da foto" />
                <input name="phone" defaultValue={person.phone} className="field-control" placeholder="WhatsApp" />
                <input name="familyPhone" defaultValue={person.familyPhone} className="field-control" placeholder="Telefone familiar" />
                <input name="email" defaultValue={person.email} className="field-control" placeholder="Email" />
                <input name="birthDate" type="date" defaultValue={person.birthDate} className="field-control" />
                <input name="neighborhood" defaultValue={person.neighborhood} className="field-control" placeholder="Bairro" />
                <input name="maritalStatus" defaultValue={person.maritalStatus} className="field-control" placeholder="Estado civil" />
                <input name="stage" defaultValue={person.stage} className="field-control" placeholder="Etapa" />
                <input name="status" defaultValue={person.status} className="field-control" placeholder="Status" />
                <input name="address" defaultValue={person.address} className="field-control md:col-span-2" placeholder="Endereco completo" />
                <textarea name="privateNotes" defaultValue={person.privateNotes} rows={3} className="field-control min-h-28 resize-none py-3 md:col-span-2" placeholder="Observacao privada do cadastro" />
              </div>
              <button className="primary-action mt-4">
                <Save size={18} />
                Salvar alteracoes
              </button>
            </form>
          )}

          <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader eyebrow="Jornada" title="Linha do tempo" />
            <div className="space-y-4">
              {[...personEvents].map((event, index) => (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-800">{index + 1}</span>
                    {index < personEvents.length - 1 && <span className="mt-2 h-8 w-px bg-emerald-100" />}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-950">{event.action}</p>
                    <p className="text-sm text-slate-500">{event.description}</p>
                  </div>
                </div>
              ))}
              {personEvents.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">A jornada aparecera conforme a lideranca registrar presenca, videos e cuidados.</p>}
            </div>
          </section>

          <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader eyebrow="Notas" title="Acompanhamento pastoral" />
            {canEdit && (
              <form onSubmit={handleAddNote} className="mb-4 space-y-3">
                <textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} rows={3} className="w-full resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500" placeholder="Registre contato, visita, pedido de oracao ou proximo passo..." />
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <select value={noteVisibility} onChange={(event) => setNoteVisibility(event.target.value as typeof noteVisibility)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                    <option value="leadership_private">Lideranca</option>
                    <option value="pastor_private">Somente pastor/admin</option>
                    <option value="member_visible">Visivel ao membro</option>
                  </select>
                  <button className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white">
                    <FileText size={17} />
                    Registrar
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {personNotes.map((note) => (
                <article key={note.id} className="rounded-lg bg-slate-50 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-950">{note.createdByName}</p>
                    <span className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-500">{noteLabel(note.visibility)}</span>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{note.note}</p>
                  <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-slate-400">
                    <CheckCircle2 size={13} />
                    {formatDate(note.createdAt)}
                  </p>
                </article>
              ))}
              {personNotes.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">Nenhuma nota visivel para seu acesso.</p>}
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
