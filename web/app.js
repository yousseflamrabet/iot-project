/* SME Marsa Maroc - self-contained offline demonstrator. Synthetic data only. */
const $ = q => document.querySelector(q);
const fmt = (n,d=1) => n===null||n===undefined?'—':Number(n).toLocaleString('fr-FR',{maximumFractionDigits:d,minimumFractionDigits:d});
const safe = text => String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state={page:'overview',overview:null,meters:[],analytics:null,alerts:[],selectedPost:'all',selectedFaultMeter:'P01-M01',alertView:'active',selectedMeter:null,lastRender:0};
let refreshing=false, detailRequest=0, detailHistory=[];
let renderedPage=null, renderedPost=null, renderedAlertView=null, renderedAlertsSignature='';
let detailReturnFocus=null;
const names={overview:'Vue d’ensemble',posts:'Postes électriques',meters:'Compteurs',analytics:'Analyse énergétique',alerts:'Alertes',reports:'Rapports et exports',settings:'Système'};
async function api(path,opts){const res=await fetch(path,opts);if(!res.ok)throw Error('HTTP '+res.status);return res.json()}
function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(window._t);window._t=setTimeout(()=>t.classList.remove('show'),3500)}
function heading(eyebrow,title,desc,action=''){return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="description">${desc}</p></div>${action}</div>`}
function stat(label,value,unit,caption,icon){return `<div class="stat"><div class="stat-top"><span>${label}</span><div class="stat-icon">${icon}</div></div><div class="stat-value">${value} <small>${unit||''}</small></div><div class="stat-caption">${caption}</div></div>`}
function tag(ok,text){return `<span class="badge ${ok?'':'bad'}">${text}</span>`}
function postsGrid(posts){return `<div class="posts-grid">${posts.map(p=>`<div class="post-card" role="button" tabindex="0" aria-label="Voir les compteurs du poste ${safe(p.name)}" data-open-post="${safe(p.name)}"><div class="post-top"><div class="post-symbol">⚡</div><span class="state ${p.online<p.meter_count?'offline':''}">${p.online===p.meter_count?'EN LIGNE':'ATTENTION'}</span></div><h3>${safe(p.name)}</h3><p>${p.origin==='existing'?'12 compteurs existants intégrés':'Nouveaux compteurs simulés'}</p><div class="post-power">${fmt(p.power_kw)} <small>kW</small></div><div class="post-divider"></div><div class="post-bottom"><span>◉ ${p.online}/${p.meter_count} connectés</span><span>Voir le poste →</span></div></div>`).join('')}</div>`}
function postTable(posts){return `<div class="table-scroll"><table><thead><tr><th>Poste</th><th>Compteurs</th><th>En ligne</th><th>Puissance</th><th>Couverture</th></tr></thead><tbody>${posts.map(p=>`<tr><td><strong>${p.name}</strong></td><td>${p.meter_count}</td><td>${tag(p.online===p.meter_count,`${p.online} / ${p.meter_count}`)}</td><td>${fmt(p.power_kw)} kW</td><td>${Math.round(100*p.online/p.meter_count)} %</td></tr>`).join('')}</tbody></table></div>`}
function renderOverview(){let o=state.overview,a=state.analytics;return heading('TABLEAU DE BORD','Vue d’ensemble','Suivi synthétique de l’activité énergétique des six postes du port d’Agadir.',`<button class="btn" data-action="refresh">↻ Actualiser les données</button>`)+`<div class="cards">${stat('Puissance totale',fmt(o.power_kw),'kW','Valeur instantanée simulée','⚡')}${stat('Compteurs connectés',o.online+' / '+o.meter_count,'','État des communications Modbus','◉')}${stat('Postes surveillés','6','','Postes électriques du démonstrateur','▤')}${stat('Alertes actives',o.active_alerts,'','Seuils et erreurs de communication','♧')}</div><div class="grid-two"><section class="panel"><div class="panel-head"><div><h2>Évolution de la puissance</h2><p>Historique global · données simulées</p></div><span class="state">● ACTUALISÉ</span></div><div class="panel-body"><div class="chart-wrap"><canvas id="mainChart"></canvas></div></div></section><section class="panel"><div class="panel-head"><div><h2>Répartition par poste</h2><p>Puissance instantanée</p></div></div><div class="panel-body">${o.posts.map(p=>`<div style="margin:0 0 18px"><div style="display:flex;justify-content:space-between;font-size:12px"><strong>${p.name}</strong><span>${fmt(p.power_kw)} kW</span></div><div class="progress"><div style="width:${Math.max(1,p.power_kw/Math.max(...o.posts.map(x=>x.power_kw),1)*100)}%"></div></div></div>`).join('')}</div></section></div><section class="panel"><div class="panel-head"><div><h2>Postes électriques</h2><p>Situation des équipements dans les six postes</p></div><button class="btn" data-page-switch="posts">Tout voir →</button></div><div class="panel-body">${postsGrid(o.posts)}</div></section>`}
function renderPosts(){return heading('INFRASTRUCTURE','Postes électriques','6 postes et 58 points de comptage dans la simulation.')+`<div class="warning-box">Les quantités de la simulation suivent 46 compteurs neufs + 12 compteurs existants. Le tableau d’inventaire du CPS semble recenser 59 emplacements : cet écart doit être clarifié avant tout projet réel.</div>`+postsGrid(state.overview.posts)+`<div class="panel" style="margin-top:20px"><div class="panel-head"><div><h2>Inventaire des postes</h2><p>Disponibilité et puissance des équipements simulés</p></div></div>${postTable(state.overview.posts)}</div>`}
function renderMeters(){let m=state.meters.filter(x=>state.selectedPost==='all'||x.post===state.selectedPost);return heading('ACQUISITION MODBUS','Compteurs électriques','Mesures lues depuis les passerelles Modbus TCP locales.',`<div class="inline-actions"><select class="filter" id="postFilter"><option value="all">Tous les postes</option>${state.overview.posts.map(p=>`<option value="${p.name}" ${p.name===state.selectedPost?'selected':''}>${p.name}</option>`).join('')}</select></div>`)+`<section class="panel"><div class="panel-head"><div><h2>Registre des compteurs</h2><p>${m.length} compteur(s) · rafraîchissement automatique</p></div></div><div class="table-scroll"><table><thead><tr><th>ID</th><th>Poste</th><th>Origine</th><th>Statut</th><th>U (V)</th><th>I (A)</th><th>P (kW)</th><th>Facteur de puissance</th><th></th></tr></thead><tbody>${m.map(x=>`<tr data-meter-row="${x.id}"><td class="meter-id">${x.id}</td><td>${x.post}</td><td>${x.origin==='existing'?'Existant':'Nouveau'}</td><td data-meter-field="status">${tag(x.status==='online',x.status==='online'?'En ligne':'Hors ligne')}</td><td data-meter-field="voltage_v">${fmt(x.voltage_v)}</td><td data-meter-field="current_a">${fmt(x.current_a)}</td><td data-meter-field="power_kw">${fmt(x.power_kw)}</td><td data-meter-field="power_factor">${fmt(x.power_factor,3)}</td><td><button class="btn" data-meter="${x.id}">Détails</button></td></tr>`).join('')}</tbody></table></div></section>`}
function renderAnalytics(){let a=state.analytics;return heading('PERFORMANCE ÉNERGÉTIQUE','Analyse énergétique','Indicateurs, références et tendances d’une simulation pédagogique.')+`<div class="warning-box"><strong>Important :</strong> les IPE et la situation énergétique de référence ci-dessous sont illustratifs. Leurs formules et périodes devront être validées par le responsable énergie de la DEPA pour une application ISO 50001 réelle.</div><section class="panel"><div class="panel-head"><div><h2>Indicateurs de performance énergétique (IPE)</h2><p>Valeurs d’illustration · calculs non contractuels</p></div></div><div class="panel-body"><div class="indicator-grid">${a.ipe.map(i=>`<div class="indicator"><h3>${safe(i.name)}</h3><strong>${fmt(i.value)} <small>${safe(i.unit)}</small></strong><p>${safe(i.note)}</p></div>`).join('')}</div></div></section><section class="panel"><div class="panel-head"><div><h2>Historique de puissance</h2><p>Mesures agrégées depuis les compteurs simulés</p></div></div><div class="panel-body"><div class="chart-wrap"><canvas id="mainChart"></canvas></div></div></section><section class="panel"><div class="panel-head"><div><h2>Répartition énergétique</h2><p>Comparaison des puissances instantanées par poste</p></div></div><div class="panel-body">${state.overview.posts.map(p=>`<div style="margin-bottom:15px;font-size:12px"><div style="display:flex;justify-content:space-between"><strong>${p.name}</strong><span>${fmt(p.power_kw)} kW</span></div><div class="progress"><div style="width:${Math.max(1,p.power_kw/Math.max(...state.overview.posts.map(x=>x.power_kw),1)*100)}%"></div></div></div>`).join('')}</div></section>`}
function renderAlerts(){
  const active=state.alertView==='active';
  return heading('INCIDENTS & SEUILS','Alertes','Suivi des anomalies de puissance et des interruptions Modbus.',
    `<div class="inline-actions"><select class="filter" id="alertFilter" aria-label="Affichage des alertes"><option value="active" ${active?'selected':''}>Alertes en cours</option><option value="history" ${!active?'selected':''}>Historique complet</option></select><button class="btn" data-action="refresh">↻ Actualiser</button></div>`)
    +`<div class="warning-box">Seuil de puissance supérieur à 58 kW par compteur : valeur arbitraire de démonstration. « Acquitter » signifie avoir pris connaissance du problème : l'alerte reste en cours jusqu'à la disparition de la cause.</div>
    <section class="panel"><div class="panel-head"><div><h2>${active?'Alertes en cours':'Historique des alertes'}</h2><p>${state.alerts.length} résultat(s) · ${state.overview.active_alerts} alerte(s) en cours</p></div></div>
    ${state.alerts.length?`<div class="table-scroll"><table><thead><tr><th>Priorité</th><th>Compteur</th><th>Poste</th><th>Message</th><th>Déclenchement</th><th>État</th><th>Action</th></tr></thead><tbody>${state.alerts.map(a=>`<tr><td><span class="badge ${a.severity==='critical'?'bad':'warn'}">${a.severity==='critical'?'CRITIQUE':'ATTENTION'}</span></td><td class="meter-id">${safe(a.meter_id)}</td><td>${safe(a.post)}</td><td>${safe(a.message)}</td><td>${safe(a.created_at.replace('T',' ').slice(0,19))}</td><td>${a.resolved_at?tag(true,'Résolue'):a.acknowledged_at?tag(true,'Acquittée'):'À traiter'}</td><td>${!a.resolved_at&&!a.acknowledged_at?`<button class="btn" data-ack="${a.id}">Acquitter</button>`:'—'}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">✓ ${active?'Aucune alerte en cours':'Aucune alerte enregistrée'}</div>`}</section>`;
}
function renderReports(){
  const reportItems=[
    ['Synthèse multi-postes','Puissances, états et totaux de chaque poste','posts'],
    ['Disponibilité des compteurs','État Modbus, dernière connexion et inventaire','availability'],
    ['Suivi des indicateurs','IPE fictifs et référence énergétique illustrative','indicators']
  ];
  return heading('EXPORT & RAPPORTS','Rapports et exports','Extraire les mesures et trois rapports JSON distincts.')
    +`<section class="panel"><div class="panel-head"><div><h2>Export de l'historique</h2><p>Télécharger les 20 000 dernières mesures enregistrées</p></div></div>
    <div class="panel-body"><div class="export-box"><div><h3>Historique des mesures · CSV</h3><p>Compteur, horodatage UTC, tension, courant, puissance, énergie, fréquence et harmoniques.</p></div><a class="btn primary" href="/api/export.csv" download>↓ Télécharger CSV</a></div></div></section>
    <section class="panel"><div class="panel-head"><div><h2>Rapports énergétiques — démonstration</h2><p>Chaque bouton exporte un fichier différent au format JSON</p></div></div>
    <div class="panel-body"><div class="indicator-grid">${reportItems.map(([title,description,key])=>`<div class="indicator"><h3>${title}</h3><strong style="font-size:20px">${title}</strong><p>${description}</p><button class="btn" data-report="${key}">↓ Exporter JSON</button></div>`).join('')}</div></div></section>
    <div class="warning-box">Les rapports PDF/Excel planifiés, les régressions, les diagrammes Pareto/Sankey et les calculs ISO 50001 validés restent hors de cette simulation.</div>`;
}
function renderSettings(){const o=state.overview;return heading('CONFIGURATION','Système et simulation','Paramètres de démonstration, état des services et tests de défaillance.')+`<div class="cards">${stat('Passerelles Modbus','6','','Ports 15021 à 15026','⌁')}${stat('Intervalle de collecte',o.collection_interval_seconds,'s','Acquisition automatique','◷')}${stat('Points simulés',o.meter_count,'','46 neufs + 12 existants','▦')}${stat('Hébergement','Local','','127.0.0.1 uniquement','▣')}</div><section class="panel"><div class="panel-head"><div><h2>Simuler une panne de compteur</h2><p>Le simulateur arrêtera de répondre aux requêtes Modbus pour le compteur choisi.</p></div></div><div class="panel-body"><div class="inline-actions"><select id="faultMeter" class="filter">${state.meters.map(m=>`<option value="${m.id}" ${m.id===state.selectedFaultMeter?'selected':''}>${m.id} — ${m.post}${m.status==='offline'?' (hors ligne)':''}</option>`).join('')}</select><button class="btn danger" data-action="fault-on">Simuler une panne</button><button class="btn" data-action="fault-off">Rétablir la communication</button></div><p class="description" style="margin-top:15px">Après quelques secondes, les alertes reflètent la perte ou la reprise de communication.</p></div></section><section class="panel"><div class="panel-head"><div><h2>Architecture de démonstration</h2><p>Composants exécutés sur votre ordinateur</p></div></div><div class="panel-body"><pre>6 serveurs Modbus TCP (ports 15021–15026)
       ↓ lecture FC03 / registres de mesures
Collecteur Python (intervalle configurable)
       ↓
Base SQLite (mesures, états, alertes, journal)
       ↓
API HTTP Python + export CSV
       ↓
Dashboard Web HTML / CSS / JavaScript</pre></div></section><div class="warning-box">Ce prototype ne comporte pas de comptes utilisateurs, AD/LDAP, TLS industriel, sauvegarde automatisée, redondance, ni validation de cybersécurité IEC 62443. Il est volontairement limité à l’ordinateur local et ne doit pas être exposé sur Internet.</div>`}
function pageHTML(){switch(state.page){case'overview':return renderOverview();case'posts':return renderPosts();case'meters':return renderMeters();case'analytics':return renderAnalytics();case'alerts':return renderAlerts();case'reports':return renderReports();case'settings':return renderSettings()}}
function drawChart(canvas,series){if(!canvas)return;const rect=canvas.getBoundingClientRect();let width=Math.max(250,rect.width),height=Math.max(180,rect.height);const dpr=devicePixelRatio||1;canvas.width=width*dpr;canvas.height=height*dpr;let ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);let pad={l:48,r:12,t:14,b:30};let w=width-pad.l-pad.r,h=height-pad.t-pad.b;const values=series.map(x=>x.power_kw);const max=Math.max(100,...values)*1.12;ctx.font='11px Segoe UI';ctx.textAlign='right';ctx.fillStyle='#94a2b3';ctx.strokeStyle='#e9eff5';ctx.lineWidth=1;for(let j=0;j<=4;j++){let y=pad.t+h*j/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(width-pad.r,y);ctx.stroke();ctx.fillText(fmt(max*(1-j/4),0),pad.l-10,y+4)}if(values.length<2){ctx.textAlign='center';ctx.font='13px Segoe UI';ctx.fillText('Collecte en cours : les premières mesures arrivent...',width/2,height/2);return}const point=(v,i)=>[pad.l+(i/(values.length-1))*w,pad.t+h-(v/max)*h];ctx.beginPath();values.forEach((v,i)=>{const [x,y]=point(v,i);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.strokeStyle='#1689cb';ctx.lineWidth=2.6;ctx.stroke();ctx.lineTo(pad.l+w,pad.t+h);ctx.lineTo(pad.l,pad.t+h);ctx.closePath();ctx.fillStyle='#1689cb15';ctx.fill();ctx.fillStyle='#71869b';ctx.font='10px Segoe UI';ctx.textAlign='center';let idx=[0,Math.floor((values.length-1)/2),values.length-1];idx.forEach(i=>{let d=series[i]?.time||'';ctx.fillText(d.slice(11)||d.slice(0,10),point(values[i],i)[0],height-9)})}
async function refresh(){
  if(refreshing)return;
  refreshing=true;
  try{
    const [overview,meters,analytics,alerts]=await Promise.all([
      api('/api/overview'),api('/api/meters'),api('/api/analytics'),api('/api/alerts?state='+state.alertView)
    ]);
    Object.assign(state,{overview,meters,analytics,alerts});
    if(!state.meters.some(m=>m.id===state.selectedFaultMeter))state.selectedFaultMeter=state.meters[0]?.id||'';
    $('#navAlerts').textContent=overview.active_alerts;
    render();
    if(state.selectedMeter)await updateMeterDetail();
  }catch(e){console.error(e);toast('Impossible de récupérer les mesures : '+e.message)}
  finally{refreshing=false}
}
function alertSignature(){return state.alerts.map(a=>[a.id,a.acknowledged_at,a.resolved_at].join(':')).join('|')}
function updatePostCards(){
  const maximum=Math.max(1,...state.overview.posts.map(p=>p.power_kw));
  document.querySelectorAll('.post-card[data-open-post]').forEach(card=>{
    const p=state.overview.posts.find(x=>x.name===card.dataset.openPost);if(!p)return;
    card.querySelector('.post-power').innerHTML=`${fmt(p.power_kw)} <small>kW</small>`;
    const status=card.querySelector('.state');status.classList.toggle('offline',p.online<p.meter_count);
    status.textContent=p.online===p.meter_count?'EN LIGNE':'ATTENTION';
    const connection=card.querySelector('.post-bottom span');
    if(connection)connection.textContent=`◉ ${p.online}/${p.meter_count} connectés`;
  });
  document.querySelectorAll('.progress > div').forEach((el,i)=>{
    const p=state.overview.posts[i];if(p)el.style.width=`${Math.max(1,p.power_kw/maximum*100)}%`;
  });
}
function updateVisiblePage(){
  if(state.page==='overview'){
    const fields=document.querySelectorAll('#page .cards .stat-value');
    if(fields[0])fields[0].innerHTML=`${fmt(state.overview.power_kw)} <small>kW</small>`;
    if(fields[1])fields[1].textContent=`${state.overview.online} / ${state.overview.meter_count}`;
    if(fields[3])fields[3].textContent=state.overview.active_alerts;
    const summary=document.querySelectorAll('#page .panel')[1];
    summary?.querySelectorAll('.panel-body > div').forEach((el,i)=>{
      const p=state.overview.posts[i],right=el.querySelector('span');
      if(p&&right)right.textContent=`${fmt(p.power_kw)} kW`;
    });
    updatePostCards();
  }else if(state.page==='posts'){
    updatePostCards();
    document.querySelectorAll('#page tbody tr').forEach((tr,i)=>{
      const p=state.overview.posts[i];if(!p)return;
      const cells=tr.cells;if(cells.length<5)return;
      cells[2].innerHTML=tag(p.online===p.meter_count,`${p.online} / ${p.meter_count}`);
      cells[3].textContent=`${fmt(p.power_kw)} kW`;
      cells[4].textContent=`${Math.round(100*p.online/p.meter_count)} %`;
    });
  }else if(state.page==='meters'){
    state.meters.forEach(m=>{
      const tr=document.querySelector(`[data-meter-row="${m.id}"]`);
      if(!tr)return;
      const fields={voltage_v:fmt(m.voltage_v),current_a:fmt(m.current_a),power_kw:fmt(m.power_kw),power_factor:fmt(m.power_factor,3)};
      for(const [field,value] of Object.entries(fields)){
        const td=tr.querySelector(`[data-meter-field="${field}"]`);if(td)td.textContent=value;
      }
      const status=tr.querySelector('[data-meter-field="status"]');
      if(status)status.innerHTML=tag(m.status==='online',m.status==='online'?'En ligne':'Hors ligne');
    });
  }else if(state.page==='analytics'){
    const values=document.querySelectorAll('#page .indicator-grid .indicator strong');
    state.analytics.ipe.forEach((indicator,i)=>{
      if(values[i])values[i].innerHTML=`${fmt(indicator.value)} <small>${safe(indicator.unit)}</small>`;
    });
    updatePostCards();
  }else if(state.page==='alerts'){
    if(alertSignature()!==renderedAlertsSignature){render(true);return}
    const rows=document.querySelectorAll('#page tbody tr');
    rows.forEach((tr,i)=>{
      const a=state.alerts[i];if(a&&tr.cells.length>3)tr.cells[3].textContent=a.message;
    });
    const label=document.querySelector('#page section.panel .panel-head p');
    if(label)label.textContent=`${state.alerts.length} résultat(s) · ${state.overview.active_alerts} alerte(s) en cours`;
  }else if(state.page==='settings'){
    const select=$('#faultMeter');if(select){
      for(const option of select.options){
        const m=state.meters.find(x=>x.id===option.value);
        if(m)option.textContent=`${m.id} — ${m.post}${m.status==='offline'?' (hors ligne)':''}`;
      }
    }
  }
  const chart=$('#mainChart');
  if(chart)requestAnimationFrame(()=>drawChart(chart,state.analytics.series));
}
function render(force=false){
  if(!state.overview)return;
  if(!force && renderedPage===state.page && renderedPost===state.selectedPost
     && renderedAlertView===state.alertView){
    updateVisiblePage();return;
  }
  $('#crumbName').textContent=names[state.page];
  $('#page').innerHTML=pageHTML();
  renderedPage=state.page;renderedPost=state.selectedPost;
  renderedAlertView=state.alertView;renderedAlertsSignature=alertSignature();
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.page===state.page));
  const chart=$('#mainChart');if(chart)requestAnimationFrame(()=>drawChart(chart,state.analytics.series));
}
function switchPage(p){closeMeterDetail();state.page=p;render();window.scrollTo({top:0,behavior:'smooth'})}
function closeMeterDetail(){
  const modal=$('#meterModal');if(!modal||modal.hidden)return;
  state.selectedMeter=null;detailRequest++;detailHistory=[];
  modal.hidden=true;document.body.classList.remove('dialog-open');
  const previous=detailReturnFocus;detailReturnFocus=null;
  if(previous?.isConnected)previous.focus({preventScroll:true});
}
async function showMeter(meterId,returnElement){
  const meter=state.meters.find(m=>m.id===meterId);
  if(!meter){toast('Compteur introuvable');return}
  state.selectedMeter=meterId;detailReturnFocus=returnElement||null;
  const modal=$('#meterModal');modal.hidden=false;document.body.classList.add('dialog-open');
  $('#detailTitle').textContent='Compteur '+meter.id+' · '+meter.post;
  $('#detailOrigin').textContent=meter.origin==='existing'?'Compteur existant intégré':'Compteur neuf simulé';
  $('#detailMetrics').innerHTML='<p class="description">Chargement des mesures…</p>';
  $('#detailFreshness').textContent='Chargement de l’historique…';
  $('#detailProtocol').textContent='Modbus TCP/IP · FC03 · huit Float32';
  $('#detailClose').focus({preventScroll:true});
  await updateMeterDetail();
}
async function updateMeterDetail(){
  const meterId=state.selectedMeter;
  if(!meterId)return;
  const meter=state.meters.find(m=>m.id===meterId);
  if(!meter){closeMeterDetail();return}
  const myRequest=++detailRequest;
  const values=[['Tension',meter.voltage_v,'V'],['Courant',meter.current_a,'A'],['Puissance',meter.power_kw,'kW'],['Fréquence',meter.frequency_hz,'Hz'],['Énergie cumulée',meter.energy_kwh,'kWh'],['Facteur de puissance',meter.power_factor,''],['THD tension',meter.thd_v_pct,'%'],['THD courant',meter.thd_i_pct,'%']];
  $('#detailMetrics').innerHTML=values.map(([label,value,unit])=>`<div class="mini-stat"><span>${label}</span><strong>${fmt(value,2)} <small>${unit}</small></strong></div>`).join('');
  $('#detailState').textContent=meter.status==='online'?'● EN LIGNE':'○ HORS LIGNE';
  $('#detailState').className='badge '+(meter.status==='online'?'':'bad');
  $('#detailFreshness').textContent=meter.ts
    ?'Dernière mesure reçue : '+meter.ts.replace('T',' ').slice(0,19)+' UTC'+(meter.status!=='online'?' · données anciennes, compteur hors ligne':'')
    :'Aucune mesure reçue';
  const matched=state.overview.posts.find(p=>p.name===meter.post);
  $('#detailProtocol').textContent=`Passerelle : 127.0.0.1:${matched?POST_PORT(matched.name):'—'} · Unit ID ${meter.unit_id} · FC03 · huit Float32`;
  try{
    const history=await api('/api/history?meter='+encodeURIComponent(meterId)+'&limit=180');
    if(myRequest!==detailRequest || meterId!==state.selectedMeter)return;
    detailHistory=history.map(x=>({power_kw:x.power_kw,time:x.ts}));
    drawChart($('#detailChart'),detailHistory);
    $('#detailSamples').textContent=history.length+' mesures archivées affichées';
  }catch(error){if(myRequest===detailRequest)$('#detailSamples').textContent='Erreur historique : '+error.message}
}
function POST_PORT(postName){const names=['PT Y','PT X','PT Z','PT 4','PT 1','PT 7'];return 15021+names.indexOf(postName)}
function downloadJSON(filename,payload){
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function reportJSON(type){
  const base={generated_at:new Date().toISOString(),project:'SME Marsa Maroc — démonstration',disclaimer:'DONNÉES SYNTHÉTIQUES NON CONTRACTUELLES'};
  if(type==='posts')downloadJSON('sme_rapport_postes.json',{...base,type:'synthese_postes',total_power_kw:state.overview.power_kw,posts:state.overview.posts});
  else if(type==='availability')downloadJSON('sme_rapport_disponibilite.json',{...base,type:'disponibilite_compteurs',total:state.overview.meter_count,online:state.overview.online,offline:state.overview.offline,meters:state.meters.map(m=>({id:m.id,post:m.post,status:m.status,last_seen:m.last_seen,origin:m.origin}))});
  else if(type==='indicators')downloadJSON('sme_rapport_indicateurs.json',{...base,type:'indicateurs_illustratifs',reference_kw:state.analytics.baseline_kw,disclaimer_indicators:state.analytics.baseline_disclaimer,indicators:state.analytics.ipe});
  else throw Error('Type de rapport inconnu');
}
async function fault(enabled){
  const meter_id=state.selectedFaultMeter;
  await api('/api/demo/fault',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({meter_id,enabled})});
  await refresh();
  toast(enabled?'Panne simulée sur '+meter_id+' : communication interrompue.':'Communication rétablie sur '+meter_id+'.');
}
document.addEventListener('click',async e=>{
  if(e.target.id==='detailClose'||e.target.id==='meterModal'){closeMeterDetail();return}
  const target=e.target.closest('[data-page],[data-page-switch],[data-open-post],[data-meter],[data-ack],[data-action],[data-report]');
  if(!target)return;
  try{
    if(target.dataset.page)switchPage(target.dataset.page);
    else if(target.dataset.pageSwitch)switchPage(target.dataset.pageSwitch);
    else if(target.dataset.openPost){state.selectedPost=target.dataset.openPost;switchPage('meters')}
    else if(target.dataset.meter)await showMeter(target.dataset.meter,target);
    else if(target.dataset.ack){
      target.disabled=true;
      await api('/api/alerts/ack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:Number(target.dataset.ack)})});
      await refresh();toast('Alerte acquittée : elle reste active jusqu’à résolution du problème.');
    }
    else if(target.dataset.action==='refresh'){await refresh();toast('Données actualisées')}
    else if(target.dataset.action==='fault-on')await fault(true);
    else if(target.dataset.action==='fault-off')await fault(false);
    else if(target.dataset.report){reportJSON(target.dataset.report);toast('Rapport JSON exporté')}
  }catch(err){target.disabled=false;toast('Erreur : '+err.message)}
});
document.addEventListener('change',e=>{
  if(e.target.id==='postFilter'){state.selectedPost=e.target.value;render(true)}
  else if(e.target.id==='faultMeter')state.selectedFaultMeter=e.target.value;
  else if(e.target.id==='alertFilter'){state.alertView=e.target.value;refresh()}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')closeMeterDetail();
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-open-post]')){
    e.preventDefault();state.selectedPost=e.target.dataset.openPost;switchPage('meters');
  }
});
function updateClock(){$('#clock').textContent=new Date().toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'})}
updateClock();setInterval(updateClock,1000);refresh();setInterval(refresh,3000);window.addEventListener('resize',()=>{let c=$('#mainChart');if(c&&state.analytics)drawChart(c,state.analytics.series);if(state.selectedMeter&&detailHistory.length)drawChart($('#detailChart'),detailHistory)});
