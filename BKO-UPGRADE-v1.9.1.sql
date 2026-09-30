-- ================================================================
-- VIVA CONECTA • SISTEMA BKO - UPGRADE V1.9.1
-- Execute UMA VEZ no SQL Editor do mesmo Supabase do Sistema BKO.
-- Não apaga pedidos nem altera os dados já existentes.
-- ================================================================

alter table public.bko_orders
  add column if not exists subir_dashboard boolean not null default false;

-- Pedidos que já haviam sido enviados ao Dashboard antes desta atualização
-- ficam marcados como SIM para preservar o comportamento/histórico.
update public.bko_orders
set subir_dashboard = true
where dashboard_synced_at is not null
  and subir_dashboard = false;
