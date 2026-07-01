import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ShieldCheck,
  Users,
} from "lucide-react";

export const metadata = {
  title: "Ovelhas | Plataforma de cuidado pastoral para igrejas e células",
  description:
    "Ovelhas ajuda pastores, líderes e igrejas a cuidar de pessoas, monitorar presença, disciplinar e apoiar células com dados e notificações.",
};

const featureItems = [
  {
    icon: ShieldCheck,
    title: "Segurança e permissões",
    description: "Controle de acesso por pastor, supervisor, líder e membro, garantindo que cada pessoa veja o que deve ver.",
  },
  {
    icon: Users,
    title: "Gestão de células",
    description: "Organize células, líderes e supervisores com mapas, contatos e relatórios em um só lugar.",
  },
  {
    icon: CalendarCheck,
    title: "Presença e eventos",
    description: "Registre presenças, agendas e check-ins com facilidade para reuniões, cultos e atividades.",
  },
  {
    icon: BookOpen,
    title: "Discipulado e cuidado",
    description: "Acompanhe cuidados, orações, avisos e histórico de decisões em um fluxo simples e intuitivo.",
  },
];

const plans = [
  {
    name: "Início",
    price: "Gratuito",
    description: "Teste o Ovelhas com recursos básicos e libere a visão da sua igreja.",
    features: ["Gestão de líderes e membros", "Relatórios essenciais", "Acesso para 1 igreja"],
    badge: "Ideal para começar",
  },
  {
    name: "Crescimento",
    price: "R$ 79/mês",
    description: "Escale o cuidado com mais automações para supervisores e lideranças.",
    features: ["Ações pastorais avançadas", "Alertas e notificações", "Múltiplas células"],
    badge: "Mais usado",
    featured: true,
  },
  {
    name: "Igreja completa",
    price: "R$ 149/mês",
    description: "Tudo que a sua comunidade precisa para crescer, monitorar e discipular em escala.",
    features: ["Relatórios avançados", "Planejamento de culto e equipe", "Suporte prioritário"],
    badge: "Em breve",
  },
];

function AppMockup() {
  return (
    <div className="relative overflow-hidden rounded-[36px] border border-slate-200 bg-white/90 p-6 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.35)] sm:p-8">
      <div className="absolute -left-10 top-6 h-16 w-16 rounded-full bg-emerald-100 blur-3xl" />
      <div className="absolute right-6 top-8 h-7 w-7 rounded-full bg-sky-100 blur-2xl" />
      <div className="relative mx-auto h-[520px] max-w-[320px] overflow-hidden rounded-[32px] border border-slate-200 bg-slate-950 shadow-lg">
        <div className="h-12 bg-gradient-to-r from-emerald-700 via-sky-700 to-violet-700" />
        <div className="px-5 py-4 text-white">
          <div className="mb-4 flex items-center justify-between">
            <span className="inline-flex h-9 items-center rounded-full bg-white/10 px-3 text-xs font-semibold uppercase tracking-[0.17em] text-slate-100/90">Ovelhas</span>
            <span className="text-[11px] uppercase tracking-[0.3em] text-slate-300/80">beta</span>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-300">Agenda do culto</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[22px] bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Reunião da liderança</p>
                <p className="mt-2 text-sm font-semibold text-white">Segunda, 20h</p>
              </div>
              <div className="rounded-[22px] bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Presença</p>
                <p className="mt-2 text-sm font-semibold text-white">45 / 54 presentes</p>
              </div>
            </div>
          </div>
          <div className="mt-6 grid gap-3">
            <div className="rounded-[28px] bg-emerald-600/15 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-100">Cuidado</p>
              <p className="mt-2 text-sm font-semibold text-white">5 pessoas com atenção agendada</p>
            </div>
            <div className="rounded-[28px] bg-slate-900/80 p-4 text-slate-200">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Última nota</p>
              <p className="mt-2 text-sm">&quot;Encontrar Maria após culto para oração e visita&quot;</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="bg-[#f7f8f3] text-slate-950">
      <div className="relative overflow-hidden pt-10 pb-16 sm:pt-14 sm:pb-20 lg:pb-24">
        <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top,_#d9f4e5_0,_transparent_45%)] blur-3xl" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:gap-20">
            <div className="max-w-2xl">
              <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">
                Ovelhas</span>
              <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Uma plataforma pública para cuidar de pessoas, células e lideranças.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg">
                Organize sua igreja com controle de presença, acompanhamento pastoral, disciplinado e notificações inteligentes. Um espaço seguro para líderes e membros acompanharem a vida da comunidade.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full bg-emerald-900 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-800"
                >
                  Acessar demonstração
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="#plans"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-7 py-3 text-sm font-semibold text-slate-950 hover:border-slate-400"
                >
                  Ver planos
                </Link>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3 text-emerald-700">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="font-semibold">Acesso rápido para igrejas</p>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">Acesse a plataforma pública sem precisar de convite para conhecer o app.</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3 text-sky-700">
                    <Activity className="h-5 w-5" />
                    <p className="font-semibold">Planejamento de pagamentos</p>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">Estamos preparando a integração com Stripe para receber doações e assinaturas.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <AppMockup />
            </div>
          </div>
        </div>
      </div>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-3xl gap-6 text-center lg:max-w-none lg:grid-cols-4 lg:text-left">
            {featureItems.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-900 text-white shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-950">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="plans" className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Planos</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Planos pensados para sua igreja crescer com segurança.
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-600">
              Em breve vamos liberar pagamentos com Stripe para você assinar e ativar recursos avançados direto na plataforma.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-[32px] border p-8 shadow-sm ${plan.featured ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200 bg-white"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">{plan.name}</p>
                    <p className="mt-4 text-3xl font-black tracking-tight text-slate-950">{plan.price}</p>
                  </div>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-white">
                    {plan.badge}
                  </span>
                </div>
                <p className="mt-6 text-sm leading-6 text-slate-600">{plan.description}</p>
                <ul className="mt-8 space-y-4 text-sm leading-6 text-slate-700">
                  {plan.features.map((featureText) => (
                    <li key={featureText} className="flex items-start gap-3">
                      <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-900 text-white">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </span>
                      <span>{featureText}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center rounded-full bg-emerald-900 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Em breve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-700">Próximos passos</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Preparando o app para pagamentos Stripe e acesso público.
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600">
                Assim que a integração estiver pronta, você poderá converter visitantes em assinantes, aceitar doações e gerenciar planos diretamente pela plataforma.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl bg-white p-6 shadow-sm">
                  <p className="font-semibold text-slate-950">Configuração Stripe</p>
                  <p className="mt-3 text-sm text-slate-600">Adicione sua conta Stripe e habilite pagamentos recorrentes de forma segura.</p>
                </div>
                <div className="rounded-3xl bg-white p-6 shadow-sm">
                  <p className="font-semibold text-slate-950">Planos personalizados</p>
                  <p className="mt-3 text-sm text-slate-600">Defina níveis de serviço para liderança, coordenação e toda a igreja.</p>
                </div>
              </div>
            </div>
            <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">O que o app já oferece</p>
              <ul className="mt-8 space-y-4 text-sm leading-7 text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-900 text-white">✓</span>
                  Dados de presença, supervisão e cuidado em tempo real.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-900 text-white">✓</span>
                  Painéis com métricas para líderes e pastores.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-900 text-white">✓</span>
                  Comunicação entre membros, orações e avisos.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
