-- ================================================================
-- VIVA CONECTA • SISTEMA BKO - UPGRADE V1.9
-- Execute UMA VEZ no SQL Editor do mesmo Supabase do Sistema BKO.
-- Seguro para a versão atual: não apaga pedidos nem altera o Dashboard.
-- ================================================================

alter table public.bko_orders
  add column if not exists bko_responsavel text;

-- A opção F1 GANHA é gravada no campo status_entrega já existente,
-- portanto não exige uma nova coluna ou enum no banco.
