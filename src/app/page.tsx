import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  HeartHandshake,
  Layers3,
  LockKeyhole,
  MapPinned,
  MessageCircle,
  Network,
  PlayCircle,
  QrCode,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { getSupportWhatsAppLink } from "@/lib/subscription-plans";

export const metadata = {
  title: "Ovelhas | Plataforma de cuidado pastoral para igrejas e células",
  description:
    "Ovelhas ajuda pastores, líderes e igrejas a cuidar de pessoas, monitorar presença, disciplinar e apoiar células com dados e notificações.",
};

const painPoints = [
  "Lideres usando planilhas diferentes",
  "Pessoas ausentes sem acompanhamento",
  "Relatorios chegando atrasados ou incompletos",
  "Pedidos de oracao perdidos no WhatsApp",
  "Discipulado sem progresso visivel",
  "Pastores sem clareza do que acontece nas celulas",
];

const modules = [
  {
    icon: BarChart3,
    title: "Dashboard pastoral",
    text: "Veja celulas, pessoas, presencas, cuidados pendentes e comunicados em uma central simples para decisao.",
  },
  {
    icon: Network,
    title: "Gestao de celulas",
    text: "Organize lideres, supervisores, horarios, enderecos, bairros e indicadores de cada celula.",
  },
  {
    icon: UsersRound,
    title: "Pessoas e historico",
    text: "Acompanhe membros, visitantes, vinculo com celula, lideranca, presenca e etapa da jornada.",
  },
  {
    icon: QrCode,
    title: "Presenca e check-in",
    text: "Registre chamada, compartilhe links, use QR Code e transforme presenca em informacao pastoral.",
  },
  {
    icon: HeartHandshake,
    title: "Cuidado pastoral",
    text: "Crie tarefas de visita, conversa, oracao, discipulado e suporte para ninguem ficar sem cuidado.",
  },
  {
    icon: BookOpenCheck,
    title: "Discipulado em video",
    text: "Monte trilhas, libere conteudos por pessoa, acompanhe progresso e emita certificados de conclusao.",
  },
];

const roles = [
  {
    title: "Pastor e administrador",
    text: "Enxerga a igreja inteira, acompanha indicadores, configura a igreja e toma decisoes com dados reais.",
  },
  {
    title: "Supervisor",
    text: "Acompanha as celulas sob sua cobertura, identifica lacunas e ajuda lideres com prestacao de contas.",
  },
  {
    title: "Lider de celula",
    text: "Marca presenca, cadastra pessoas, envia relatorios, libera discipulado e cuida de quem precisa de atencao.",
  },
  {
    title: "Membro",
    text: "Acessa seu proprio painel, ve discipulado liberado, pedidos de oracao, avisos e seu acompanhamento.",
  },
];

const flow = [
  "A igreja configura sua estrutura",
  "Pastores criam celulas e liderancas",
  "Lideres registram presenca e relatorios",
  "Supervisores acompanham lacunas",
  "O cuidado pastoral vira rotina visivel",
];

const metrics = [
  { value: "5", label: "perfis de acesso" },
  { value: "1", label: "plataforma para igreja e celulas" },
  { value: "24h", label: "visao pastoral sempre disponivel" },
  { value: "PWA", label: "instalavel no celular" },
];

const plans = [
  {
    label: "Pequena",
    range: "Ate 300 pessoas cadastradas",
    price: "R$ 59,90",
    highlighted: false,
    features: ["Celulas e pessoas ilimitadas", "Presenca, discipulado e cuidados", "Relatorios e tendencias"],
  },
  {
    label: "Media",
    range: "Ate 800 pessoas cadastradas",
    price: "R$ 89,90",
    highlighted: true,
    features: ["Tudo do plano Pequena", "Suporte prioritario", "Ideal para igrejas em crescimento"],
  },
  {
    label: "Grande",
    range: "Acima de 800 pessoas",
    price: "R$ 129,90",
    highlighted: false,
    features: ["Tudo do plano Media", "Estrutura para multiplas redes de celulas", "Acompanhamento dedicado"],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8f3] text-slate-950">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,#bbf7d0_0,transparent_34%),radial-gradient(circle_at_top_right,#d1fae5_0,transparent_30%),linear-gradient(135deg,#f7f8f3_0%,#edf7ef_46%,#f8fafc_100%)]" />

      <header className="sticky top-0 z-40 border-b border-white/70 bg-[#f7f8f3]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-950 text-xl shadow-lg shadow-emerald-950/20">
              <span aria-hidden>🐑</span>
            </div>
            <div>
              <p className="text-lg font-black tracking-tight">Ovelhas</p>
              <p className="text-xs font-bold text-emerald-800">Cuidado pastoral inteligente</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-600 md:flex">
            <a href="#modulos" className="hover:text-emerald-900">Modulos</a>
            <a href="#celulas" className="hover:text-emerald-900">Celulas</a>
            <a href="#acesso" className="hover:text-emerald-900">Acessos</a>
            <a href="#planos" className="hover:text-emerald-900">Planos</a>
            <a href="#contato" className="hover:text-emerald-900">Contato</a>
          </nav>

          <Link
            href="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-emerald-950 px-5 text-sm font-black text-white shadow-lg shadow-emerald-950/15 transition hover:-translate-y-0.5 hover:bg-emerald-900"
          >
            Entrar
          </Link>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28 lg:pt-20">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white/70 px-4 py-2 text-sm font-black text-emerald-900 shadow-sm backdrop-blur">
            <Sparkles size={16} />
            Para igrejas em celulas que querem cuidar melhor de pessoas
          </div>

          <h1 className="mt-8 max-w-4xl text-5xl font-black tracking-[-0.06em] text-slate-950 sm:text-6xl lg:text-7xl">
            Sua igreja cuidando de cada pessoa com clareza, rotina e dados reais.
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
            Ovelhas reune celulas, presenca, discipulado, pedidos de oracao, cuidados pastorais, convites e relatorios em uma unica plataforma mobile-first para a lideranca da igreja.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href="#planos"
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-950 px-7 text-base font-black text-white shadow-xl shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:bg-emerald-900"
            >
              Ver planos e comecar
              <ArrowRight size={19} />
            </a>
            <Link
              href="/login"
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-7 text-base font-black text-slate-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
            >
              Ja tenho acesso
            </Link>
          </div>

          <div className="mt-8 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-3xl border border-white/80 bg-white/70 p-4 shadow-sm backdrop-blur">
                <p className="text-2xl font-black text-emerald-950">{metric.value}</p>
                <p className="mt-1 text-xs font-bold leading-4 text-slate-500">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-8 -top-8 h-36 w-36 rounded-full bg-emerald-300/30 blur-3xl" />
          <div className="absolute -bottom-10 -right-8 h-44 w-44 rounded-full bg-lime-200/50 blur-3xl" />

          <div className="relative mx-auto max-w-md rounded-[2.4rem] border border-white/80 bg-white/80 p-3 shadow-2xl shadow-emerald-950/10 backdrop-blur-xl">
            <div className="rounded-[2rem] bg-emerald-950 p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-emerald-100">Dashboard pastoral</p>
                  <p className="mt-1 text-2xl font-black">Igreja em cuidado</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl">🐑</div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-3xl bg-white/10 p-4">
                  <p className="text-3xl font-black">18</p>
                  <p className="mt-1 text-xs font-bold text-emerald-100">celulas ativas</p>
                </div>
                <div className="rounded-3xl bg-white/10 p-4">
                  <p className="text-3xl font-black">326</p>
                  <p className="mt-1 text-xs font-bold text-emerald-100">pessoas acompanhadas</p>
                </div>
                <div className="rounded-3xl bg-white/10 p-4">
                  <p className="text-3xl font-black">42</p>
                  <p className="mt-1 text-xs font-bold text-emerald-100">cuidados pendentes</p>
                </div>
                <div className="rounded-3xl bg-white/10 p-4">
                  <p className="text-3xl font-black">87%</p>
                  <p className="mt-1 text-xs font-bold text-emerald-100">presenca media</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-4">
              {[
                ["Ana faltou 2 encontros", "Criar cuidado pastoral", "Alta"],
                ["Celula Jardim Europa", "Relatorio enviado", "Hoje"],
                ["Trilha Nova Vida", "12 membros em progresso", "Discipulado"],
              ].map(([title, text, tag]) => (
                <div key={title} className="flex items-center justify-between gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div>
                    <p className="text-sm font-black text-slate-900">{title}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{text}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-800">{tag}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-emerald-950 py-16 text-white sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald-200">O problema</p>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              Quando a igreja cresce, o cuidado nao pode depender da memoria.
            </h2>
            <p className="mt-5 text-lg leading-8 text-emerald-50/80">
              Igrejas em celulas precisam enxergar pessoas, lideres, presencas, ausencias e discipulado sem depender de mensagens soltas ou relatorios esquecidos.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {painPoints.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <CheckCircle2 className="shrink-0 text-emerald-200" size={20} />
                <p className="text-sm font-bold text-white/90">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="modulos" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald-800">A plataforma</p>
          <h2 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-5xl">
            Tudo que a lideranca precisa para cuidar, acompanhar e discipular.
          </h2>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modules.map(({ icon: Icon, title, text }) => (
            <div key={title} className="group rounded-[2rem] border border-white/80 bg-white/75 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-950 text-white shadow-lg shadow-emerald-950/15">
                <Icon size={22} />
              </div>
              <h3 className="mt-6 text-xl font-black tracking-tight">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="celulas" className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:pb-28">
        <div className="overflow-hidden rounded-[2.4rem] bg-slate-950 text-white shadow-2xl shadow-slate-950/15">
          <div className="grid gap-0 lg:grid-cols-2">
            <div className="p-8 sm:p-12 lg:p-14">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald-300">Igrejas em celulas</p>
              <h2 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-5xl">
                Do encontro na casa ao relatorio pastoral, tudo fica conectado.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                Ovelhas ajuda a igreja a saber quem esta presente, quem sumiu, qual lider precisa de apoio, qual celula esta sem cobertura e quais pessoas precisam de discipulado ou cuidado.
              </p>

              <div className="mt-8 space-y-4">
                {flow.map((item, index) => (
                  <div key={item} className="flex gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 text-sm font-black text-emerald-950">
                      {index + 1}
                    </div>
                    <p className="pt-1 text-base font-bold text-white/90">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 text-slate-950 sm:p-8 lg:p-10">
              <div className="rounded-[2rem] border border-slate-100 bg-[#f7f8f3] p-5 shadow-inner">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-emerald-800">Matriz pastoral</p>
                    <h3 className="mt-1 text-2xl font-black">Cobertura das celulas</h3>
                  </div>
                  <Layers3 className="text-emerald-900" />
                </div>

                <div className="mt-6 space-y-3">
                  {[
                    ["Supervisor Marcos", "6 celulas", "Visita em dia"],
                    ["Lider Camila", "14 pessoas", "2 cuidados abertos"],
                    ["Celula Vila Nova", "Quinta, 20h", "Relatorio pendente"],
                    ["Visitantes do culto", "8 contatos", "Consolidacao ativa"],
                  ].map(([name, detail, status]) => (
                    <div key={name} className="rounded-3xl bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-black">{name}</p>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">{detail}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-emerald-800">{status}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="acesso" className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:pb-28">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald-800">Acesso por funcao</p>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-5xl">
              Cada pessoa ve somente o que precisa para servir melhor.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Ovelhas foi pensado para proteger informacoes da igreja e dar foco para cada perfil: pastor, supervisor, lider e membro.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {roles.map((role) => (
              <div key={role.title} className="rounded-[2rem] border border-white/80 bg-white/75 p-6 shadow-sm backdrop-blur">
                <ShieldCheck className="text-emerald-900" size={24} />
                <h3 className="mt-5 text-lg font-black">{role.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{role.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="planos" className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:pb-28">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald-800">Planos</p>
          <h2 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-5xl">
            Um plano para cada tamanho de igreja.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            14 dias de teste gratis em qualquer plano. Cobranca mensal recorrente no cartao, cancele quando quiser.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.label}
              className={`flex flex-col rounded-[2rem] border p-7 shadow-sm backdrop-blur ${
                plan.highlighted
                  ? "border-emerald-900 bg-emerald-950 text-white shadow-xl shadow-emerald-950/20"
                  : "border-white/80 bg-white/75"
              }`}
            >
              {plan.highlighted ? (
                <span className="inline-flex w-fit rounded-full bg-emerald-400 px-3 py-1 text-[11px] font-black text-emerald-950">
                  Mais escolhido
                </span>
              ) : (
                <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-800">
                  Plano
                </span>
              )}
              <h3 className={`mt-4 text-xl font-black ${plan.highlighted ? "text-white" : "text-slate-950"}`}>{plan.label}</h3>
              <p className={`mt-2 text-sm font-bold ${plan.highlighted ? "text-emerald-200" : "text-slate-500"}`}>{plan.range}</p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black">{plan.price}</span>
                <span className={`text-sm font-bold ${plan.highlighted ? "text-emerald-200" : "text-slate-500"}`}>/mes</span>
              </p>
              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm font-semibold">
                    <CheckCircle2 size={16} className={plan.highlighted ? "text-emerald-300" : "text-emerald-700"} />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className={`mt-7 flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black transition ${
                  plan.highlighted ? "bg-white text-emerald-950 hover:bg-emerald-50" : "bg-emerald-950 text-white hover:bg-emerald-900"
                }`}
              >
                Comecar teste gratis
                <ClipboardCheck size={16} />
              </Link>
            </div>
          ))}

          <div className="flex flex-col rounded-[2rem] border border-white/80 bg-white/75 p-7 shadow-sm backdrop-blur">
            <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-800">
              Plano
            </span>
            <h3 className="mt-4 text-xl font-black text-slate-950">Personalizado</h3>
            <p className="mt-2 text-sm font-bold text-slate-500">Multiplas sedes ou necessidades especiais</p>
            <p className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-black">Sob consulta</span>
            </p>
            <ul className="mt-6 space-y-3">
              {["Tudo do plano Grande", "Onboarding assistido", "Condicoes negociadas com o suporte"].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 size={16} className="text-emerald-700" />
                  {feature}
                </li>
              ))}
            </ul>
            <a
              href={getSupportWhatsAppLink("Ola! Quero saber mais sobre o plano personalizado do Ovelhas.")}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-950 px-5 text-sm font-black text-white transition hover:bg-emerald-900"
            >
              Falar com suporte
              <MessageCircle size={16} />
            </a>
          </div>
        </div>
      </section>

      <section className="border-y border-white/80 bg-white/55 py-16 backdrop-blur sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 sm:px-8 md:grid-cols-3">
          {[
            { icon: LockKeyhole, title: "Multi-igreja", text: "Dados separados por igreja, com estrutura preparada para crescer como SaaS." },
            { icon: BellRing, title: "Comunicacao ativa", text: "Avisos, notificacoes e mensagens segmentadas para lideranca, celulas ou igreja." },
            { icon: MapPinned, title: "Mobile-first", text: "Feito para lideres em campo, instalado como PWA no celular e pronto para evoluir para app nativo." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-[2rem] p-6">
              <Icon className="text-emerald-900" size={28} />
              <h3 className="mt-5 text-xl font-black">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="contato" className="mx-auto max-w-5xl px-5 py-20 text-center sm:px-8 lg:py-28">
        <div className="rounded-[2.6rem] bg-emerald-950 px-6 py-12 text-white shadow-2xl shadow-emerald-950/20 sm:px-12 sm:py-16">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10 text-3xl">🐑</div>
          <h2 className="mx-auto mt-7 max-w-3xl text-4xl font-black tracking-[-0.05em] sm:text-5xl">
            Pronto para mostrar o potencial do Ovelhas para sua igreja?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-emerald-50/80">
            Leve para sua lideranca uma plataforma feita para acompanhar pessoas, fortalecer celulas e transformar cuidado pastoral em rotina organizada.
          </p>

          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="mailto:suporte.altum@gmail.com?subject=Quero%20conhecer%20o%20Ovelhas"
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white px-7 text-base font-black text-emerald-950 shadow-lg shadow-black/10 transition hover:-translate-y-0.5"
            >
              Solicitar apresentacao
              <UserCheck size={19} />
            </a>
            <Link
              href="/login"
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-7 text-base font-black text-white transition hover:-translate-y-0.5 hover:bg-white/15"
            >
              Acessar minha conta
              <PlayCircle size={19} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/80 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Ovelhas. Plataforma de cuidado pastoral.</p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-emerald-900">Login</Link>
            <a href="mailto:suporte.altum@gmail.com" className="hover:text-emerald-900">Contato</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
