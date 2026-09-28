-- ================================================================
-- VIVA CONECTA • SISTEMA BKO - UPGRADE V1.5
-- Execute UMA VEZ no SQL Editor do mesmo Supabase do Dashboard.
-- Adiciona as colunas da planilha BKO ao cadastro de pedidos.
-- Não apaga pedidos nem altera o Dashboard comercial.
-- ================================================================

alter table public.bko_orders add column if not exists mes text;
alter table public.bko_orders add column if not exists tramitacao text;
alter table public.bko_orders add column if not exists endereco_instalacao text;
alter table public.bko_orders add column if not exists cidade text;
alter table public.bko_orders add column if not exists representante text;
alter table public.bko_orders add column if not exists contato text;
alter table public.bko_orders add column if not exists email text;
alter table public.bko_orders add column if not exists debito_automatico text;
alter table public.bko_orders add column if not exists quality text;
alter table public.bko_orders add column if not exists produto_planilha text;
alter table public.bko_orders add column if not exists tronco text;
alter table public.bko_orders add column if not exists sub_produto text;
alter table public.bko_orders add column if not exists sub_item text;
alter table public.bko_orders add column if not exists delta text;
alter table public.bko_orders add column if not exists outro text;
alter table public.bko_orders add column if not exists simulacao text;
alter table public.bko_orders add column if not exists cotacao text;
alter table public.bko_orders add column if not exists data_agendamento text;
alter table public.bko_orders add column if not exists data_entrega date;
alter table public.bko_orders add column if not exists previsao_comissao text;
alter table public.bko_orders add column if not exists data_conclusao date;
alter table public.bko_orders add column if not exists obs_extras text;

-- Mantém os registros antigos compatíveis com a nova nomenclatura.
update public.bko_orders
set produto_planilha = coalesce(produto_planilha, modalidade),
    tronco = coalesce(tronco, produto),
    sub_produto = coalesce(sub_produto, subproduto),
    mes = coalesce(mes, upper(to_char(data_venda, 'TMMonth')))
where produto_planilha is null
   or tronco is null
   or sub_produto is null
   or mes is null;
