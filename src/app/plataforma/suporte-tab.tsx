"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Ban, Gift, Loader2, LifeBuoy, PlusCircle, TimerReset } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { SectionHeader } from "@/components/section-header";
import { useToast } from "@/components/toast-provider";
import { supabase } from "@/lib/supabase/client";

type ChurchOption = {
  church_id: string;
  church_name: string;
};

type ChurchNote = {
  id: string;
  note: string;
  created_by_name: string | null;
  created_at: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function SuporteTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState("");
  const [notes, setNotes] = useState<ChurchNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [customDays, setCustomDays] = useState("30");
  const [extendingTrial, setExtendingTrial] = useState(false);
  const [grantingLifetime, setGrantingLifetime] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const loadChurches = useCallback(async () => {
    const { data, error } = await supabase.rpc("platform_list_churches");
    if (error) {
      toast.error(error.message);
      return;
    }

    const options = ((data ?? []) as { church_id: string; church_name: string }[]).map((row) => ({
      church_id: row.church_id,
      church_name: row.church_name,
    }));
    setChurches(options);
    setSelectedChurchId((current) => current || options[0]?.church_id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNotes = useCallback(async (churchId: string) => {
    if (!churchId) {
      setNotes([]);
      return;
    }

    setLoadingNotes(true);
    const { data, error } = await supabase.rpc("platform_list_church_notes", { target_church_id: churchId });
    setLoadingNotes(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setNotes((data ?? []) as ChurchNote[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadChurches();
    });
  }, [loadChurches]);

  useEffect(() => {
    queueMicrotask(() => {
      loadNotes(selectedChurchId);
    });
  }, [selectedChurchId, loadNotes]);

  async function extendTrial(days: number) {
    if (!selectedChurchId || !days || days <= 0) return;

    setExtendingTrial(true);
    const { error } = await supabase.rpc("platform_extend_trial", {
      target_church_id: selectedChurchId,
      extra_days: days,
    });
    setExtendingTrial(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Teste gratis estendido em ${days} dias.`);
  }

  async function grantLifetime() {
    if (!selectedChurchId) return;

    const ok = await confirm({
      title: "Conceder acesso vitalicio gratis?",
      description: "Essa igreja nunca mais sera bloqueada por pagamento, ate voce revogar manualmente.",
      confirmLabel: "Conceder acesso vitalicio",
    });
    if (!ok) return;

    setGrantingLifetime(true);
    const { error } = await supabase.rpc("platform_grant_lifetime_access", { target_church_id: selectedChurchId });
    setGrantingLifetime(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Acesso vitalicio concedido.");
  }

  async function revokeAccess() {
    if (!selectedChurchId) return;

    const ok = await confirm({
      title: "Revogar acesso desta igreja?",
      description: "O acesso sera bloqueado imediatamente, como se a assinatura estivesse cancelada.",
      confirmLabel: "Revogar acesso",
      tone: "danger",
    });
    if (!ok) return;

    setRevoking(true);
    const { error } = await supabase.rpc("platform_revoke_access", { target_church_id: selectedChurchId });
    setRevoking(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Acesso revogado.");
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedChurchId) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const noteText = String(formData.get("note") || "").trim();
    if (!noteText) return;

    setSavingNote(true);
    const { error } = await supabase.rpc("platform_add_church_note", {
      target_church_id: selectedChurchId,
      note_text: noteText,
    });
    setSavingNote(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    form.reset();
    toast.success("Anotacao salva.");
    await loadNotes(selectedChurchId);
  }

  return (
    <section className="space-y-4">
      <SectionHeader eyebrow="Suporte" title="Ajudar uma igreja" />

      <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm">
        <label className="text-xs font-black uppercase text-slate-400">Igreja</label>
        <select
          value={selectedChurchId}
          onChange={(event) => setSelectedChurchId(event.target.value)}
          className="field-control mt-2"
        >
          {churches.length === 0 && <option value="">Nenhuma igreja</option>}
          {churches.map((church) => (
            <option key={church.church_id} value={church.church_id}>
              {church.church_name}
            </option>
          ))}
        </select>

        <p className="mt-4 text-xs font-black uppercase text-slate-400">Estender teste gratis</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => extendTrial(7)}
            disabled={extendingTrial || !selectedChurchId}
            className="flex min-h-11 items-center gap-2 rounded-2xl bg-sky-900 px-4 text-sm font-black text-white disabled:opacity-60"
          >
            {extendingTrial ? <Loader2 className="animate-spin" size={16} /> : <TimerReset size={16} />}
            +7 dias
          </button>
          <button
            onClick={() => extendTrial(14)}
            disabled={extendingTrial || !selectedChurchId}
            className="flex min-h-11 items-center gap-2 rounded-2xl bg-sky-900 px-4 text-sm font-black text-white disabled:opacity-60"
          >
            {extendingTrial ? <Loader2 className="animate-spin" size={16} /> : <TimerReset size={16} />}
            +14 dias
          </button>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={365}
              value={customDays}
              onChange={(event) => setCustomDays(event.target.value)}
              className="field-control h-11 w-20 px-2 text-center"
            />
            <button
              onClick={() => extendTrial(Number(customDays))}
              disabled={extendingTrial || !selectedChurchId || !Number(customDays)}
              className="flex min-h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-60"
            >
              {extendingTrial ? <Loader2 className="animate-spin" size={16} /> : <TimerReset size={16} />}
              dias
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs font-semibold text-slate-400">
          Libera o acesso da igreja imediatamente, mesmo se estiver bloqueada por pagamento pendente.
        </p>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button
            onClick={grantLifetime}
            disabled={grantingLifetime || !selectedChurchId}
            className="flex min-h-11 items-center gap-2 rounded-2xl bg-violet-900 px-4 text-sm font-black text-white disabled:opacity-60"
          >
            {grantingLifetime ? <Loader2 className="animate-spin" size={16} /> : <Gift size={16} />}
            Conceder acesso vitalicio gratis
          </button>
          <button
            onClick={revokeAccess}
            disabled={revoking || !selectedChurchId}
            className="flex min-h-11 items-center gap-2 rounded-2xl bg-rose-800 px-4 text-sm font-black text-white disabled:opacity-60"
          >
            {revoking ? <Loader2 className="animate-spin" size={16} /> : <Ban size={16} />}
            Revogar acesso
          </button>
        </div>
      </div>

      <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <LifeBuoy size={18} className="text-emerald-700" />
          <h3 className="text-sm font-black text-slate-950">Historico de suporte</h3>
        </div>

        <form onSubmit={addNote} className="native-form mt-3 flex flex-col gap-2 sm:flex-row">
          <input name="note" required placeholder="Anotar contato, duvida ou combinado com a igreja..." className="field-control flex-1" />
          <button disabled={savingNote || !selectedChurchId} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-900 px-4 text-sm font-black text-white disabled:opacity-60">
            {savingNote ? <Loader2 className="animate-spin" size={16} /> : <PlusCircle size={16} />}
            Salvar
          </button>
        </form>

        <div className="mt-4 space-y-2">
          {loadingNotes && <p className="text-sm font-semibold text-slate-400">Carregando anotacoes...</p>}
          {!loadingNotes && notes.length === 0 && (
            <p className="text-sm font-semibold text-slate-400">Nenhuma anotacao para esta igreja ainda.</p>
          )}
          {notes.map((note) => (
            <div key={note.id} className="rounded-2xl bg-slate-50 p-3">
              <p className="text-sm font-semibold leading-6 text-slate-700">{note.note}</p>
              <p className="mt-1 text-[11px] font-bold uppercase text-slate-400">
                {note.created_by_name ?? "Admin geral"} - {formatDateTime(note.created_at)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
