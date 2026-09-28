const CONFIG=window.VIVA_CONFIG||{};
const SB=CONFIG.supabaseUrl||''; const KEY=CONFIG.supabaseAnonKey||'';
const AUTH='vivaBkoAuthV1';
let session=null, dashboardState=null, orders=[], clients=[], rules=[];
let currentView='dashboard', tvTimer=null, tvZoom=1;
function applyTvZoom(){const el=document.querySelector('.tv-shell');if(el)el.style.zoom=String(tvZoom);const lbl=document.getElementById('tvZoomLabel');if(lbl)lbl.textContent=Math.round(tvZoom*100)+'%'}
function changeTvZoom(delta){tvZoom=Math.max(.7,Math.min(1.4,Math.round((tvZoom+delta)*10)/10));applyTvZoom()}
function resetTvZoom(){tvZoom=1;applyTvZoom()}
const STATUSES=['ANÁLISE BKO','ANÁLISE DE CRÉDITO','ANÁLISE DE FRAUDE','AGUARDANDO INFORMAÇÃO','EM ANDAMENTO','APROVADO','REPROVADO CRÉDITO','REPROVADO FRAUDE','CANCELADO'];
const DELIVERY=['','AG. INSTALAÇÃO','AG. ENTREGA','LOGÍSTICA CONCLUÍDA','CONCLUÍDO','CANCELADO'];
const app=document.getElementById('app');
function token(){return session?.access_token||''} function uid(){return session?.user?.id||''}
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),2300)}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase()}
function money(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function saveSession(s){session=s;if(s)localStorage.setItem(AUTH,JSON.stringify(s));else localStorage.removeItem(AUTH)}
function loadSession(){try{session=JSON.parse(localStorage.getItem(AUTH)||'null')}catch{session=null}}
async function api(path,opt={}){const headers={apikey:KEY,Authorization:`Bearer ${token()||KEY}`,'Content-Type':'application/json',...(opt.headers||{})};const r=await fetch(`${SB}${path}`,{...opt,headers});if(r.status===401&&session?.refresh_token){if(await refresh()){return api(path,opt)}}if(!r.ok){let b={};try{b=await r.json()}catch{};throw new Error(b.message||b.msg||b.error_description||`Erro ${r.status}`)}if(r.status===204)return null;const txt=await r.text();return txt?JSON.parse(txt):null}
async function refresh(){try{const r=await fetch(`${SB}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});if(!r.ok)throw 0;saveSession(await r.json());return true}catch{saveSession(null);return false}}
async function login(e){e.preventDefault();loginError.textContent='';try{const r=await fetch(`${SB}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email:loginEmail.value.trim(),password:loginPassword.value})});const b=await r.json();if(!r.ok)throw new Error(b.error_description||'E-mail ou senha inválidos');saveSession(b);await boot()}catch(err){loginError.textContent=err.message}}
function logout(){saveSession(null);renderLogin()}
function renderLogin(){app.innerHTML=`<div class="login-shell"><div class="login-card"><img src="logo-viva.png"><h1>Sistema de Alimentação BKO</h1><p>Cadastre e acompanhe pedidos. Somente pedidos aprovados são enviados ao Dashboard Viva Conecta.</p><form onsubmit="login(event)"><label>E-mail</label><input id="loginEmail" type="email" required><label>Senha</label><input id="loginPassword" type="password" required><div id="loginError" class="login-error"></div><button class="btn primary login-btn">Entrar</button></form></div></div>`}
async function loadDashboard(){const rows=await api('/rest/v1/viva_state?id=eq.1&select=data');dashboardState=rows?.[0]?.data||null}
async function loadAll(){await Promise.all([loadDashboard(),loadOrders(),loadClients(),loadRules()])}
async function loadOrders(){orders=await api('/rest/v1/bko_orders?select=*&order=created_at.desc')||[]}
async function loadClients(){clients=await api('/rest/v1/bko_clients?select=*&order=razao_social.asc')||[]}
async function loadRules(){rules=await api('/rest/v1/bko_rules?select=*&order=modalidade.asc')||[]}
function consultants(){return (dashboardState?.people||[]).filter(p=>p.active!==false)}
function products(){return dashboardState?.products||[]}
async function boot(){if(!SB||!KEY){app.innerHTML='<div class="empty">Configuração do Supabase não encontrada.</div>';return}loadSession();if(!session){renderLogin();return}try{await loadAll();render()}catch(e){console.error(e);if(String(e.message).includes('bko_orders')){app.innerHTML=`<div class="login-shell"><div class="login-card"><img src="logo-viva.png"><h1>Falta preparar o banco</h1><p>O sistema abriu, mas as tabelas do BKO ainda não existem. Execute o arquivo <b>BKO-SETUP.sql</b> no SQL Editor do mesmo Supabase usado pelo Dashboard.</p><button class="btn" onclick="logout()">Sair</button></div></div>`}else{toast(e.message);renderLogin()}}}
function nav(label,view){return `<button class="${currentView===view?'active':''}" onclick="go('${view}')">${label}</button>`}
function shell(inner){return `<div class="shell"><aside class="sidebar"><div class="brand"><img src="logo-viva.png"></div><div class="nav">${nav('Dashboard BKO','dashboard')}${nav('Modo TV','tv')}${nav('Pedidos','pedidos')}${nav('Novo pedido','novo')}${nav('Relatórios','relatorios')}${nav('Clientes','clientes')}${nav('Regras automáticas','regras')}</div><div class="sidebar-foot">Viva Conecta Telecom<br>Supabase conectado<br>Dashboard comercial preservado</div></aside><main class="content"><div class="topbar"><div><h1>Sistema BKO</h1><p>Uma entrada de informação → operação e Dashboard sincronizados.</p></div><div class="top-actions"><span class="pill"><i class="dot"></i>Online</span><button class="btn" onclick="logout()">Sair</button></div></div>${inner}</main></div>`}
function go(v){if(tvTimer){clearInterval(tvTimer);tvTimer=null}currentView=v;render()}
function statusClass(s){s=norm(s);if(s==='aprovado')return'aprovado';if(s.includes('reprov')||s.includes('cancel'))return'reprovado';if(s.includes('andamento')||s.includes('analise')||s.includes('aguard'))return'andamento';return'outro'}
function render(){if(currentView==='tv')return renderTvDashboard();if(currentView==='dashboard')return renderDashboardBko();if(currentView==='novo')return renderForm();if(currentView==='relatorios')return renderReports();if(currentView==='clientes')return renderClients();if(currentView==='regras')return renderRules();renderOrders()}
function statusCounts(list){
  const c={total:list.length,analiseBko:0,credito:0,fraude:0,aguardando:0,andamento:0,aprovado:0,reprovado:0,cancelado:0,concluido:0,synced:0};
  for(const o of list){const st=norm(o.status_pedido),ent=norm(o.status_entrega);if(st==='analise bko')c.analiseBko++;if(st==='analise de credito')c.credito++;if(st==='analise de fraude')c.fraude++;if(st==='aguardando informacao')c.aguardando++;if(st==='em andamento')c.andamento++;if(st==='aprovado')c.aprovado++;if(st.includes('reprov'))c.reprovado++;if(st.includes('cancel'))c.cancelado++;if(ent==='concluido')c.concluido++;if(o.dashboard_synced_at)c.synced++;}
  return c;
}
function renderDashboardBko(){
  const c=statusCounts(orders), uniqueClients=new Set(orders.map(o=>cleanCnpj(o.cnpj)).filter(Boolean)).size;
  const sellers=groupSummary(orders,o=>o.consultor).slice(0,8);
  const recent=orders.slice(0,8);
  app.innerHTML=shell(`<div class="section-title dashboard-title"><div><h2>Dashboard BKO</h2><p>Visão operacional de todos os pedidos, inclusive os que ainda não foram aprovados.</p></div><div class="dashboard-actions"><button class="btn" onclick="go('tv')">Abrir modo TV</button><button class="btn primary" onclick="go('novo')">+ Novo pedido</button></div></div>
  <div class="grid bko-status-grid">
    <div class="card status-card"><small>Total de pedidos</small><strong>${c.total}</strong></div>
    <div class="card status-card warn"><small>Análise BKO</small><strong>${c.analiseBko}</strong></div>
    <div class="card status-card warn"><small>Análise de crédito</small><strong>${c.credito}</strong></div>
    <div class="card status-card warn"><small>Análise de fraude</small><strong>${c.fraude}</strong></div>
    <div class="card status-card info"><small>Aguardando informação</small><strong>${c.aguardando}</strong></div>
    <div class="card status-card info"><small>Em andamento</small><strong>${c.andamento}</strong></div>
    <div class="card status-card ok"><small>Aprovados</small><strong>${c.aprovado}</strong></div>
    <div class="card status-card bad"><small>Reprovados / Cancelados</small><strong>${c.reprovado+c.cancelado}</strong></div>
  </div>
  <div class="grid mini-kpis"><div class="card mini-kpi"><small>Clientes</small><b>${uniqueClients}</b></div><div class="card mini-kpi"><small>Enviados ao Dashboard</small><b>${c.synced}</b></div><div class="card mini-kpi"><small>Concluídos</small><b>${c.concluido}</b></div></div>
  <div class="dashboard-two"><div class="card section-card"><div class="section-title"><div><h2>Pedidos recentes</h2><p>Últimas movimentações cadastradas.</p></div><button class="btn" onclick="go('pedidos')">Ver todos</button></div><div class="table-wrap"><table class="table dashboard-table"><thead><tr><th>Cliente</th><th>Consultor</th><th>Status</th></tr></thead><tbody>${recent.length?recent.map(o=>`<tr class="order-row" onclick="editOrder('${o.id}')"><td><b>${esc(o.razao_social)}</b><br><small>${esc(o.numero_pedido||'')}</small></td><td>${esc(o.consultor)}</td><td><span class="badge ${statusClass(o.status_pedido)}">${esc(o.status_pedido)}</span></td></tr>`).join(''):'<tr><td colspan="3"><div class="empty">Nenhum pedido cadastrado.</div></td></tr>'}</tbody></table></div></div>
  <div class="card section-card"><div class="section-title"><div><h2>Por consultor</h2><p>Volume de pedidos e aprovados.</p></div></div><div class="table-wrap"><table class="table dashboard-table"><thead><tr><th>Consultor</th><th>Pedidos</th><th>Aprovados</th></tr></thead><tbody>${sellers.length?sellers.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${x.pedidos}</td><td>${x.aprovados}</td></tr>`).join(''):'<tr><td colspan="3"><div class="empty">Sem dados.</div></td></tr>'}</tbody></table></div></div></div>`);
}
function pct(part,total){return total?Math.round((part/total)*100):0}
function renderStatusBar(label,value,total,cls=''){const w=pct(value,total);return `<div class="tv-status-row"><div class="tv-status-head"><span>${esc(label)}</span><b>${value}</b></div><div class="tv-track"><i class="${cls}" style="width:${w}%"></i></div></div>`}
function tvClock(){const n=new Date();return n.toLocaleString('pt-BR',{weekday:'long',day:'2-digit',month:'long',hour:'2-digit',minute:'2-digit'}).replace(/^./,x=>x.toUpperCase())}
async function refreshTv(){try{await loadOrders();if(currentView==='tv')renderTvDashboard(false)}catch(e){console.error(e)}}
function renderTvDashboard(startTimer=true){
  const c=statusCounts(orders), uniqueClients=new Set(orders.map(o=>cleanCnpj(o.cnpj)).filter(Boolean)).size;
  const sellers=groupSummary(orders,o=>o.consultor).slice(0,6);
  const attention=orders.filter(o=>{const s=norm(o.status_pedido);return s.includes('analise')||s.includes('aguardando')||s==='em andamento'}).slice(0,7);
  const approvedRate=pct(c.aprovado,c.total), pending=c.analiseBko+c.credito+c.fraude+c.aguardando+c.andamento;
  app.innerHTML=`<div class="tv-shell"><header class="tv-head"><div class="tv-brand"><img src="logo-viva.png"><div><span>CENTRAL OPERACIONAL</span><h1>Dashboard BKO</h1></div></div><div class="tv-head-right"><div><b>Atualização automática</b><span id="tvClock">${tvClock()}</span></div><div class="tv-zoom" aria-label="Tamanho do painel"><button type="button" onclick="changeTvZoom(-0.1)" title="Diminuir">−</button><button type="button" id="tvZoomLabel" onclick="resetTvZoom()" title="Voltar para 100%">100%</button><button type="button" onclick="changeTvZoom(0.1)" title="Aumentar">+</button></div><button class="tv-exit" onclick="go('dashboard')">Sair do modo TV</button></div></header>
  <section class="tv-hero"><div><span class="tv-eyebrow">VISÃO GERAL DA OPERAÇÃO</span><h2>${c.total} pedidos acompanhados</h2><p>Atualização automática a cada 30 segundos • somente aprovados seguem para o Dashboard comercial.</p></div><div class="tv-rate"><strong>${approvedRate}%</strong><span>taxa de aprovação</span></div></section>
  <section class="tv-kpis">
    <article class="tv-kpi total"><span>Total de pedidos</span><strong>${c.total}</strong><small>${uniqueClients} cliente(s)</small></article>
    <article class="tv-kpi warning"><span>Em análise / andamento</span><strong>${pending}</strong><small>${c.credito} em crédito • ${c.analiseBko} no BKO</small></article>
    <article class="tv-kpi success"><span>Aprovados</span><strong>${c.aprovado}</strong><small>${c.synced} enviados ao Dashboard</small></article>
    <article class="tv-kpi danger"><span>Reprovados / cancelados</span><strong>${c.reprovado+c.cancelado}</strong><small>${c.reprovado} reprovados • ${c.cancelado} cancelados</small></article>
  </section>
  <section class="tv-grid">
    <article class="tv-panel status-panel"><div class="tv-panel-title"><div><span>PIPELINE</span><h3>Pedidos por status</h3></div><b>${c.total}</b></div>
      ${renderStatusBar('Análise BKO',c.analiseBko,c.total,'amber')}${renderStatusBar('Análise de crédito',c.credito,c.total,'amber')}${renderStatusBar('Análise de fraude',c.fraude,c.total,'orange')}${renderStatusBar('Aguardando informação',c.aguardando,c.total,'blue')}${renderStatusBar('Em andamento',c.andamento,c.total,'blue')}${renderStatusBar('Aprovados',c.aprovado,c.total,'green')}
    </article>
    <article class="tv-panel"><div class="tv-panel-title"><div><span>DESTAQUES</span><h3>Por consultor</h3></div><b>${sellers.length}</b></div><div class="tv-ranking">${sellers.length?sellers.map((x,i)=>`<div class="tv-rank"><span class="tv-pos">${i+1}º</span><div><b>${esc(x.name)}</b><small>${x.aprovados} aprovado(s) de ${x.pedidos}</small></div><strong>${x.pedidos}</strong></div>`).join(''):'<div class="tv-empty">Sem dados ainda.</div>'}</div></article>
    <article class="tv-panel attention-panel"><div class="tv-panel-title"><div><span>ATENÇÃO</span><h3>Pedidos em acompanhamento</h3></div><b>${attention.length}</b></div><div class="tv-attention-list">${attention.length?attention.map(o=>`<div class="tv-attention"><div><b>${esc(o.razao_social)}</b><small>${esc(o.consultor)} • ${esc(o.numero_pedido||'Sem nº pedido')}</small></div><span class="tv-status-pill ${statusClass(o.status_pedido)}">${esc(o.status_pedido)}</span></div>`).join(''):'<div class="tv-empty">Nenhum pedido pendente no momento.</div>'}</div></article>
  </section><footer class="tv-footer"><span>Viva Conecta • Sistema BKO</span><span>Operação acompanhada em tempo real</span></footer></div>`;
  applyTvZoom();
  if(startTimer&&!tvTimer)tvTimer=setInterval(refreshTv,30000);
}

function orderFilteredList(){const q=norm(document.getElementById('q')?.value),st=norm(document.getElementById('statusFilter')?.value);return orders.filter(o=>(!st||norm(o.status_pedido)===st)&&(!q||[o.cnpj,o.razao_social,o.consultor,o.numero_pedido,o.modalidade,o.equipe].some(v=>norm(v).includes(q))))}
function orderFilterSummaryHtml(list){const c=statusCounts(list);return `<div class="filter-summary"><span><b>${c.total}</b> pedido(s)</span><span>Aprovados <b>${c.aprovado}</b></span><span>Análise BKO <b>${c.analiseBko}</b></span><span>Crédito <b>${c.credito}</b></span><span>Fraude <b>${c.fraude}</b></span><span>Em andamento <b>${c.andamento}</b></span><span>Reprovados <b>${c.reprovado}</b></span><span>Cancelados <b>${c.cancelado}</b></span></div>`}
function renderOrders(){const c=statusCounts(orders);const pending=orders.length-c.aprovado-c.reprovado-c.cancelado;app.innerHTML=shell(`<div class="grid kpis"><div class="card kpi"><small>Total de pedidos</small><strong>${orders.length}</strong></div><div class="card kpi"><small>Em andamento</small><strong>${pending}</strong></div><div class="card kpi"><small>Aprovados</small><strong>${c.aprovado}</strong></div><div class="card kpi"><small>Enviados ao Dashboard</small><strong>${c.synced}</strong></div></div><div class="notice"><b>Regra ativa:</b> pedidos em análise, andamento, reprovados ou cancelados ficam somente no Sistema BKO. O Dashboard recebe o lançamento apenas quando o status vira <b>APROVADO</b>.</div><div class="card toolbar"><div class="toolbar-left"><input class="search" id="q" placeholder="Buscar CNPJ, cliente, consultor ou nº pedido" oninput="filterOrders()"><select id="statusFilter" class="btn" onchange="filterOrders()"><option value="">Todos os status</option>${STATUSES.map(s=>`<option>${s}</option>`).join('')}</select></div><div class="toolbar-right"><button class="btn primary" onclick="go('novo')">+ Novo pedido</button></div></div><div id="orderFilterSummary">${orderFilterSummaryHtml(orders)}</div><div class="card table-card"><div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Cliente</th><th>CNPJ</th><th>Consultor</th><th>Produto</th><th>Valor</th><th>Status</th><th>Dashboard</th><th>Ações</th></tr></thead><tbody id="ordersBody">${ordersRows(orders)}</tbody></table></div></div>`)}
function ordersRows(list){if(!list.length)return'<tr><td colspan="9"><div class="empty">Nenhum pedido cadastrado ainda.</div></td></tr>';return list.map(o=>`<tr class="order-row" role="button" tabindex="0" onclick="editOrder('${o.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();editOrder('${o.id}')}"><td>${o.data_venda?new Date(o.data_venda+'T12:00:00').toLocaleDateString('pt-BR'):'-'}</td><td><b>${esc(o.razao_social)}</b><br><small>${esc(o.numero_pedido||'')}</small></td><td>${esc(o.cnpj)}</td><td>${esc(o.consultor)}<br><small>${esc(o.equipe||'')}</small></td><td>${esc(o.modalidade||'')}<br><small>${esc(o.dashboard_product||o.produto||'')}</small></td><td>${money(o.valor_contrato)}</td><td><span class="badge ${statusClass(o.status_pedido)}">${esc(o.status_pedido)}</span></td><td>${o.dashboard_synced_at?'<span class="sync">✓ Enviado</span>':'<span style="color:#8a8496">—</span>'}</td><td><button class="btn" onclick="event.stopPropagation();editOrder('${o.id}')">Abrir</button></td></tr>`).join('')}
function filterOrders(){const x=orderFilteredList();ordersBody.innerHTML=ordersRows(x);const box=document.getElementById('orderFilterSummary');if(box)box.innerHTML=orderFilterSummaryHtml(x)}
function formOptions(arr,val=''){return arr.map(x=>`<option value="${esc(x)}" ${x===val?'selected':''}>${esc(x)}</option>`).join('')}
function consultantOptions(val=''){return consultants().map(p=>`<option value="${esc(p.name)}" ${p.name===val?'selected':''}>${esc(p.name)} • ${esc(p.team||'Sem equipe')}</option>`).join('')}
function productOptions(val=''){return products().map(p=>`<option value="${esc(p.name)}" ${p.name===val?'selected':''}>${esc(p.name)}</option>`).join('')}

function monthName(dateStr){
  if(!dateStr)return '';
  const m=Number(String(dateStr).slice(5,7));
  return ['','JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'][m]||'';
}
function renderForm(order=null){
  const o=order||{status_pedido:'ANÁLISE BKO',quantidade:1,data_venda:new Date().toISOString().slice(0,10)};
  currentView='novo';
  const planProduto=o.produto_planilha||o.modalidade||'';
  const troncoVal=o.tronco||o.produto||'';
  const subProdutoVal=o.sub_produto||o.subproduto||'';
  const mesVal=o.mes||monthName(o.data_venda);
  app.innerHTML=shell(`<div class="card section-card">
    <div class="section-title"><div><h2>${order?'Editar pedido':'Novo pedido'}</h2><p>Cadastro completo conforme a planilha BKO. Campos automáticos continuam sendo preenchidos pelo sistema.</p></div>${order?`<span class="badge ${statusClass(o.status_pedido)}">${esc(o.status_pedido)}</span>`:''}</div>
    <form id="orderForm" onsubmit="saveOrder(event,'${o.id||''}')">
      <div class="form-block"><h3>1. Dados da venda</h3><div class="form-grid">
        <div class="field"><label>Data da venda *</label><input id="dataVenda" type="date" value="${esc(o.data_venda||'')}" onchange="updateMonth()" required></div>
        <div class="field"><label>Mês</label><input id="mes" class="readonly" value="${esc(mesVal)}" readonly></div>
        <div class="field"><label>Tramitação</label><input id="tramitacao" value="${esc(o.tramitacao||'')}" placeholder="Ex.: SETEMBRO / OUTUBRO"></div>
        <div class="field"><label>Vendedor / Consultor *</label><select id="consultor" onchange="fillTeam()" required><option value="">Selecione</option>${consultantOptions(o.consultor)}</select></div>
        <div class="field"><label>Equipe automática</label><input id="equipe" class="readonly" value="${esc(o.equipe||'')}" readonly></div>
      </div></div>

      <div class="form-block"><h3>2. Dados do cliente</h3><div class="form-grid">
        <div class="field"><label>CNPJ *</label><input id="cnpj" value="${esc(o.cnpj||'')}" maxlength="18" onblur="lookupCnpj()" required><small id="cnpjHint">Digite o CNPJ e saia do campo.</small></div>
        <div class="field span2"><label>Razão Social *</label><input id="razao" value="${esc(o.razao_social||'')}" required></div>
        <div class="field span2"><label>Endereço / Instalação</label><input id="enderecoInstalacao" value="${esc(o.endereco_instalacao||'')}"></div>
        <div class="field"><label>Cidade</label><input id="cidade" value="${esc(o.cidade||'')}"></div>
        <div class="field"><label>Representante</label><input id="representante" value="${esc(o.representante||'')}"></div>
        <div class="field"><label>Contato</label><input id="contato" value="${esc(o.contato||'')}"></div>
        <div class="field span2"><label>E-mail</label><input id="emailCliente" type="email" value="${esc(o.email||'')}"></div>
      </div></div>

      <div class="form-block"><h3>3. Informações comerciais</h3><div class="form-grid">
        <div class="field"><label>Débito automático?</label><select id="debitoAutomatico"><option value="">Selecione</option>${formOptions(['SIM','NÃO'],o.debito_automatico)}</select></div>
        <div class="field"><label>Quality?</label><select id="quality"><option value="">Selecione</option>${formOptions(['SIM','NÃO'],o.quality)}</select></div>
        <div class="field"><label>Vencimento</label><input id="vencimento" type="number" min="1" max="31" value="${esc(o.vencimento||'')}" placeholder="Dia"></div>
        <div class="field"><label>Tipo de cliente</label><select id="tipoCliente"><option value="">Selecione</option>${formOptions(['CARTEIRA','COCKPIT'],o.tipo_cliente)}</select></div>
        <div class="field"><label>Produto *</label><select id="produtoPlanilha" onchange="applyRuleFromProduct()" required><option value="">Selecione</option>${formOptions(['MÓVEL','BANDA LARGA','AVANÇADO','APARELHO','T.I','OUTRO'],planProduto)}</select></div>
        <div class="field"><label>Tronco</label><input id="tronco" value="${esc(troncoVal)}" placeholder="Ex.: ALTA, MIGRAÇÃO, PORTABILIDADE"></div>
        <div class="field"><label>Sub Produto</label><input id="subProduto" value="${esc(subProdutoVal)}" placeholder="Ex.: 6GB, 20GB, 700MB"></div>
        <div class="field"><label>Sub Item</label><input id="subItem" value="${esc(o.sub_item||'')}"></div>
        <div class="field"><label>Delta</label><input id="delta" value="${esc(o.delta||'')}"></div>
        <div class="field"><label>Outro</label><input id="outro" value="${esc(o.outro||'')}"></div>
        <div class="field"><label>Quantidade *</label><input id="quantidade" type="number" step="0.01" min="0" value="${esc(o.quantidade??1)}" oninput="calcTotal()" required></div>
        <div class="field"><label>Valor unitário</label><input id="valorUnit" type="number" step="0.01" min="0" value="${esc(o.valor_unitario||'')}" oninput="calcTotal()"></div>
        <div class="field"><label>Valor do contrato / Receita *</label><input id="valorContrato" type="number" step="0.01" min="0" value="${esc(o.valor_contrato||'')}" required><small>Calculado automaticamente quando há quantidade e valor unitário.</small></div>
        <div class="field"><label>Produto no Dashboard *</label><select id="dashProduct" required><option value="">Selecione</option>${productOptions(o.dashboard_product)}</select><small>Usado somente quando o pedido for APROVADO.</small></div>
      </div></div>

      <div class="form-block"><h3>4. Dados do pedido</h3><div class="form-grid">
        <div class="field"><label>Simulação</label><input id="simulacao" value="${esc(o.simulacao||'')}"></div>
        <div class="field"><label>Sistema Vivo</label><select id="sistemaVivo"><option value="">Selecione</option>${formOptions(['ESTRUTURANTE','VIVOCORP','FENIX','OUTRO'],o.sistema_vivo)}</select></div>
        <div class="field"><label>Status do pedido *</label><select id="statusPedido" required>${formOptions(STATUSES,o.status_pedido)}</select></div>
        <div class="field"><label>Cotação</label><input id="cotacao" value="${esc(o.cotacao||'')}"></div>
        <div class="field"><label>Nº do pedido</label><input id="numeroPedido" value="${esc(o.numero_pedido||'')}"></div>
      </div></div>

      <div class="form-block"><h3>5. Entrega / andamento</h3><div class="form-grid">
        <div class="field span2"><label>Data de agendamento</label><input id="dataAgendamento" value="${esc(o.data_agendamento||'')}" placeholder="Ex.: 24/09/2026 10:30 - 12:30"></div>
        <div class="field"><label>Status de entrega</label><select id="statusEntrega">${formOptions(DELIVERY,o.status_entrega||'')}</select></div>
        <div class="field"><label>Data de entrega</label><input id="dataEntrega" type="date" value="${esc(o.data_entrega||'')}"></div>
        <div class="field span4"><label>Observações</label><textarea id="observacoes">${esc(o.observacoes||'')}</textarea></div>
      </div></div>

      <div class="form-block"><h3>6. Finalização</h3><div class="form-grid">
        <div class="field"><label>Previsão de comissão</label><input id="previsaoComissao" value="${esc(o.previsao_comissao||'')}" placeholder="Ex.: NOVEMBRO"></div>
        <div class="field"><label>Data de conclusão</label><input id="dataConclusao" type="date" value="${esc(o.data_conclusao||'')}"></div>
        <div class="field span4"><label>Observações extras</label><textarea id="obsExtras">${esc(o.obs_extras||'')}</textarea></div>
      </div></div>

      <div class="summary"><div class="summary-grid"><div>Cliente<b id="sCliente">${esc(o.razao_social||'-')}</b></div><div>Consultor / Equipe<b id="sConsultor">${esc((o.consultor||'-')+(o.equipe?' • '+o.equipe:''))}</b></div><div>Status<b id="sStatus">${esc(o.status_pedido||'-')}</b></div><div>Dashboard<b>${o.dashboard_synced_at?'Já enviado':'Aguardando aprovação'}</b></div></div></div>
      <div class="actions"><button type="button" class="btn" onclick="go('pedidos')">Cancelar</button><button type="submit" class="btn primary">${order?'Salvar alterações':'Cadastrar pedido'}</button></div>
    </form></div>`);
  setTimeout(()=>{fillTeam(false);applyRuleFromProduct(false);bindSummary();updateMonth(false)},0)
}
function updateMonth(){const el=document.getElementById('mes');if(el)el.value=monthName(document.getElementById('dataVenda')?.value)}
function applyRuleFromProduct(show=true){const p=document.getElementById('produtoPlanilha')?.value||'';const r=rules.find(x=>norm(x.modalidade)===norm(p)&&x.active!==false);if(r?.vencimento)document.getElementById('vencimento').value=r.vencimento;if(show&&r?.vencimento)toast(`Vencimento automático: dia ${r.vencimento}`)}

function bindSummary(){['razao','consultor','statusPedido'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>{sCliente.textContent=razao.value||'-';sConsultor.textContent=(consultor.value||'-')+(equipe.value?' • '+equipe.value:'');sStatus.textContent=statusPedido.value||'-'}))}
function fillTeam(update=true){const p=consultants().find(x=>x.name===consultor.value);equipe.value=p?.team||'';if(update&&window.sConsultor)sConsultor.textContent=(consultor.value||'-')+(equipe.value?' • '+equipe.value:'')}
function applyRule(show=true){return applyRuleFromProduct(show)}
function calcTotal(){const q=Number(quantidade.value||0),u=Number(valorUnit.value||0);if(q&&u)valorContrato.value=(q*u).toFixed(2)}
function cleanCnpj(v){return String(v||'').replace(/\D/g,'')}
async function lookupCnpj(){const c=cleanCnpj(cnpj.value);if(c.length!==14){cnpjHint.textContent='CNPJ deve ter 14 dígitos.';return}const found=clients.find(x=>cleanCnpj(x.cnpj)===c);if(found){razao.value=found.razao_social||'';cnpjHint.textContent='Cliente encontrado na base ✓';sCliente.textContent=razao.value||'-'}else{cnpjHint.textContent='CNPJ ainda não está na base. Complete os dados; ele será cadastrado junto com o pedido.'}}
async function saveClientFromForm(){const c=cleanCnpj(cnpj.value);if(c.length!==14)return;const existing=clients.find(x=>cleanCnpj(x.cnpj)===c);const payload={cnpj:c,razao_social:razao.value.trim(),updated_at:new Date().toISOString()};if(existing){await api(`/rest/v1/bko_clients?id=eq.${existing.id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(payload)})}else{payload.created_by=uid();await api('/rest/v1/bko_clients',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(payload)})}}
async function saveOrder(e,id){
  e.preventDefault();
  const planProduto=produtoPlanilha.value;
  const troncoValue=tronco.value.trim()||null;
  const subProdutoValue=subProduto.value.trim()||null;
  const payload={
    data_venda:dataVenda.value,
    mes:mes.value||monthName(dataVenda.value)||null,
    tramitacao:tramitacao.value.trim()||null,
    cnpj:cleanCnpj(cnpj.value),
    razao_social:razao.value.trim(),
    endereco_instalacao:enderecoInstalacao.value.trim()||null,
    cidade:cidade.value.trim()||null,
    representante:representante.value.trim()||null,
    contato:contato.value.trim()||null,
    email:emailCliente.value.trim()||null,
    consultor:consultor.value,
    equipe:equipe.value,
    debito_automatico:debitoAutomatico.value||null,
    quality:quality.value||null,
    tipo_cliente:tipoCliente.value||null,
    produto_planilha:planProduto,
    tronco:troncoValue,
    sub_produto:subProdutoValue,
    sub_item:subItem.value.trim()||null,
    delta:delta.value.trim()||null,
    outro:outro.value.trim()||null,
    modalidade:planProduto,
    produto:troncoValue,
    subproduto:subProdutoValue,
    dashboard_product:dashProduct.value,
    vencimento:vencimento.value?Number(vencimento.value):null,
    quantidade:Number(quantidade.value||0),
    valor_unitario:valorUnit.value?Number(valorUnit.value):null,
    valor_contrato:Number(valorContrato.value||0),
    simulacao:simulacao.value.trim()||null,
    sistema_vivo:sistemaVivo.value||null,
    cotacao:cotacao.value.trim()||null,
    numero_pedido:numeroPedido.value.trim()||null,
    status_pedido:statusPedido.value,
    data_agendamento:dataAgendamento.value.trim()||null,
    status_entrega:statusEntrega.value||null,
    data_entrega:dataEntrega.value||null,
    observacoes:observacoes.value.trim()||null,
    previsao_comissao:previsaoComissao.value.trim()||null,
    data_conclusao:dataConclusao.value||null,
    obs_extras:obsExtras.value.trim()||null,
    updated_at:new Date().toISOString()
  };
  if(payload.cnpj.length!==14)return toast('Confira o CNPJ');
  try{
    await saveClientFromForm();
    if(id){
      const old=orders.find(o=>o.id===id);
      await api(`/rest/v1/bko_orders?id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(payload)});
      if(norm(payload.status_pedido)==='aprovado'&&!old?.dashboard_synced_at)await syncApprovedOrder(id,payload);
      else if(old?.dashboard_synced_at)await syncApprovedEdit(id,old,payload)
    }else{
      payload.created_by=uid();
      const created=await api('/rest/v1/bko_orders',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
      const row=created?.[0];
      if(norm(payload.status_pedido)==='aprovado'&&row)await syncApprovedOrder(row.id,payload)
    }
    await loadAll();currentView='pedidos';render();toast('Pedido salvo ✓')
  }catch(err){console.error(err);toast(err.message)}
}
async function editOrder(id){const o=orders.find(x=>x.id===id);if(o)renderForm(o)}
function findPerson(name,state=dashboardState){return (state.people||[]).find(p=>norm(p.name)===norm(name))}
function findProduct(name,state=dashboardState){return (state.products||[]).find(p=>norm(p.name)===norm(name))}
function applyProduction(state,h,sign=1){const person=findPerson(h.personName,state),product=findProduct(h.productName,state);if(!person)throw new Error(`Consultor ${h.personName} não encontrado no Dashboard`);if(!product)throw new Error(`Produto ${h.productName} não encontrado no Dashboard`);person.realized=Number(person.realized||0)+sign*Number(h.revenue||0);product.realized=Number(product.realized||0)+sign*(product.money?Number(h.revenue||0):Number(h.qty||0));state.company.realized=Number(state.company.realized||0)+sign*Number(h.revenue||0);const team=(state.teams||[]).find(t=>norm(t.name)===norm(h.teamName||person.team));if(team)team.realized=Number(team.realized||0)+sign*Number(h.revenue||0)}
async function pushDashboardState(state){await api('/rest/v1/viva_state',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:1,data:state,updated_at:new Date().toISOString()})});dashboardState=state}
async function syncApprovedOrder(id,p){await loadDashboard();const state=JSON.parse(JSON.stringify(dashboardState));state.productionHistory=state.productionHistory||[];if(state.productionHistory.some(h=>h.bkoOrderId===id))return;const h={id:`bko-${id}`,bkoOrderId:id,source:'BKO',createdAt:new Date().toISOString(),personName:p.consultor,teamName:p.equipe,productName:p.dashboard_product,revenue:Number(p.valor_contrato||0),qty:Number(p.quantidade||0)};applyProduction(state,h,1);state.productionHistory.unshift(h);await pushDashboardState(state);await api(`/rest/v1/bko_orders?id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({dashboard_synced_at:new Date().toISOString(),dashboard_entry_id:h.id})});toast('Aprovado e enviado ao Dashboard ✓')}
async function syncApprovedEdit(id,old,p){if(norm(p.status_pedido)!=='aprovado')return;await loadDashboard();const state=JSON.parse(JSON.stringify(dashboardState));const h=(state.productionHistory||[]).find(x=>x.bkoOrderId===id||x.id===old.dashboard_entry_id);if(!h)return;applyProduction(state,h,-1);h.personName=p.consultor;h.teamName=p.equipe;h.productName=p.dashboard_product;h.revenue=Number(p.valor_contrato||0);h.qty=Number(p.quantidade||0);h.updatedAt=new Date().toISOString();applyProduction(state,h,1);await pushDashboardState(state);toast('Pedido e Dashboard atualizados ✓')}
function renderClients(){app.innerHTML=shell(`<div class="card section-card"><div class="section-title"><div><h2>Base de clientes</h2><p>É daqui que o CNPJ completa automaticamente a Razão Social.</p></div><button class="btn primary" onclick="newClient()">+ Cliente</button></div><div class="table-wrap"><table class="table"><thead><tr><th>CNPJ</th><th>Razão Social</th><th></th></tr></thead><tbody>${clients.length?clients.map(c=>`<tr><td>${esc(c.cnpj)}</td><td>${esc(c.razao_social)}</td><td><button class="btn" onclick="newClient('${c.id}')">Editar</button></td></tr>`).join(''):'<tr><td colspan="3"><div class="empty">A base vai sendo criada conforme os pedidos forem cadastrados.</div></td></tr>'}</tbody></table></div></div>`)}
function newClient(id=''){const c=clients.find(x=>x.id===id)||{};document.body.insertAdjacentHTML('beforeend',`<div class="modal-bg" id="clientModal"><div class="modal"><div class="modal-head"><h2>${id?'Editar':'Novo'} cliente</h2><button class="close" onclick="clientModal.remove()">×</button></div><div class="form-grid"><div class="field"><label>CNPJ</label><input id="mcCnpj" value="${esc(c.cnpj||'')}"></div><div class="field span2"><label>Razão Social</label><input id="mcRazao" value="${esc(c.razao_social||'')}"></div></div><div class="actions"><button class="btn" onclick="clientModal.remove()">Cancelar</button><button class="btn primary" onclick="saveClientModal('${id}')">Salvar</button></div></div></div>`)}
async function saveClientModal(id){const p={cnpj:cleanCnpj(mcCnpj.value),razao_social:mcRazao.value.trim(),updated_at:new Date().toISOString()};if(p.cnpj.length!==14||!p.razao_social)return toast('Informe CNPJ e Razão Social');if(id){await api(`/rest/v1/bko_clients?id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(p)})}else{p.created_by=uid();await api('/rest/v1/bko_clients',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(p)})}clientModal.remove();await loadClients();renderClients();toast('Cliente salvo ✓')}
function renderRules(){app.innerHTML=shell(`<div class="notice">Cadastre aqui regras fixas. Exemplo: se a modalidade tiver um vencimento padrão, o sistema preencherá automaticamente no pedido. Não cadastramos valores fictícios.</div><div class="settings-grid"><div class="card list-card"><div class="section-title"><div><h2>Regras de vencimento</h2><p>Modalidade → dia padrão.</p></div><button class="btn primary" onclick="addRule()">+ Regra</button></div>${rules.length?rules.map(r=>`<div class="list-row"><div><b>${esc(r.modalidade)}</b><br><small>${r.active===false?'Inativa':'Ativa'}</small></div><div>Dia <b>${esc(r.vencimento||'-')}</b></div><button class="btn danger" onclick="deleteRule('${r.id}')">Excluir</button></div>`).join(''):'<div class="empty">Nenhuma regra cadastrada ainda.</div>'}</div><div class="card list-card"><div class="section-title"><div><h2>Integração com Dashboard</h2><p>Consultores e produtos são lidos diretamente do Dashboard atual.</p></div></div><p><b>${consultants().length}</b> consultores ativos encontrados.</p><p><b>${products().length}</b> produtos/torres encontrados.</p><p style="color:var(--muted);line-height:1.6">Assim, quando você alterar consultores, equipes ou produtos no Dashboard, o Sistema BKO passa a enxergar a mesma estrutura.</p></div></div>`)}
function addRule(){document.body.insertAdjacentHTML('beforeend',`<div class="modal-bg" id="ruleModal"><div class="modal"><div class="modal-head"><h2>Nova regra</h2><button class="close" onclick="ruleModal.remove()">×</button></div><div class="form-grid"><div class="field span2"><label>Modalidade</label><select id="mrModalidade">${formOptions(['MÓVEL','BANDA LARGA','AVANÇADO','APARELHO','OUTRO'])}</select></div><div class="field"><label>Vencimento padrão</label><input id="mrVenc" type="number" min="1" max="31"></div></div><div class="actions"><button class="btn" onclick="ruleModal.remove()">Cancelar</button><button class="btn primary" onclick="saveRule()">Salvar</button></div></div></div>`)}
async function saveRule(){const p={modalidade:mrModalidade.value,vencimento:Number(mrVenc.value),active:true,updated_at:new Date().toISOString()};if(!p.vencimento)return toast('Informe o vencimento');await api('/rest/v1/bko_rules',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(p)});ruleModal.remove();await loadRules();renderRules();toast('Regra salva ✓')}
async function deleteRule(id){if(!confirm('Excluir esta regra?'))return;await api(`/rest/v1/bko_rules?id=eq.${id}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});await loadRules();renderRules()}
function isoDate(v){return v?new Date(v+'T12:00:00').toLocaleDateString('pt-BR'):'-'}
function reportFiltered(){
  const de=document.getElementById('rDe')?.value||'';
  const ate=document.getElementById('rAte')?.value||'';
  const cons=document.getElementById('rConsultor')?.value||'';
  const equipe=document.getElementById('rEquipe')?.value||'';
  const status=document.getElementById('rStatus')?.value||'';
  const prod=document.getElementById('rProduto')?.value||'';
  return orders.filter(o=>(!de||o.data_venda>=de)&&(!ate||o.data_venda<=ate)&&(!cons||norm(o.consultor)===norm(cons))&&(!equipe||norm(o.equipe)===norm(equipe))&&(!status||norm(o.status_pedido)===norm(status))&&(!prod||norm(o.dashboard_product||o.produto)===norm(prod)));
}
function uniqueSorted(vals){return [...new Set(vals.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'))}
function reportRows(list){if(!list.length)return '<tr><td colspan="11"><div class="empty">Nenhum pedido encontrado com esses filtros.</div></td></tr>';return list.map(o=>`<tr><td>${isoDate(o.data_venda)}</td><td>${esc(o.razao_social)}</td><td>${esc(o.cnpj)}</td><td>${esc(o.consultor)}</td><td>${esc(o.equipe||'-')}</td><td>${esc(o.modalidade||'-')}</td><td>${esc(o.dashboard_product||o.produto||'-')}</td><td>${Number(o.quantidade||0).toLocaleString('pt-BR')}</td><td>${money(o.valor_contrato)}</td><td><span class="badge ${statusClass(o.status_pedido)}">${esc(o.status_pedido)}</span></td><td>${esc(o.numero_pedido||'-')}</td></tr>`).join('')}
function groupSummary(list,key){const m={};for(const o of list){const k=(key(o)||'Não informado');if(!m[k])m[k]={name:k,pedidos:0,valor:0,quantidade:0,aprovados:0};m[k].pedidos++;m[k].valor+=Number(o.valor_contrato||0);m[k].quantidade+=Number(o.quantidade||0);if(norm(o.status_pedido)==='aprovado')m[k].aprovados++;}return Object.values(m).sort((a,b)=>b.valor-a.valor)}
function renderReports(){
  const cons=uniqueSorted(orders.map(o=>o.consultor));
  const equipes=uniqueSorted(orders.map(o=>o.equipe));
  const prods=uniqueSorted(orders.map(o=>o.dashboard_product||o.produto));
  app.innerHTML=shell(`<div class="card section-card report-filter"><div class="section-title"><div><h2>Relatórios BKO</h2><p>Visão geral da operação, por vendedor e detalhada por cliente/pedido.</p></div><div class="report-actions"><button class="btn" onclick="clearReportFilters()">Limpar filtros</button><button class="btn success" onclick="exportReportExcel('geral')">Exportar geral</button><button class="btn primary" onclick="exportReportExcel('detalhado')">Exportar detalhado</button></div></div><div class="report-filters"><div class="field"><label>De</label><input id="rDe" type="date" onchange="updateReports()"></div><div class="field"><label>Até</label><input id="rAte" type="date" onchange="updateReports()"></div><div class="field"><label>Consultor</label><select id="rConsultor" onchange="updateReports()"><option value="">Todos</option>${cons.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div><div class="field"><label>Equipe</label><select id="rEquipe" onchange="updateReports()"><option value="">Todas</option>${equipes.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div><div class="field"><label>Status</label><select id="rStatus" onchange="updateReports()"><option value="">Todos</option>${STATUSES.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div><div class="field"><label>Produto</label><select id="rProduto" onchange="updateReports()"><option value="">Todos</option>${prods.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div></div></div><div id="reportContent"></div>`);
  updateReports();
}
function updateReports(){
  const list=reportFiltered();
  const approved=list.filter(o=>norm(o.status_pedido)==='aprovado').length;
  const repro=list.filter(o=>norm(o.status_pedido).includes('reprov')).length;
  const cancel=list.filter(o=>norm(o.status_pedido).includes('cancel')).length;
  const pending=list.length-approved-repro-cancel;
  const total=list.reduce((a,o)=>a+Number(o.valor_contrato||0),0);
  const qtd=list.reduce((a,o)=>a+Number(o.quantidade||0),0);
  const uniqueClients=new Set(list.map(o=>cleanCnpj(o.cnpj)).filter(Boolean)).size;
  const bySeller=groupSummary(list,o=>o.consultor);
  const byProduct=groupSummary(list,o=>o.dashboard_product||o.produto||o.modalidade);
  const content=document.getElementById('reportContent'); if(!content)return;
  content.innerHTML=`<div class="grid report-kpis"><div class="card kpi"><small>Pedidos</small><strong>${list.length}</strong></div><div class="card kpi"><small>Clientes</small><strong>${uniqueClients}</strong></div><div class="card kpi"><small>Em andamento</small><strong>${pending}</strong></div><div class="card kpi"><small>Aprovados</small><strong>${approved}</strong></div><div class="card kpi"><small>Quantidade</small><strong>${qtd.toLocaleString('pt-BR')}</strong></div><div class="card kpi"><small>Valor total</small><strong class="money-kpi">${money(total)}</strong></div></div><div class="report-grid"><div class="card section-card"><div class="section-title"><div><h2>Por consultor</h2><p>Pedidos, aprovados e valor por vendedor.</p></div><button class="btn" onclick="exportReportExcel('consultores')">Exportar vendedores</button></div><div class="table-wrap"><table class="table report-summary"><thead><tr><th>Consultor</th><th>Pedidos</th><th>Aprovados</th><th>Quantidade</th><th>Valor</th></tr></thead><tbody>${bySeller.length?bySeller.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${x.pedidos}</td><td>${x.aprovados}</td><td>${x.quantidade.toLocaleString('pt-BR')}</td><td>${money(x.valor)}</td></tr>`).join(''):'<tr><td colspan="5"><div class="empty">Sem dados.</div></td></tr>'}</tbody></table></div></div><div class="card section-card"><div class="section-title"><div><h2>Por produto</h2><p>Distribuição operacional dos pedidos.</p></div></div><div class="table-wrap"><table class="table report-summary"><thead><tr><th>Produto</th><th>Pedidos</th><th>Aprovados</th><th>Quantidade</th><th>Valor</th></tr></thead><tbody>${byProduct.length?byProduct.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${x.pedidos}</td><td>${x.aprovados}</td><td>${x.quantidade.toLocaleString('pt-BR')}</td><td>${money(x.valor)}</td></tr>`).join(''):'<tr><td colspan="5"><div class="empty">Sem dados.</div></td></tr>'}</tbody></table></div></div></div><div class="card section-card"><div class="section-title"><div><h2>Clientes e pedidos</h2><p>Detalhamento completo do período selecionado.</p></div><span class="pill">${list.length} registro(s)</span></div><div class="table-wrap"><table class="table report-detail"><thead><tr><th>Data</th><th>Cliente</th><th>CNPJ</th><th>Consultor</th><th>Equipe</th><th>Modalidade</th><th>Produto</th><th>Qtd.</th><th>Valor</th><th>Status</th><th>Nº pedido</th></tr></thead><tbody>${reportRows(list)}</tbody></table></div></div>`;
}
function clearReportFilters(){['rDe','rAte','rConsultor','rEquipe','rStatus','rProduto'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});updateReports()}
function xmlEsc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function colName(n){let s='';while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s}
function sheetXml(rows){const body=rows.map((row,ri)=>`<row r="${ri+1}">${row.map((v,ci)=>{const ref=colName(ci+1)+(ri+1);if(typeof v==='number'&&Number.isFinite(v))return `<c r="${ref}"${ri===0?' s="1"':''}><v>${v}</v></c>`;return `<c r="${ref}" t="inlineStr"${ri===0?' s="1"':''}><is><t>${xmlEsc(v)}</t></is></c>`}).join('')}</row>`).join('');return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${body}</sheetData><autoFilter ref="A1:${colName(Math.max(1,rows[0]?.length||1))}${Math.max(1,rows.length)}"/></worksheet>`}
const CRC_TABLE=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=CRC_TABLE[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
function u16(n){return [n&255,(n>>>8)&255]} function u32(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]}
function zipStore(files){const enc=new TextEncoder(), parts=[], central=[];let offset=0;const now=new Date(),dosTime=((now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1))&0xffff,dosDate=(((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate())&0xffff;for(const f of files){const name=enc.encode(f.name),data=typeof f.data==='string'?enc.encode(f.data):f.data,crc=crc32(data);const local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(dosTime),...u16(dosDate),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...name]);parts.push(local,data);const cen=new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(dosTime),...u16(dosDate),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...name]);central.push(cen);offset+=local.length+data.length}const centralSize=central.reduce((a,x)=>a+x.length,0),centralOffset=offset,eocd=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(centralSize),...u32(centralOffset),...u16(0)]);return new Blob([...parts,...central,eocd],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}
function downloadXlsx(filename,sheets){const sheetEntries=sheets.map((s,i)=>({name:`xl/worksheets/sheet${i+1}.xml`,data:sheetXml(s.rows)}));const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xmlEsc(s.name.slice(0,31))}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;const workbookRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF6F2CFF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/></cellXfs></styleSheet>`;const files=[{name:'[Content_Types].xml',data:contentTypes},{name:'_rels/.rels',data:rels},{name:'xl/workbook.xml',data:workbook},{name:'xl/_rels/workbook.xml.rels',data:workbookRels},{name:'xl/styles.xml',data:styles},...sheetEntries];const blob=zipStore(files),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
function exportReportExcel(kind='detalhado'){const list=reportFiltered();const stamp=new Date().toISOString().slice(0,10);const sellerRows=[['Consultor','Pedidos','Aprovados','Quantidade','Valor Total'],...groupSummary(list,o=>o.consultor).map(x=>[x.name,x.pedidos,x.aprovados,x.quantidade,Number(x.valor||0)])];const statusRows=[['Status','Pedidos'],...STATUSES.map(st=>[st,list.filter(o=>norm(o.status_pedido)===norm(st)).length])];if(kind==='consultores'||kind==='geral'){downloadXlsx(`Relatorio-BKO-Geral-${stamp}.xlsx`,[{name:'Por Consultor',rows:sellerRows},{name:'Por Status',rows:statusRows}]);return toast('Relatório Excel gerado ✓')}const headers=['Data da Venda','Mês','Tramitação','Vendedor','Razão Social','CNPJ','Endereço/Instalação','Cidade','Representante','Contato','Email','Débito Automático?','Quality?','Vencimento','Tipo de Cliente','Produto','Tronco','Sub Produto','Sub Item','Delta','Outro','Quantidade','Valor Unitário','Valor Contrato','Simulação','Sistema Vivo','Status do Pedido','Cotação','Nº Pedido','Dt. Agendamento','Status de Entrega','Dt. Entrega','Observações','Previsão Comissão','Dt. Conclusão','Obs. Extras','Produto Dashboard','Enviado ao Dashboard'];const rows=[headers,...list.map(o=>[isoDate(o.data_venda),o.mes||monthName(o.data_venda),o.tramitacao||'',o.consultor||'',o.razao_social||'',o.cnpj||'',o.endereco_instalacao||'',o.cidade||'',o.representante||'',o.contato||'',o.email||'',o.debito_automatico||'',o.quality||'',o.vencimento||'',o.tipo_cliente||'',o.produto_planilha||o.modalidade||'',o.tronco||o.produto||'',o.sub_produto||o.subproduto||'',o.sub_item||'',o.delta||'',o.outro||'',Number(o.quantidade||0),Number(o.valor_unitario||0),Number(o.valor_contrato||0),o.simulacao||'',o.sistema_vivo||'',o.status_pedido||'',o.cotacao||'',o.numero_pedido||'',o.data_agendamento||'',o.status_entrega||'',o.data_entrega||'',o.observacoes||'',o.previsao_comissao||'',o.data_conclusao||'',o.obs_extras||'',o.dashboard_product||'',o.dashboard_synced_at?'SIM':'NÃO'])];downloadXlsx(`Relatorio-BKO-Detalhado-${stamp}.xlsx`,[{name:'Pedidos',rows},{name:'Por Consultor',rows:sellerRows},{name:'Por Status',rows:statusRows}]);toast('Relatório Excel gerado ✓')}

boot();
