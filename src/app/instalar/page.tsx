"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, CheckCircle2, Copy, Download, ExternalLink, Share2, Smartphone, Store } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SectionHeader } from "@/components/section-header";
import { useToast } from "@/components/toast-provider";
import {
  notificationsEnabled,
  notificationsSupported,
  requestDeviceNotificationPermission,
  sendDeviceNotification,
} from "@/lib/device-notifications";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function InstallPage() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const toast = useToast();
  const [notificationActive, setNotificationActive] = useState(() => notificationsEnabled());
  const appUrl = useMemo(() => (typeof window === "undefined" ? "https://ovelhas.vercel.app" : window.location.origin), []);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  async function installPwa() {
    if (!installPrompt) {
      toast.warning("Se o botao de instalar nao apareceu, abra pelo Chrome no Android e use Adicionar a tela inicial.");
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);

    if (choice.outcome === "accepted") {
      toast.success("Ovelhas instalado neste aparelho.");
    } else {
      toast.warning("Instalacao cancelada.");
    }
  }

  async function enableNotifications() {
    const result = await requestDeviceNotificationPermission();
    setNotificationActive(result.ok);

    if (result.ok) {
      toast.success("Notificacoes ativadas neste aparelho.");
      await sendDeviceNotification({
        id: `install-test-${Date.now()}`,
        title: "Ovelhas ativado",
        body: "Os avisos importantes de cuidado pastoral podem aparecer aqui.",
        url: "/notificacoes",
      });
    } else {
      toast.error("Nao foi possivel ativar notificacoes neste aparelho.");
    }
  }

  async function shareApp() {
    if (navigator.share) {
      await navigator.share({
        title: "Ovelhas",
        text: "Acesse o app Ovelhas para discipulado e cuidado pastoral.",
        url: appUrl,
      });
      return;
    }

    await navigator.clipboard?.writeText(appUrl);
    toast.success("Link do app copiado.");
  }

  async function copyUrl() {
    await navigator.clipboard?.writeText(appUrl);
    toast.success("Link copiado.");
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <SectionHeader eyebrow="Mobile primeiro" title="Instalar aplicativo" />

        <section className="overflow-hidden rounded-lg bg-slate-950 text-white shadow-lg shadow-slate-900/10">
          <div className="bg-[radial-gradient(circle_at_top_left,#34d399_0,transparent_34%),linear-gradient(135deg,#0f172a,#064e3b)] p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/15">
              <Smartphone size={25} />
            </div>
            <h2 className="mt-5 text-3xl font-semibold leading-tight">Ovelhas no telefone, pronto para a rotina da igreja.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              Instale como PWA hoje e use a mesma base para empacotar Android e iOS com Capacitor.
            </p>
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-3">
          <button onClick={installPwa} className="rounded-lg bg-emerald-900 p-4 text-left text-white shadow-sm">
            <Download size={22} />
            <span className="mt-4 block font-bold">Instalar agora</span>
            <span className="mt-1 block text-sm leading-5 text-emerald-100">Adicionar na tela inicial do celular.</span>
          </button>
          <button onClick={enableNotifications} className="rounded-lg border border-white/80 bg-white/90 p-4 text-left shadow-sm">
            <BellRing size={22} className="text-amber-700" />
            <span className="mt-4 block font-bold text-slate-950">{notificationActive ? "Avisos ativos" : "Ativar avisos"}</span>
            <span className="mt-1 block text-sm leading-5 text-slate-500">
              {notificationsSupported() ? "Receber alertas urgentes no aparelho." : "Este navegador nao suporta avisos."}
            </span>
          </button>
          <button onClick={shareApp} className="rounded-lg border border-white/80 bg-white/90 p-4 text-left shadow-sm">
            <Share2 size={22} className="text-sky-700" />
            <span className="mt-4 block font-bold text-slate-950">Compartilhar app</span>
            <span className="mt-1 block text-sm leading-5 text-slate-500">Enviar o link para lideres e membros.</span>
          </button>
        </div>

        <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader eyebrow="Link oficial" title="Acesso publico" />
          <div className="break-all rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-700">{appUrl}</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={copyUrl} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-bold text-white">
              <Copy size={17} />
              Copiar
            </button>
            <a href={appUrl} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
              <ExternalLink size={17} />
              Abrir
            </a>
          </div>
        </section>

        <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader eyebrow="Nativo" title="Publicacao Android e iOS" />
          <div className="space-y-3">
            {[
              "Capacitor configurado com o appId com.saviocipriano.ovelhas.",
              "Android pode ser gerado com npm run native:add:android e aberto no Android Studio.",
              "iOS pode ser gerado em um Mac com npm run native:add:ios e aberto no Xcode.",
              "O app nativo carrega a producao https://ovelhas.vercel.app, mantendo atualizacoes rapidas pela Vercel.",
            ].map((item) => (
              <div key={item} className="flex gap-3 rounded-lg bg-slate-50 p-3">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-700" />
                <p className="text-sm leading-5 text-slate-600">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-amber-900">
            <Store size={18} className="shrink-0" />
            <p className="text-sm font-semibold">Para Play Store e App Store, ainda entram icones finais, prints, politica de privacidade e assinatura da loja.</p>
          </div>
        </section>
      </section>
    </AppShell>
  );
}
