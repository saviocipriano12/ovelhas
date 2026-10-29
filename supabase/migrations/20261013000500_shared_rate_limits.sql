create table if not exists public.api_rate_limits (
  bucket_key text primary key,
  request_count integer not null default 0 check (request_count >= 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;

revoke all on public.api_rate_limits from anon, authenticated;

create or replace function public.consume_api_rate_limit(
  target_bucket_key text,
  max_requests integer,
  window_seconds integer
)
returns table(allowed boolean, retry_after_ms bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  current_reset_at timestamptz;
  current_time timestamptz := clock_timestamp();
begin
  if target_bucket_key is null or length(target_bucket_key) = 0 then
    raise exception 'target_bucket_key is required';
  end if;

  if max_requests < 1 or window_seconds < 1 then
    raise exception 'max_requests and window_seconds must be positive';
  end if;

  insert into public.api_rate_limits as limits (
    bucket_key,
    request_count,
    reset_at,
    updated_at
  )
  values (
    target_bucket_key,
    1,
    current_time + make_interval(secs => window_seconds),
    current_time
  )
  on conflict (bucket_key) do update
  set
    request_count = case
      when limits.reset_at <= current_time then 1
      else limits.request_count + 1
    end,
    reset_at = case
      when limits.reset_at <= current_time then current_time + make_interval(secs => window_seconds)
      else limits.reset_at
    end,
    updated_at = current_time
  returning request_count, reset_at
  into current_count, current_reset_at;

  return query
  select
    current_count <= max_requests,
    greatest(0, floor(extract(epoch from (current_reset_at - current_time)) * 1000))::bigint;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;

create index if not exists idx_api_rate_limits_reset_at
  on public.api_rate_limits (reset_at);
