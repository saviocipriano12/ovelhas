"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CalendarCheck,
  ClipboardList,
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
  Menu,
  MoreHorizontal,
  QrCode,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  UserRound,
  Users,
  Video,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { NotificationBridge } from "@/components/notification-bridge";
import { PwaStatus } from "@/components/pwa-status";
import { canAccessRoute, getDefaultRoute } from "@/lib/access-control";
import { roleLabels } from "@/lib/data";
import { usePastoralNotifications } from "@/lib/use-pastoral-notifications";

const navItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/celulas", label: "Celulas", icon: LayoutGrid },
  { href: "/pessoas", label: "Pessoas", icon: Users },
  { href: "/consolidacao", label: "Consolidacao", icon: ClipboardList },
  { href: "/presenca", label: "Presenca", icon: CalendarCheck },
  { href: "/checkin", label: "Check-in", icon: QrCode },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/cuidados", label: "Cuidados", icon: HeartHandshake },
  { href: "/oracao", label: "Oracao", icon: Heart },
  { href: "/biblioteca", label: "Biblioteca", icon: BookOpen },
  { href: "/videos", label: "Videos", icon: Video },
  { href: "/notificacoes", label: "Alertas", icon: Bell },
  { href: "/supervisao", label: "Supervisao", icon: Eye },
  { href: "/gestao", label: "Gestao", icon: Network },
  { href: "/convites", label: "Convites", icon: UserPlus },
  { href: "/atividades", label: "Atividades", icon: Activity },
  { href: "/relatorios", label: "Relatorios", icon: ChartNoAxesCombined },
  { href: "/configuracoes", label: "Ajustes", icon: Settings },
  { href: "/instalar", label: "Instalar", icon: Smartphone },
];

const navGroups = [
  {
    label: "Cuidado",
    hrefs: ["/dashboard", "/celulas", "/pessoas", "/consolidacao", "/presenca", "/checkin", "/agenda", "/cuidados"],
  },
  {
    label: "Discipulado",
    hrefs: ["/oracao", "/biblioteca", "/notificacoes", "/videos"],
  },
  {
    label: "Lideranca",
    hrefs: ["/supervisao", "/gestao", "/convites", "/atividades", "/relatorios"],
  },
  {
    label: "Sistema",
    hrefs: ["/configuracoes", "/instalar"],
  },
];

const mobileNavItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/presenca", label: "Presenca", icon: CalendarCheck },
  { href: "/pessoas", label: "Pessoas", icon: Users },
  { href: "/consolidacao", label: "Culto", icon: ClipboardList },
  { href: "/mais", label: "Mais", icon: MoreHorizontal },
];

const memberMobileNavItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/meu-discipulado", label: "Meu", icon: UserRound },
  { href: "/oracao", label: "Oracao", icon: Heart },
  { href: "/biblioteca", label: "Biblia", icon: BookOpen },
  { href: "/notificacoes", label: "Alertas", icon: Bell },
  { href: "/mais", label: "Mais", icon: MoreHorizontal },
];

function isActive(pathname: string, href: string) {
  if (href === "/celulas") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function pageLabel(pathname: string) {
  const item = navItems.find((navItem) => isActive(pathname, navItem.href));
  return item?.label ?? "Ovelhas";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { currentUser, isDemoMode, signOut } = useAuth();
  const { unread } = usePastoralNotifications();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const visibleNavItems = navItems.filter((item) => canAccessRoute(currentUser, item.href));
  const groupedNavItems = navGroups
    .map((group) => ({
      ...group,
      items: visibleNavItems.filter((item) => group.hrefs.includes(item.href)),
    }))
    .filter((group) => group.items.length > 0);
  const visibleMobileNavItems = (currentUser.role === "member" ? memberMobileNavItems : mobileNavItems).filter((item) =>
    canAccessRoute(currentUser, item.href),
  );
  const homeHref = getDefaultRoute(currentUser);
  const currentPageLabel = pageLabel(pathname);

  return (
    <div className="min-h-screen bg-[#f7f8f3] text-slate-900">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,#d9f4e5_0,transparent_32%),radial-gradient(circle_at_top_right,#dbeafe_0,transparent_30%),linear-gradient(135deg,#f7f8f3_0%,#eef6f0_45%,#f8fafc_100%)]" />

      <aside className="fixed left-0 top-0 hidden h-screen w-72 border-r border-white/70 bg-white/75 shadow-sm backdrop-blur-xl lg:flex lg:flex-col">
        <div className="shrink-0 p-5 pb-3">
          <Link href={homeHref} className="flex items-center gap-3 rounded-2xl p-1 hover:bg-white/60">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-900 text-lg font-black text-white shadow-lg shadow-emerald-900/15">
              O
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold leading-tight text-slate-950">Ovelhas</p>
              <p className="text-xs font-medium text-slate-500">by Savio Cipriano</p>
              <p className="text-xs font-bold text-emerald-700">{roleLabels[currentUser.role]}</p>
            </div>
          </Link>
        </div>

        <nav className="app-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4">
          {groupedNavItems.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-wide text-slate-400">
                {group.label}
              </p>
              <div className="space-y-1.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold ${
                        active
                          ? "bg-emerald-900 text-white shadow-lg shadow-emerald-900/15"
                          : "text-slate-600 hover:bg-white hover:text-slate-950"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                          active ? "bg-white/15" : "bg-emerald-50 text-emerald-800"
                        }`}
                      >
                        <Icon size={17} strokeWidth={2.3} />
                      </span>
                      <span className="truncate">{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 p-4 pt-2">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/75 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950">{currentUser.name}</p>
              <p className="text-xs font-semibold text-emerald-700">{isDemoMode ? "Modo demo" : "Acesso real"}</p>
            </div>
            {isDemoMode ? (
              <Link href="/login" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-900 text-white">
                <LogIn size={17} />
              </Link>
            ) : (
              <button onClick={signOut} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                <LogOut size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="native-scroll min-h-screen w-full px-3 pb-[calc(7.8rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] lg:ml-72 lg:w-[calc(100%-18rem)] lg:px-8 lg:pb-10 lg:pt-4 xl:px-10">
        <header className="sticky top-[calc(0.6rem+env(safe-area-inset-top))] z-30 mb-4 lg:hidden">
          <div className="relative overflow-hidden rounded-[26px] border border-white/70 bg-slate-950/90 p-2.5 text-white shadow-2xl shadow-slate-900/15 backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,#34d39955_0,transparent_38%),linear-gradient(135deg,#02061700,#064e3b55)]" />
            <div className="relative flex items-center justify-between gap-3">
              <Link href={homeHref} className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-black text-emerald-950">
                  O
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-black uppercase text-emerald-200">
                    {roleLabels[currentUser.role]}
                  </span>
                  <span className="block truncate text-[15px] font-semibold leading-tight">{currentUser.name}</span>
                  <span className="block truncate text-xs font-semibold text-slate-300">{currentPageLabel}</span>
                </span>
              </Link>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href="/notificacoes"
                  className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white"
                  aria-label="Notificacoes"
                >
                  <Bell size={19} />
                  {unread.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-300 px-1 text-[10px] font-black text-slate-950 ring-2 ring-slate-950">
                      {unread.length > 9 ? "9+" : unread.length}
                    </span>
                  )}
                </Link>
                <button
                  onClick={() => setMobileMenuOpen((current) => !current)}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-950/20"
                  aria-label="Menu"
                >
                  {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>
          </div>
        </header>

        <header className="sticky top-3 z-30 mb-5 hidden rounded-lg border border-white/70 bg-white/85 p-3 shadow-sm backdrop-blur-xl lg:block">
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
                className="hidden h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm"
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
                className={`h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white ${currentUser.role === "member" && canAccessRoute(currentUser, "/meu-discipulado") ? "hidden md:flex" : "hidden"}`}
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
      <NotificationBridge />

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Fechar menu"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 h-full w-full bg-slate-950/35 backdrop-blur-sm"
          />
          <section className="native-scroll absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-[32px] bg-[#f7f8f3] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl shadow-slate-950/30">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300" />
            <div className="mb-4 flex items-center justify-between gap-3 rounded-[24px] bg-slate-950 p-3 text-white">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase text-emerald-200">{roleLabels[currentUser.role]}</p>
                <p className="truncate text-lg font-semibold">{currentUser.name}</p>
                <p className="text-xs font-semibold text-slate-300">{isDemoMode ? "Modo demo" : "Acesso real"}</p>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white"
                aria-label="Fechar menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-4">
              {groupedNavItems.map((group) => (
                <div key={group.label} className="rounded-[24px] bg-white/90 p-3 shadow-sm">
                  <p className="mb-2 px-1 text-[11px] font-black uppercase text-slate-400">{group.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map(({ href, label, icon: Icon }) => {
                      const active = isActive(pathname, href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex min-h-14 items-center gap-2 rounded-2xl px-3 text-sm font-bold ${
                            active ? "bg-emerald-900 text-white" : "bg-slate-50 text-slate-700"
                          }`}
                        >
                          <Icon size={18} />
                          <span className="min-w-0 truncate">{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-2">
                {isDemoMode ? (
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-900 px-3 text-sm font-bold text-white"
                  >
                    <LogIn size={17} />
                    Entrar
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      signOut();
                    }}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-3 text-sm font-bold text-white"
                  >
                    <LogOut size={17} />
                    Sair
                  </button>
                )}
                <Link
                  href="/instalar"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-sm font-bold text-slate-800 shadow-sm"
                >
                  <Smartphone size={17} />
                  Instalar
                </Link>
              </div>
            </div>
          </section>
        </div>
      )}

      <nav className="fixed inset-x-3 bottom-[calc(0.65rem+env(safe-area-inset-bottom))] z-40 rounded-[26px] border border-white/75 bg-white/90 p-1.5 shadow-2xl shadow-slate-900/10 backdrop-blur-2xl lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {visibleMobileNavItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[20px] text-[10.5px] font-black ${
                  active ? "bg-emerald-900 text-white shadow-lg shadow-emerald-900/20" : "text-slate-500 hover:bg-slate-100"
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
