"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase/client";

export default function SetupPage() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const churchName = String(formData.get("churchName") || "Igreja Central").trim();
    const city = String(formData.get("city") || "").trim();
    const state = String(formData.get("state") || "").trim();

    const { data: church, error: churchError } = await supabase
      .from("churches")
      .insert({ name: churchName, city, state })
      .select("id")
      .single();

    if (churchError || !church) {
      setError(churchError?.message ?? "Nao foi possivel criar a igreja.");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        church_id: church.id,
        role: "admin",
        name: currentUser.name,
      })
      .eq("id", currentUser.id);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    const { error: cellsError } = await supabase.from("cells").insert([
      {
        church_id: church.id,
        name: "Casa da Paz",
        meeting_day: "Terca",
        meeting_time: "20h",
        neighborhood: "Centro",
        active: true,
      },
      {
        church_id: church.id,
        name: "Renovo",
        meeting_day: "Quinta",
        meeting_time: "19h30",
        neighborhood: "Vila Esperanca",
        active: true,
      },
    ]);

    if (cellsError) {
      setError(cellsError.message);
      setLoading(false);
      return;
    }

    setMessage("Igreja criada, seu perfil virou administrador e celulas iniciais foram adicionadas. Recarregue o app para atualizar a sessao.");
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#f7f8f3] px-4 py-5 text-slate-900">
      <div className="mx-auto max-w-md">
        <header className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="flex h-11 w-11 items-center justify-center rounded-lg bg-white shadow-sm">
            <ArrowLeft size={18} />
          </Link>
          <p className="text-sm font-bold text-emerald-700">Ovelhas by Savio Cipriano</p>
        </header>

        <section className="rounded-[24px] bg-slate-950 p-6 text-white shadow-xl shadow-slate-900/10">
          <Building2 size={34} className="text-emerald-200" />
          <h1 className="mt-5 text-3xl font-semibold leading-tight">Configurar primeira igreja</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Esta etapa vincula sua conta real a uma igreja e prepara o ambiente inicial.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="mt-5 rounded-[22px] border border-white/80 bg-white/90 p-5 shadow-sm">
          <div className="space-y-3">
            <input
              name="churchName"
              required
              className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
              placeholder="Nome da igreja"
              defaultValue="Igreja Central"
            />
            <input
              name="city"
              className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
              placeholder="Cidade"
            />
            <input
              name="state"
              className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
              placeholder="Estado"
            />
          </div>

          {error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
          {message && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{message}</p>}

          <button
            disabled={loading}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white disabled:opacity-70"
          >
            {loading && <Loader2 className="animate-spin" size={18} />}
            Criar igreja e configurar admin
          </button>
        </form>
      </div>
    </main>
  );
}
