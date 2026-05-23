"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, UserCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { parseCheckInCode } from "@/lib/checkin";
import { useActivityEvents, useCells, useCheckIns, useLocalPeople } from "@/lib/local-store";

export default function PublicCheckInPage() {
  const params = useParams<{ code: string }>();
  const { currentUser, isDemoMode } = useAuth();
  const { cells } = useCells();
  const { people } = useLocalPeople();
  const parsed = parseCheckInCode(params.code);
  const cell = cells.find((item) => item.id === parsed.cellId);
  const { addCheckIn } = useCheckIns(cell?.churchId ?? currentUser.churchId);
  const { addEvent } = useActivityEvents();
  const memberPerson = useMemo(
    () =>
      people.find((person) => person.personUserId === currentUser.id || person.id === currentUser.personId) ??
      people.find((person) => person.cellId === parsed.cellId),
    [currentUser.id, currentUser.personId, parsed.cellId, people],
  );
  const [name, setName] = useState(memberPerson?.name ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (!cell) {
      setError("Check-in invalido. Peça um novo QR para o lider.");
      setLoading(false);
      return;
    }

    const personName = name.trim() || memberPerson?.name || "Visitante";
    const result = await addCheckIn({
      churchId: cell.churchId,
      cellId: cell.id,
      personId: memberPerson?.id,
      personName,
      checkinType: parsed.checkinType,
      checkinDate: new Date().toISOString().slice(0, 10),
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok) {
      setError(result.error ?? "Nao foi possivel confirmar presença.");
      setLoading(false);
      return;
    }

    await addEvent({
      churchId: cell.churchId,
      actorUserId: currentUser.id,
      actorName: personName,
      actorRole: currentUser.role,
      action: "Fez check-in",
      description: `${personName} confirmou presença em ${cell.name}.`,
      targetType: "cell",
      targetId: cell.id,
      targetName: cell.name,
      personId: memberPerson?.id,
      cellId: cell.id,
      visibility: "leadership",
      persistToSupabase: !isDemoMode,
    });

    setMessage("Presença confirmada. Seja bem-vindo!");
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
          <UserCheck size={36} className="text-emerald-200" />
          <p className="mt-5 text-sm font-bold uppercase text-emerald-200">Check-in</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight">{cell?.name ?? "Confirmar presença"}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Confirme sua presença {parsed.checkinType === "service" ? "no culto" : "na celula"} com um toque.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="mt-5 rounded-[22px] border border-white/80 bg-white/90 p-5 shadow-sm">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
            placeholder="Seu nome"
          />

          {error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
          {message && (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
              <CheckCircle2 size={18} />
              {message}
            </p>
          )}

          <button disabled={loading} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white disabled:opacity-70">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <UserCheck size={18} />}
            Confirmar presença
          </button>
        </form>
      </div>
    </main>
  );
}
