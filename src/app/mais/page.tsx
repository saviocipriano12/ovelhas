"use client";

import Link from "next/link";
import {
  CalendarCheck,
  CalendarDays,
  Building2,
  ChartNoAxesCombined,
  Activity,
  Eye,
  Network,
  HeartHandshake,
  Heart,
  LayoutGrid,
  PlayCircle,
  ShieldCheck,
  Settings,
  LogIn,
  UserRound,
  Users,
  UserPlus,
  Bell,
  BookOpen,
  QrCode,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionHeader } from "@/components/section-header";
import { roleLabels } from "@/lib/data";

const menuItems: { href: string; title: string; description: string; icon: LucideIcon }[] = [
  { href: "/celulas", title: "Celulas", description: "Acompanhar lideres, bairros e frequencia.", icon: LayoutGrid },
  { href: "/pessoas", title: "Pessoas", description: "Membros, visitantes e novos cuidados.", icon: Users },
  { href: "/presenca", title: "Presenca", description: "Marcar celula e culto rapidamente.", icon: CalendarCheck },
  { href: "/checkin", title: "Check-in", description: "QR Code para presenca em celula e culto.", icon: QrCode },
  { href: "/agenda", title: "Agenda", description: "Lembretes, visitas, discipulados e aniversarios.", icon: CalendarDays },
  { href: "/cuidados", title: "Cuidados", description: "Fila de mensagens e acompanhamentos.", icon: HeartHandshake },
  { href: "/oracao", title: "Oracao", description: "Pedidos de oracao com privacidade por nivel.", icon: Heart },
  { href: "/biblioteca", title: "Biblioteca", description: "Materiais, devocionais e certificados.", icon: BookOpen },
  { href: "/notificacoes", title: "Notificacoes", description: "Alertas de ausencia, videos, relatorios e supervisao.", icon: Bell },
  { href: "/supervisao", title: "Supervisao", description: "Marcar visitas e acompanhar celulas da semana.", icon: Eye },
  { href: "/gestao", title: "Gestao", description: "Ver supervisores, lideres e lacunas de responsabilidade.", icon: Network },
  { href: "/atividades", title: "Atividades", description: "Ver o que lideres, supervisores e membros fizeram.", icon: Activity },
  { href: "/videos", title: "Videos", description: "Trilhas de discipulado e liberacoes.", icon: PlayCircle },
  { href: "/convites", title: "Convites", description: "Criar links de acesso para lideranca e membros.", icon: UserPlus },
  { href: "/relatorios", title: "Relatorios", description: "Indicadores para supervisor e pastor.", icon: ChartNoAxesCombined },
  { href: "/relatorios/novo", title: "Novo relatorio", description: "Registrar a ultima reuniao da celula.", icon: CalendarCheck },
  { href: "/meu-discipulado", title: "Meu discipulado", description: "Visao do membro no aplicativo.", icon: UserRound },
  { href: "/login", title: "Login", description: "Entrar ou criar conta real pelo Supabase.", icon: LogIn },
  { href: "/configuracao", title: "Configuracao inicial", description: "Criar igreja e preparar o primeiro administrador.", icon: Building2 },
  { href: "/configuracoes", title: "Configuracoes", description: "Marca, mensagens, LGPD, auditoria e backup.", icon: Settings },
  { href: "/acesso", title: "Acesso", description: "Testar administrador, pastor, supervisor, lider e membro.", icon: ShieldCheck },
];

export default function MorePage() {
  const { currentUser } = useAuth();

  return (
    <AppShell>
      <section className="animate-enter space-y-4">
        <SectionHeader eyebrow={roleLabels[currentUser.role]} title="Mais opcoes" />

        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-950">{currentUser.name}</p>
          <p className="mt-1 text-sm leading-5 text-emerald-800">
            Esta area concentra funcoes que nao precisam ficar fixas no rodape do celular.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {menuItems.map(({ href, title, description, icon: Icon }) => (
            <Link key={href} href={href} className="rounded-lg border border-white/80 bg-white/90 p-4 shadow-sm hover:border-emerald-200">
              <div className="flex gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                  <Icon size={20} />
                </span>
                <span>
                  <span className="block font-semibold text-slate-950">{title}</span>
                  <span className="mt-1 block text-sm leading-5 text-slate-500">{description}</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
