"use client";

import Link from "next/link";
import {
  CalendarCheck,
  ClipboardList,
  CalendarDays,
  Building2,
  ChartNoAxesCombined,
  Activity,
  CreditCard,
  Eye,
  Network,
  HeartHandshake,
  Heart,
  LayoutGrid,
  MapPin,
  PlayCircle,
  Settings,
  LogIn,
  UserRound,
  Users,
  UserPlus,
  Bell,
  BookOpen,
  QrCode,
  Smartphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionHeader } from "@/components/section-header";
import { canAccessRoute } from "@/lib/access-control";
import { roleLabels } from "@/lib/data";

const menuItems: { href: string; title: string; description: string; icon: LucideIcon }[] = [
  { href: "/celulas", title: "Celulas", description: "Acompanhar lideres, bairros e frequencia.", icon: LayoutGrid },
  { href: "/perfil", title: "Perfil", description: "Atualizar seus dados pessoais e foto no app.", icon: UserRound },
  { href: "/pessoas", title: "Pessoas", description: "Membros, visitantes e novos cuidados.", icon: Users },
  { href: "/consolidacao", title: "Consolidacao", description: "Cultos, visitantes, decisoes e encaminhamento para celulas.", icon: ClipboardList },
  { href: "/presenca", title: "Presenca", description: "Preparar, marcar presenca e fechar o relatorio da celula.", icon: CalendarCheck },
  { href: "/checkin", title: "Check-in", description: "QR Code para presenca em celula e culto.", icon: QrCode },
  { href: "/agenda", title: "Agenda", description: "Lembretes, visitas, discipulados e aniversarios.", icon: CalendarDays },
  { href: "/cuidados", title: "Cuidados", description: "Fila de mensagens e acompanhamentos.", icon: HeartHandshake },
  { href: "/lar-de-paz", title: "Lar de Paz", description: "Casas e duplas do Lar de Paz, vinculadas por celula.", icon: MapPin },
  { href: "/oracao", title: "Oracao", description: "Pedidos de oracao com privacidade por nivel.", icon: Heart },
  { href: "/biblioteca", title: "Biblioteca", description: "Materiais, devocionais e certificados.", icon: BookOpen },
  { href: "/notificacoes", title: "Notificacoes", description: "Alertas de ausencia, videos, relatorios e supervisao.", icon: Bell },
  { href: "/instalar", title: "Instalar app", description: "PWA, notificacoes e preparo para Android/iOS.", icon: Smartphone },
  { href: "/supervisao", title: "Supervisao", description: "Marcar visitas e acompanhar celulas da semana.", icon: Eye },
  { href: "/gestao", title: "Gestao", description: "Ver supervisores, lideres e lacunas de responsabilidade.", icon: Network },
  { href: "/atividades", title: "Atividades", description: "Ver o que lideres, supervisores e membros fizeram.", icon: Activity },
  { href: "/videos", title: "Videos", description: "Trilhas de discipulado e liberacoes.", icon: PlayCircle },
  { href: "/convites", title: "Convites", description: "Criar links de acesso para lideranca e membros.", icon: UserPlus },
  { href: "/relatorios", title: "Relatorios", description: "Indicadores para supervisor e pastor.", icon: ChartNoAxesCombined },
  { href: "/relatorios/novo", title: "Novo relatorio", description: "Registrar a ultima reuniao da celula.", icon: CalendarCheck },
  { href: "/meu-discipulado", title: "Meu discipulado", description: "Visao do membro no aplicativo.", icon: UserRound },
  { href: "/login", title: "Login", description: "Entrar ou criar conta real pelo Supabase.", icon: LogIn },
  { href: "/configuracao", title: "Bootstrap do primeiro acesso", description: "Uso unico: criar a igreja e o primeiro administrador. Nao e a tela de ajustes.", icon: Building2 },
  { href: "/configuracoes", title: "Configuracoes", description: "Marca, mensagens, LGPD, auditoria e backup.", icon: Settings },
  { href: "/assinatura", title: "Assinatura", description: "Plano da igreja, uso e pagamento.", icon: CreditCard },
  { href: "/plataforma", title: "Plataforma", description: "Admin geral: igrejas, financeiro, suporte e auditoria.", icon: Building2 },
];

export default function MorePage() {
  const { currentUser } = useAuth();
  const visibleMenuItems = menuItems.filter((item) => item.href !== "/login" && canAccessRoute(currentUser, item.href));

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
          {visibleMenuItems.map(({ href, title, description, icon: Icon }) => (
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
