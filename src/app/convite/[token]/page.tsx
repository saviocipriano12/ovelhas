"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, LogIn, UserPlus } from "lucide-react";
import type { Invite } from "@/lib/data";
import { roleLabels } from "@/lib/data";
import { acceptInvite, getInviteByToken } from "@/lib/local-store";
import { supabase } from "@/lib/supabase/client";

export default function InviteAcceptPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getInviteByToken(token).then((result) => {
      if (active) {
        setInvite(result);
        setLoadingInvite(false);
      }
    });

    return () => {
      active = false;
    };
  }, [token]);

  async function applyInvite() {
    const result = await acceptInvite(token);

    if (!result.ok) {
      setError(result.error ?? "Nao foi possivel aceitar o convite.");
      return false;
    }

    setMessage("Convite aceito. Preparando seu acesso...");
    router.push("/dashboard");
    router.refresh();
    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || invite?.name || "").trim();
    const email = String(formData.get("email") || invite?.email || "").trim();
    const password = String(formData.get("password") || "");

    const { data: sessionData } = await supabase.auth.getSession();

    if (sessionData.session) {
      await applyInvite();
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          invite_token: token,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setMessage("Conta criada. Confirme seu email e depois abra este convite novamente para ativar o acesso.");
      setLoading(false);
      return;
    }

    await applyInvite();
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#f7f8f3] px-4 py-5 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-md flex-col">
        <header className="mb-6 flex items-center justify-between">
          <Link href="/login" className="flex h-11 w-11 items-center justify-center rounded-lg bg-white shadow-sm">
            <ArrowLeft size={18} />
          </Link>
          <p className="text-sm font-bold text-emerald-700">Ovelhas by Savio Cipriano</p>
        </header>

        <section className="rounded-[24px] bg-slate-950 p-6 text-white shadow-xl shadow-slate-900/10">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-xl font-black text-emerald-950">
            O
          </div>
          <p className="mt-5 text-sm font-semibold text-emerald-200">Convite para o Ovelhas</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight">
            {loadingInvite ? "Carregando convite..." : invite ? "Entre na sua igreja" : "Convite nao encontrado"}
          </h1>
          {invite && (
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Voce esta sendo convidado como {roleLabels[invite.role]}. Seu acesso sera separado conforme sua responsabilidade.
            </p>
          )}
        </section>

        {invite ? (
          <form onSubmit={handleSubmit} className="mt-5 rounded-[22px] border border-white/80 bg-white/90 p-5 shadow-sm">
            <div className="mb-4 rounded-lg bg-emerald-50 p-4">
              <p className="font-bold text-emerald-950">{invite.name || "Novo acesso"}</p>
              <p className="mt-1 text-sm text-emerald-800">{roleLabels[invite.role]}</p>
            </div>

            <div className="space-y-3">
              <input
                name="name"
                required
                defaultValue={invite.name}
                className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                placeholder="Nome completo"
              />
              <input
                name="email"
                type="email"
                required
                defaultValue={invite.email}
                className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                placeholder="Email"
              />
              <input
                name="password"
                type="password"
                required
                minLength={6}
                className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                placeholder="Criar senha"
              />
            </div>

            {error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
            {message && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{message}</p>}

            <button
              disabled={loading}
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
              Aceitar convite
            </button>

            <button
              type="button"
              onClick={applyInvite}
              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 text-sm font-bold text-slate-700"
            >
              <LogIn size={18} />
              Ja estou logado
            </button>
          </form>
        ) : (
          <div className="mt-5 rounded-[22px] border border-white/80 bg-white/90 p-5 text-center shadow-sm">
            {loadingInvite ? <Loader2 className="mx-auto animate-spin text-emerald-800" /> : <CheckCircle2 className="mx-auto text-slate-400" />}
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Verifique se o link esta correto ou peça um novo convite para sua liderança.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
