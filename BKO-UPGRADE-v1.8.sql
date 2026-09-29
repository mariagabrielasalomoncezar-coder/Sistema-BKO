-- ================================================================
-- VIVA CONECTA • SISTEMA BKO - UPGRADE V1.8
-- Execute UMA VEZ no SQL Editor do mesmo Supabase do Sistema BKO.
-- Não apaga pedidos antigos e não altera o Dashboard comercial.
-- ================================================================

alter table public.bko_clients
  add column if not exists dados_cnpj jsonb;

alter table public.bko_orders
  add column if not exists dados_cnpj jsonb,
  add column if not exists itens_comerciais jsonb;

-- Transforma cada pedido antigo em um pedido com 1 item comercial,
-- preservando todos os dados que já existem.
update public.bko_orders
set itens_comerciais = jsonb_build_array(
  jsonb_build_object(
    'debito_automatico', debito_automatico,
    'quality', quality,
    'vencimento', vencimento,
    'tipo_cliente', tipo_cliente,
    'produto', to_jsonb(array_remove(array[coalesce(produto_planilha, modalidade), tronco], null)),
    'sub_produto', to_jsonb(array_remove(array[coalesce(sub_produto, subproduto)], null)),
    'sub_item', to_jsonb(array_remove(array[sub_item], null)),
    'delta', delta,
    'outro', outro,
    'quantidade', quantidade,
    'valor_unitario', valor_unitario,
    'valor_contrato', valor_contrato,
    'dashboard_product', dashboard_product
  )
)
where itens_comerciais is null;

-- Padroniza a grafia nova sem invalidar registros antigos.
update public.bko_orders
set status_entrega = 'AGUARDANDO INSTALAÇÃO'
where upper(trim(coalesce(status_entrega,''))) in ('AG. INSTALAÇÃO','AG INSTALAÇÃO','AGUARDANDO INSTALACAO');
