"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Loader2, LogIn, MailCheck, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Mode = "signin" | "reset" | "new-password";

function friendlyAuthError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return "Email ou senha incorretos.";
  }

  if (lower.includes("email not confirmed")) {
    return "Seu email ainda nao foi confirmado. Verifique sua caixa de entrada.";
  }

  if (lower.includes("password")) {
    return "Confira a senha. Ela precisa ter pelo menos 6 caracteres.";
  }

  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const nextPath = searchParams.get("next") || "/dashboard";

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("new-password");
        setMessage("Agora crie uma nova senha para sua conta.");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    if (mode === "reset") {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (resetError) {
        setError(friendlyAuthError(resetError.message));
        setLoading(false);
        return;
      }

      setMessage("Enviamos um link de recuperacao para seu email.");
      setLoading(false);
      return;
    }

    if (mode === "new-password") {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(friendlyAuthError(updateError.message));
        setLoading(false);
        return;
      }

      setMessage("Senha atualizada. Entrando no Ovelhas...");
      router.push(nextPath.startsWith("/") ? nextPath : "/dashboard");
      router.refresh();
      return;
    }

    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError(friendlyAuthError(signInError.message));
        setLoading(false);
        return;
      }

      router.push(nextPath.startsWith("/") ? nextPath : "/dashboard");
      router.refresh();
      return;
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#071411] px-4 py-5 text-slate-900">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,#34d39933_0,transparent_32%),linear-gradient(180deg,#071411_0%,#f7f8f3_48%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-40px)] max-w-md flex-col">
        <header className="mb-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg font-black text-emerald-950 shadow-lg shadow-black/20">
              O
            </div>
            <div>
              <p className="text-sm font-bold">Ovelhas</p>
              <p className="text-xs font-medium text-emerald-100">by Savio Cipriano</p>
            </div>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-emerald-100 backdrop-blur">
            acesso real
          </span>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-white/10 p-6 text-white shadow-2xl shadow-black/20 backdrop-blur-2xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-300/20 text-emerald-100">
            <ShieldCheck size={25} />
          </div>
          <h1 className="mt-5 text-3xl font-semibold leading-tight">
            {mode === "signin" ? "Entrar no Ovelhas" : mode === "reset" ? "Recuperar senha" : "Nova senha"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Os dados da igreja ficam protegidos por login, perfil e permissoes de pastor, supervisor, lider e membro.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2 text-xs font-semibold text-emerald-50">
            {["Seguro", "Separado", "Mobile"].map((item) => (
              <span key={item} className="rounded-full bg-white/10 px-3 py-2 text-center">
                {item}
              </span>
            ))}
          </div>
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
              onClick={() => setMode("reset")}
              className={`min-h-10 rounded-lg text-sm font-bold ${mode === "reset" || mode === "new-password" ? "bg-white text-emerald-900 shadow-sm" : "text-slate-500"}`}
            >
              Senha
            </button>
          </div>

          <div className="space-y-3">
            {mode !== "new-password" && (
              <input
                name="email"
                type="email"
                required
                className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                placeholder="Email"
              />
            )}
            {mode !== "reset" && (
              <label className="flex min-h-12 items-center rounded-lg border border-slate-200 bg-white px-3 focus-within:border-emerald-500">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  className="min-h-11 flex-1 bg-transparent text-sm outline-none"
                  placeholder={mode === "new-password" ? "Nova senha" : "Senha"}
                />
                <button type="button" onClick={() => setShowPassword((current) => !current)} className="text-slate-400">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </label>
            )}
          </div>

          {error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
          {message && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{message}</p>}

          <button
            disabled={loading}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : mode === "reset" ? <MailCheck size={18} /> : <LogIn size={18} />}
            {mode === "signin" ? "Entrar" : mode === "reset" ? "Enviar recuperacao" : "Salvar nova senha"}
          </button>
        </form>

        <div className="mt-4 rounded-[20px] border border-emerald-100 bg-emerald-50 p-4 text-emerald-950">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0" size={19} />
            <p className="text-sm leading-5">
              Para entrar como membro, lider ou supervisor, use o convite criado pela lideranca. Assim o acesso ja nasce vinculado a igreja e a celula correta.
            </p>
          </div>
          <Link href="/convites" className="mt-3 hidden text-sm font-bold text-emerald-800">
            Convites
          </Link>
        </div>
      </div>
    </main>
  );
}
