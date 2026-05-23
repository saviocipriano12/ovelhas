"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "error";

export function SupabaseStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(() => {
        if (active) {
          setStatus("ready");
        }
      })
      .catch(() => {
        if (active) {
          setStatus("error");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (status === "checking") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-500">
        <Loader2 className="animate-spin" size={16} />
        Verificando Supabase
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
        <XCircle size={16} />
        Supabase nao conectado
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
      <CheckCircle2 size={16} />
      Supabase configurado
    </div>
  );
}
