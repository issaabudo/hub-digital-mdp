-- Schema MVP Hub Digital MdP (Supabase / PostgreSQL)
-- Correr no SQL Editor do projecto Supabase

-- Pessoas
create table if not exists pessoas (
  codigo text primary key,
  nome text not null,
  tipo text,
  perfil text,
  status text default 'Active',
  "criadoEm" timestamptz default now()
);

-- Contador simples (alternativa: usar sequence)
create table if not exists meta (
  id text primary key default 'counter',
  value int default 0
);
insert into meta (id, value) values ('counter', 0)
  on conflict (id) do nothing;

create or replace function next_participant_code()
returns text
language plpgsql
as $$
declare
  n int;
begin
  update meta set value = value + 1 where id = 'counter' returning value into n;
  return 'P-' || lpad(n::text, 5, '0');
end;
$$;

-- Computadores
create table if not exists computadores (
  codigo text primary key,
  status text default 'Available',
  active boolean default true
);

insert into computadores (codigo)
select 'PC-' || lpad(i::text, 2, '0')
from generate_series(1, 20) as i
on conflict do nothing;

-- Presenças
create table if not exists presencas (
  id text primary key,
  codigo text references pessoas(codigo),
  data date not null,
  hora text,
  motivo text,
  source text default 'Kiosk'
);

-- Uso de computador
create table if not exists uso_computador (
  id text primary key,
  codigo text references pessoas(codigo),
  computador text references computadores(codigo),
  data date not null,
  "horaInicio" timestamptz,
  "horaFim" timestamptz,
  status text default 'Active'
);

-- Atribuição mensal
create table if not exists atribuicao_mensal (
  codigo text primary key references pessoas(codigo),
  computador text not null
);

-- RLS básico (abrir para anon no MVP; apertar depois com auth)
alter table pessoas enable row level security;
alter table presencas enable row level security;
alter table uso_computador enable row level security;
alter table computadores enable row level security;
alter table atribuicao_mensal enable row level security;
alter table meta enable row level security;

create policy "anon_all_pessoas" on pessoas for all using (true) with check (true);
create policy "anon_all_presencas" on presencas for all using (true) with check (true);
create policy "anon_all_uso" on uso_computador for all using (true) with check (true);
create policy "anon_all_pcs" on computadores for all using (true) with check (true);
create policy "anon_all_atrib" on atribuicao_mensal for all using (true) with check (true);
create policy "anon_all_meta" on meta for all using (true) with check (true);
