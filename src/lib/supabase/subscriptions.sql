-- Ovelhas - assinaturas por igreja (Stripe)
-- Rode depois de schema.sql e admin-management.sql.
-- Escrita nesta tabela so acontece pelo webhook (service role, bypassa RLS).
-- O cliente nunca escreve aqui diretamente.

create table if not exists public.church_subscriptions (
  church_id uuid primary key references public.churches(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  tier text check (tier in ('pequena', 'media', 'grande')),
  status text not null default 'incomplete' check (
    status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid')
  ),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.church_subscriptions enable row level security;

drop policy if exists "church_subscriptions_select_by_leadership" on public.church_subscriptions;
create policy "church_subscriptions_select_by_leadership"
on public.church_subscriptions
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = church_subscriptions.church_id
    and p.role in ('admin', 'pastor')
  )
);

-- Sem policy de insert/update/delete: so a service role (webhook) escreve aqui.
