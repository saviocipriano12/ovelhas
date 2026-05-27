"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Copy, Link2, MessageCircle, QrCode, Send, Share2, Trash2, UserPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionHeader } from "@/components/section-header";
import { getInviteableRoles, getScopedCells } from "@/lib/access-control";
import { roleLabels, type UserRole } from "@/lib/data";
import { useCells, useInvites } from "@/lib/local-store";
import { whatsappLink } from "@/lib/whatsapp";

function inviteUrl(token: string) {
  if (typeof window === "undefined") {
    return `/convite/${token}`;
  }

  return `${window.location.origin}/convite/${token}`;
}

function statusTone(status: string) {
  if (status === "accepted") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "expired") {
    return "bg-rose-100 text-rose-800";
  }

  return "bg-amber-100 text-amber-900";
}

export default function InvitesPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { cells } = useCells();
  const { invites, createInvite, deleteInvite, refreshInvites, isLoadingInvites, inviteLoadError } = useInvites();
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const inviteableRoles = useMemo(() => getInviteableRoles(currentUser), [currentUser]);
  const [role, setRole] = useState<UserRole>(inviteableRoles[0] ?? "member");
  const [cellId, setCellId] = useState(visibleCells[0]?.id ?? "");
  const [feedback, setFeedback] = useState("");
  const [lastLink, setLastLink] = useState("");
  const canInvite = inviteableRoles.length > 0;
  const allowedRoles = inviteableRoles;
  const visibleInvites = isDemoMode
    ? invites.filter((invite) => invite.churchId === currentUser.churchId)
    : invites;
  const selectedCell = visibleCells.find((cell) => cell.id === cellId) ?? visibleCells[0];

  async function copyLink(link: string) {
    await navigator.clipboard?.writeText(link);
    setFeedback("Link copiado.");
  }

  async function shareInvite(link: string, inviteName = "novo acesso") {
    const text = `Aqui esta seu convite para entrar no Ovelhas: ${link}`;

    if (navigator.share) {
      await navigator.share({
        title: `Convite Ovelhas - ${inviteName}`,
        text,
        url: link,
      });
      return;
    }

    await navigator.clipboard?.writeText(text);
    setFeedback("Mensagem do convite copiada.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canInvite) {
      setFeedback("Seu acesso nao permite criar convites.");
      return;
    }

    if (!allowedRoles.includes(role)) {
      setFeedback("Esse tipo de acesso nao pode ser convidado pelo seu perfil.");
      return;
    }

    if ((role === "member" || role === "leader") && !selectedCell?.id) {
      setFeedback("Escolha uma celula antes de gerar convite para lider ou membro.");
      return;
    }

    const result = await createInvite({
      churchId: currentUser.churchId,
      name,
      email,
      role,
      cellId: role === "member" || role === "leader" ? selectedCell?.id ?? "" : "",
      createdBy: currentUser.id,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok || !result.invite) {
      setFeedback(`Nao consegui criar o convite: ${result.error}`);
      return;
    }

    const link = inviteUrl(result.invite.token);
    setLastLink(link);
    setName("");
    setEmail("");
    setFeedback(`Convite criado para ${result.invite.name || roleLabels[result.invite.role]}.`);
    await refreshInvites();
  }

  async function handleDeleteInvite(id: string, inviteName: string) {
    if (!window.confirm(`Apagar o convite de ${inviteName}?`)) {
      return;
    }

    const result = await deleteInvite(id);
    setFeedback(result.ok ? "Convite apagado." : `Nao consegui apagar o convite: ${result.error}`);

    if (result.ok) {
      await refreshInvites();
    }
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <SectionHeader
          eyebrow={roleLabels[currentUser.role]}
          title="Convites"
          action={
            <button
              onClick={async () => {
                const result = await refreshInvites();
                setFeedback(result.ok ? "Convites atualizados." : `Nao consegui carregar convites: ${result.error}`);
              }}
              className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"
            >
              {isLoadingInvites ? "Carregando..." : `Atualizar - ${visibleInvites.length} links`}
            </button>
          }
        />

        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
          <p className="font-semibold text-emerald-950">Entrada organizada</p>
          <p className="mt-1 text-sm leading-5 text-emerald-800">
            Crie links para cada pessoa entrar no Ovelhas ja com papel, igreja e celula corretos.
          </p>
        </div>

        {inviteLoadError && (
          <div className="rounded-lg border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            Nao consegui carregar convites do Supabase: {inviteLoadError}
          </div>
        )}

        {canInvite && (
          <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={handleSubmit} className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm sm:p-5">
              <SectionHeader eyebrow="Novo acesso" title="Criar convite" />
              <div className="space-y-3">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nome da pessoa"
                  className="field-control"
                />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  placeholder="Email opcional"
                  className="field-control"
                />
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as UserRole)}
                  className="field-control"
                >
                  {allowedRoles.map((item) => (
                    <option key={item} value={item}>
                      {roleLabels[item]}
                    </option>
                  ))}
                </select>
                {(role === "member" || role === "leader") && (
                  <select
                    value={selectedCell?.id ?? ""}
                    onChange={(event) => setCellId(event.target.value)}
                    className="field-control"
                  >
                    {visibleCells.map((cell) => (
                      <option key={cell.id} value={cell.id}>
                        {cell.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button className="primary-action mt-4">
                <UserPlus size={18} />
                Gerar link
              </button>
            </form>

            <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm sm:p-5">
              <SectionHeader eyebrow="Compartilhar" title="Ultimo convite" />
              {lastLink ? (
                <div className="space-y-3">
                  <div className="flex justify-center rounded-lg bg-slate-50 p-4">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(lastLink)}`}
                      alt="QR Code do convite"
                      className="h-36 w-36 rounded-lg bg-white p-2"
                    />
                  </div>
                  <div className="break-all rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-700">{lastLink}</div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button onClick={() => copyLink(lastLink)} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white">
                      <Copy size={17} />
                      Copiar
                    </button>
                    <button onClick={() => shareInvite(lastLink)} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 text-sm font-bold text-white">
                      <Share2 size={17} />
                      Enviar
                    </button>
                    <a
                      href={whatsappLink("", `Aqui esta seu convite para entrar no Ovelhas: ${lastLink}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#25d366] px-4 text-sm font-bold text-white"
                    >
                      <MessageCircle size={17} />
                      WhatsApp
                    </a>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-slate-50 p-5 text-sm leading-6 text-slate-500">
                  O link gerado aparece aqui para copiar ou enviar no WhatsApp.
                </div>
              )}
              {feedback && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{feedback}</p>}
            </div>
          </section>
        )}

        <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader eyebrow="Historico" title="Links criados" />
          <div className="space-y-3">
            {visibleInvites.map((invite) => {
              const cell = cells.find((item) => item.id === invite.cellId);
              const link = inviteUrl(invite.token);

              return (
                <article key={invite.id} className="rounded-lg bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-950">{invite.name || roleLabels[invite.role]}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {roleLabels[invite.role]} {cell ? `- ${cell.name}` : ""}
                      </p>
                    </div>
                    <span className={`rounded-lg px-2 py-1 text-xs font-bold ${statusTone(invite.status)}`}>
                      {invite.status === "pending" ? "Pendente" : invite.status === "accepted" ? "Aceito" : "Expirado"}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <button onClick={() => copyLink(link)} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-white px-3 text-xs font-bold text-slate-700">
                      <Link2 size={15} />
                      Copiar link
                    </button>
                    <button onClick={() => shareInvite(link, invite.name || roleLabels[invite.role])} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-sky-700 px-3 text-xs font-bold text-white">
                      <Share2 size={15} />
                      Enviar
                    </button>
                    <a href={`/convite/${invite.token}`} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-900 px-3 text-xs font-bold text-white">
                      <Send size={15} />
                      Abrir
                    </a>
                    <button
                      onClick={() => handleDeleteInvite(invite.id, invite.name || roleLabels[invite.role])}
                      className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-rose-50 px-3 text-xs font-bold text-rose-700"
                    >
                      <Trash2 size={15} />
                      Apagar
                    </button>
                  </div>
                  <details className="mt-2">
                    <summary className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-500">
                      <QrCode size={14} />
                      Mostrar QR Code
                    </summary>
                    <div className="mt-3 flex justify-center rounded-lg bg-white p-3">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(link)}`}
                        alt="QR Code do convite"
                        className="h-32 w-32"
                      />
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </AppShell>
  );
}
