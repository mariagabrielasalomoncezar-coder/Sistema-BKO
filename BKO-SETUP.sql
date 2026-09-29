-- ================================================================
-- VIVA CONECTA • SISTEMA BKO - SETUP V1
-- Execute UMA VEZ no SQL Editor do MESMO Supabase usado no Dashboard.
-- O Dashboard atual não é apagado nem substituído.
-- ================================================================

create extension if not exists pgcrypto;

create table if not exists public.bko_clients (
  id uuid primary key default gen_random_uuid(),
  cnpj text not null unique,
  razao_social text not null,
  gestor text,
  dados_cnpj jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bko_rules (
  id uuid primary key default gen_random_uuid(),
  modalidade text not null unique,
  vencimento integer check (vencimento between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bko_orders (
  id uuid primary key default gen_random_uuid(),
  data_venda date not null default current_date,
  cnpj text not null,
  razao_social text not null,
  gestor text,
  consultor text not null,
  equipe text,
  tipo_cliente text,
  modalidade text not null,
  produto text,
  subproduto text,
  dashboard_product text not null,
  vencimento integer check (vencimento is null or vencimento between 1 and 31),
  quantidade numeric(12,2) not null default 1,
  valor_unitario numeric(14,2),
  valor_contrato numeric(14,2) not null default 0,
  sistema_vivo text,
  mes text,
  tramitacao text,
  endereco_instalacao text,
  cidade text,
  representante text,
  contato text,
  email text,
  debito_automatico text,
  quality text,
  produto_planilha text,
  tronco text,
  sub_produto text,
  sub_item text,
  delta text,
  outro text,
  simulacao text,
  cotacao text,
  data_agendamento text,
  data_entrega date,
  previsao_comissao text,
  data_conclusao date,
  obs_extras text,
  dados_cnpj jsonb,
  itens_comerciais jsonb,
  numero_pedido text,
  status_pedido text not null default 'ANÁLISE BKO',
  status_entrega text,
  observacoes text,
  dashboard_synced_at timestamptz,
  dashboard_entry_id text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bko_orders_cnpj_idx on public.bko_orders(cnpj);
create index if not exists bko_orders_status_idx on public.bko_orders(status_pedido);
create index if not exists bko_orders_numero_idx on public.bko_orders(numero_pedido);

-- Evita duplicidade apenas quando existe número de pedido.
create unique index if not exists bko_orders_unique_numero
on public.bko_orders(numero_pedido)
where numero_pedido is not null and btrim(numero_pedido) <> '';

alter table public.bko_clients enable row level security;
alter table public.bko_rules enable row level security;
alter table public.bko_orders enable row level security;

-- V1: qualquer usuário autenticado do Supabase pode operar o BKO.
-- Depois podemos restringir por perfis/roles sem mudar a tela.
drop policy if exists "bko_clients_auth_all" on public.bko_clients;
create policy "bko_clients_auth_all" on public.bko_clients for all to authenticated using (true) with check (true);
drop policy if exists "bko_rules_auth_all" on public.bko_rules;
create policy "bko_rules_auth_all" on public.bko_rules for all to authenticated using (true) with check (true);
drop policy if exists "bko_orders_auth_all" on public.bko_orders;
create policy "bko_orders_auth_all" on public.bko_orders for all to authenticated using (true) with check (true);

grant select,insert,update,delete on public.bko_clients to authenticated;
grant select,insert,update,delete on public.bko_rules to authenticated;
grant select,insert,update,delete on public.bko_orders to authenticated;

-- Mantém a leitura do Dashboard para o BKO obter consultores, equipes e produtos.
grant select on public.viva_state to authenticated;
-- Necessário para enviar produção APROVADA ao Dashboard.
grant insert,update on public.viva_state to authenticated;

-- Se a proteção atual do Dashboard já estiver aplicada, esta policy mantém a escrita autenticada.
drop policy if exists "viva_state_insert_authenticated" on public.viva_state;
create policy "viva_state_insert_authenticated" on public.viva_state for insert to authenticated with check (id = 1);
drop policy if exists "viva_state_update_authenticated" on public.viva_state;
create policy "viva_state_update_authenticated" on public.viva_state for update to authenticated using (id = 1) with check (id = 1);
