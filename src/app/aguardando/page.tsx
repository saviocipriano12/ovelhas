"use client";

import Link from "next/link";
import { Clock3, LogOut, MailCheck, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

export default function WaitingAccessPage() {
  const { currentUser, signOut } = useAuth();

  return (
    <main className="min-h-screen bg-[#f7f8f3] px-4 py-5 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-md flex-col justify-center">
        <section className="overflow-hidden rounded-[30px] bg-slate-950 text-white shadow-2xl shadow-slate-900/15">
          <div className="bg-[radial-gradient(circle_at_top_left,#34d39966_0,transparent_38%),linear-gradient(135deg,#020617,#064e3b)] p-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
              <Clock3 size={28} />
            </div>
            <h1 className="mt-6 text-3xl font-semibold leading-tight">Acesso aguardando liberacao</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Sua conta foi criada, mas ainda nao esta vinculada a uma igreja, celula ou discipulado.
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-sm">
          <div className="flex gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-950">
            <ShieldCheck size={21} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">{currentUser.name}</p>
              <p className="mt-1 text-sm leading-5 text-emerald-800">
                Por seguranca, membros so entram pelo convite enviado pela lideranca. Isso define sua igreja, celula e permissao correta.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex gap-3 rounded-2xl bg-slate-50 p-4">
              <MailCheck size={20} className="mt-0.5 shrink-0 text-slate-500" />
              <p className="text-sm leading-5 text-slate-600">
                Se voce recebeu um link de convite, abra o link neste aparelho depois de entrar com esta conta.
              </p>
            </div>
            <div className="flex gap-3 rounded-2xl bg-slate-50 p-4">
              <Clock3 size={20} className="mt-0.5 shrink-0 text-slate-500" />
              <p className="text-sm leading-5 text-slate-600">
                Se ainda nao recebeu, fale com seu lider para gerar um convite nominal.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Link
              href="/configuracao"
              className="mb-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-900 px-4 text-sm font-bold text-white"
            >
              Configurar primeiro admin
            </Link>
            <button
              onClick={signOut}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700"
            >
              <LogOut size={17} />
              Sair
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
