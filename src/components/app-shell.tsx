"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CalendarCheck,
  ChartNoAxesCombined,
  Activity,
  UserPlus,
  Network,
  LogIn,
  LogOut,
  Heart,
  HeartHandshake,
  Home,
  Eye,
  LayoutGrid,
  MoreHorizontal,
  QrCode,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { PwaStatus } from "@/components/pwa-status";
import { roleLabels } from "@/lib/data";
import { usePastoralNotifications } from "@/lib/use-pastoral-notifications";

const navItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/celulas", label: "Celulas", icon: LayoutGrid },
  { href: "/pessoas", label: "Pessoas", icon: Users },
  { href: "/presenca", label: "Presenca", icon: CalendarCheck },
  { href: "/checkin", label: "Check-in", icon: QrCode },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/cuidados", label: "Cuidados", icon: HeartHandshake },
  { href: "/oracao", label: "Oracao", icon: Heart },
  { href: "/biblioteca", label: "Biblioteca", icon: BookOpen },
  { href: "/notificacoes", label: "Alertas", icon: Bell },
  { href: "/supervisao", label: "Supervisao", icon: Eye },
  { href: "/gestao", label: "Gestao", icon: Network },
  { href: "/convites", label: "Convites", icon: UserPlus },
  { href: "/atividades", label: "Atividades", icon: Activity },
  { href: "/relatorios", label: "Relatorios", icon: ChartNoAxesCombined },
  { href: "/configuracoes", label: "Ajustes", icon: Settings },
];

const mobileNavItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/celulas", label: "Celulas", icon: LayoutGrid },
  { href: "/pessoas", label: "Pessoas", icon: Users },
  { href: "/cuidados", label: "Cuidados", icon: HeartHandshake },
  { href: "/mais", label: "Mais", icon: MoreHorizontal },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { currentUser, isDemoMode, signOut } = useAuth();
  const { unread } = usePastoralNotifications();

  return (
    <div className="min-h-screen bg-[#f7f8f3] text-slate-900">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,#d9f4e5_0,transparent_32%),radial-gradient(circle_at_top_right,#dbeafe_0,transparent_30%),linear-gradient(135deg,#f7f8f3_0%,#eef6f0_45%,#f8fafc_100%)]" />

      <aside className="fixed left-0 top-0 hidden h-screen w-72 border-r border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-xl lg:block">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-900 text-lg font-black text-white">
            O
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-950">Ovelhas</p>
            <p className="text-xs font-medium text-slate-500">by Savio Cipriano</p>
            <p className="text-xs font-medium text-emerald-700">{roleLabels[currentUser.role]}</p>
          </div>
        </Link>

        <nav className="mt-8 space-y-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold ${
                  active
                    ? "bg-emerald-900 text-white shadow-lg shadow-emerald-900/15"
                    : "text-slate-600 hover:bg-white hover:text-slate-950"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    active ? "bg-white/15" : "bg-emerald-50 text-emerald-800"
                  }`}
                >
                  <Icon size={17} strokeWidth={2.3} />
                </span>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-5 left-5 right-5 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-950">Culto de domingo</p>
          <p className="mt-1 text-xs text-emerald-800">17 pessoas da celula confirmadas</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100">
            <div className="h-full w-[74%] rounded-full bg-emerald-600" />
          </div>
          <p className="mt-3 text-[11px] font-bold uppercase text-emerald-700">Savio Cipriano</p>
        </div>
      </aside>

      <main className="mx-auto min-h-screen w-full max-w-7xl px-4 pb-28 pt-4 lg:pl-80 lg:pr-6">
        <header className="sticky top-3 z-30 mb-5 rounded-lg border border-white/70 bg-white/85 p-3 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-700">{roleLabels[currentUser.role]}</p>
              <h1 className="truncate text-xl font-semibold text-slate-950 sm:text-2xl">Bom te ver, {currentUser.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-white"
                aria-label="Buscar"
              >
                <Search size={19} />
              </button>
              <Link
                href="/notificacoes"
                className="relative flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-900 text-white shadow-sm"
                aria-label="Notificacoes"
              >
                <Bell size={19} />
                {unread.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-emerald-950 ring-2 ring-emerald-900">
                    {unread.length > 9 ? "9+" : unread.length}
                  </span>
                )}
              </Link>
              <Link
                href="/acesso"
                className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm"
                aria-label="Trocar acesso"
              >
                <ShieldCheck size={19} />
              </Link>
              {isDemoMode ? (
                <Link
                  href="/login"
                  className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-900 text-white shadow-sm"
                  aria-label="Entrar"
                >
                  <LogIn size={19} />
                </Link>
              ) : (
                <button
                  onClick={signOut}
                  className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-700 shadow-sm"
                  aria-label="Sair"
                >
                  <LogOut size={19} />
                </button>
              )}
              <Link
                href="/meu-discipulado"
                className="hidden h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white md:flex"
              >
                <UserRound size={17} />
                Membro
              </Link>
            </div>
          </div>
        </header>

        {children}
      </main>

      <PwaStatus />

      <nav className="fixed inset-x-3 bottom-3 z-40 rounded-[22px] border border-white/75 bg-white/90 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-2xl shadow-slate-900/10 backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobileNavItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold ${
                  active ? "bg-emerald-900 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <Icon size={20} strokeWidth={2.35} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
