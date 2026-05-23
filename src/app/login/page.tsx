"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const name = String(formData.get("name") || "").trim();

    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      setMessage("Conta criada. Voce ja pode continuar no app.");
      router.push("/dashboard");
      router.refresh();
    } else {
      setMessage("Conta criada. Verifique seu email para confirmar o acesso.");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#f7f8f3] px-4 py-5 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-md flex-col">
        <header className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="flex h-11 w-11 items-center justify-center rounded-lg bg-white shadow-sm">
            <ArrowLeft size={18} />
          </Link>
          <p className="text-sm font-bold text-emerald-700">Ovelhas by Savio Cipriano</p>
        </header>

        <section className="rounded-[24px] bg-slate-950 p-6 text-white shadow-xl shadow-slate-900/10">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-xl font-black text-emerald-950">
            O
          </div>
          <h1 className="mt-5 text-3xl font-semibold leading-tight">
            {mode === "signin" ? "Entrar no Ovelhas" : "Criar acesso"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Use sua conta para acessar dados reais da igreja. O modo demo continua disponivel em `/acesso`.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="mt-5 rounded-[22px] border border-white/80 bg-white/90 p-5 shadow-sm">
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`min-h-10 rounded-lg text-sm font-bold ${mode === "signin" ? "bg-white text-emerald-900 shadow-sm" : "text-slate-500"}`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`min-h-10 rounded-lg text-sm font-bold ${mode === "signup" ? "bg-white text-emerald-900 shadow-sm" : "text-slate-500"}`}
            >
              Cadastrar
            </button>
          </div>

          <div className="space-y-3">
            {mode === "signup" && (
              <input
                name="name"
                required
                className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                placeholder="Nome completo"
              />
            )}
            <input
              name="email"
              type="email"
              required
              className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
              placeholder="Email"
            />
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
              placeholder="Senha"
            />
          </div>

          {error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
          {message && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{message}</p>}

          <button
            disabled={loading}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
            {mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>
      </div>
    </main>
  );
}
