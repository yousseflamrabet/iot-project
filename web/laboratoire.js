/* Independent front-end: controls VIRTUAL circuits via local demo HTTP API.
   Never connects to industrial equipment; Modbus is simulated on loopback. */
const element = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, chr => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[chr]));
const number = (n, decimals=1) => n!==null && n!==undefined && n!=='' && Number.isFinite(Number(n)) ? Number(n).toLocaleString('fr-FR',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}) : '—';
const chartPoints = new Map();
let model = null;
let overview = null;
let chosenPost = 0;
let chosenCircuit = null;
let busy = false;
let refreshing = false;
let lastAudit = [];
let toastTimer;
let mutationEpoch=0;
function showToast(message){ const el=element('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3300); }
async function request(url, options){const response=await fetch(url,{cache:'no-store',...options});if(!response.ok){let msg;try{msg=(await response.json()).error}catch{}throw new Error(msg||`Erreur HTTP ${response.status}`)}return response.json()}
function postAction(url, payload){return request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})}
function selectedPost(){return model?.posts[chosenPost]}
function iconFor(c){return c.type.includes('Éclairage')?'☼':c.type.includes('Ventilation')?'❋':c.type.includes('Pompage')?'⇧':c.type.includes('Levage')?'⚙':'◈'}
function renderNav(){
  const nav=element('postNav');
  if(nav.children.length!==model.posts.length){
    nav.innerHTML=model.posts.map((p,i)=>`<button class="post-nav-item" data-post="${i}" aria-current="false"><span class="post-num">${i+1}</span><span><b>${esc(p.name)}</b><small>${p.meter_count} compteurs</small></span><span class="count">0/4</span></button>`).join('');
  }
  nav.querySelectorAll('[data-post]').forEach((button,i)=>{
    button.classList.toggle('active',chosenPost===i);
    button.setAttribute('aria-current',chosenPost===i?'page':'false');
    button.querySelector('.count').textContent=model.posts[i].enabled_count+'/4';
  });
}
function renderMetrics(){let active=model.circuits_enabled;let totalPower=model.posts.reduce((sum,p)=>sum+p.controlled_kw,0);
  element('metrics').innerHTML=`<div class="metric"><span>Équipements commandables</span><strong>${model.circuits_total}</strong><small>Sur 6 postes simulés</small></div>
    <div class="metric"><span>Charges actives</span><strong>${active} / ${model.circuits_total}</strong><small>État des interrupteurs virtuels</small></div>
    <div class="metric"><span>Puissance des charges contrôlées</span><strong>${number(totalPower)} <small>kW</small></strong><small>Simulation physique simplifiée</small></div>
    <div class="metric"><span>Compteurs reçus</span><strong>${overview?.online ?? '—'} / 58</strong><small>Lecture Modbus TCP locale</small></div>`;
}
function renderCabinet(){
  const p=selectedPost();if(!p)return;
  element('cabinetTitle').textContent=`Armoire TGBT · ${p.name}`;
  element('postShort').textContent=p.name;
  element('enabledCount').textContent=`${p.enabled_count} / ${p.circuits.length} actifs`;
  element('gatewayStatus').innerHTML=`<i></i> MODBUS PORT ${p.port}`;
  if(!chosenCircuit || !p.circuits.some(c=>c.id===chosenCircuit))chosenCircuit=p.circuits[0].id;
  const parent=element('circuits');
  const changePost=parent.dataset.currentPost!==p.name || parent.children.length!==p.circuits.length;
  if(changePost){
    parent.innerHTML=p.circuits.map(c=>`<article class="circuit" data-select="${esc(c.id)}" tabindex="0" role="group" aria-label="${esc(c.name)}"><div class="breaker"><div class="led"></div><small>OFF</small></div><div class="circuit-name">${iconFor(c)} ${esc(c.name)}</div><div class="circuit-kind">${esc(c.type)}</div><div class="circuit-power">— <span>kW</span></div><div class="circuit-meter">${esc(c.meter_id)}</div><button class="switch" data-switch="${esc(c.id)}" type="button" aria-label="Activer ${esc(c.name)}">▶ DÉMARRER</button></article>`).join('');
    parent.dataset.currentPost=p.name;
  }
  // Met à jour les données sur les mêmes éléments HTML au lieu de remplacer
  // les boutons pendant un clic (ancienne cause d'interactions manquées).
  p.circuits.forEach((c,i)=>{
    const card=parent.children[i],button=card.querySelector('[data-switch]');
    card.classList.toggle('powered',!!c.enabled);
    card.classList.toggle('active',chosenCircuit===c.id);
    card.querySelector('.breaker small').textContent=c.enabled?'ON':'OFF';
    card.querySelector('.circuit-power').innerHTML=`${number(c.measured_kw)} <span>kW</span>`;
    card.querySelector('.circuit-meter').textContent=`${c.meter_id} · ${c.meter_status==='online'?'MESURÉ':'HORS LIGNE'}`;
    button.classList.toggle('on',!!c.enabled);
    button.dataset.enabled=c.enabled?'false':'true';
    button.disabled=busy;
    button.setAttribute('aria-label',`${c.enabled?'Arrêter':'Démarrer'} ${c.name}`);
    button.textContent=c.enabled?'■ ARRÊTER':'▶ DÉMARRER';
  });
  renderTelemetry();
}
function renderTelemetry(){const p=selectedPost();const c=p?.circuits.find(x=>x.id===chosenCircuit);if(!c)return;element('meterHeader').textContent=`${c.meter_id} · ${c.name}`;
  const fields=[['Puissance',c.measured_kw,'kW',1],['Courant',c.measured_a,'A',1],['Tension',c.measured_v,'V',1],['Facteur de puissance',c.measured_pf,'',2],['Énergie cumulée',c.measured_energy_kwh,'kWh',2],['Charge nominale',c.rated_kw,'kW',0]];
  element('telemetry').innerHTML=`<div class="telemetry-head">COMPTEUR <b>${esc(c.meter_id)}</b> · ${c.meter_status==='online'?'● EN LIGNE':'○ HORS LIGNE'}</div><div class="telemetry-grid">${fields.map(([label,value,unit,dec])=>`<div class="telemetry-item"><small>${label}</small><strong>${number(value,dec)} <span>${unit}</span></strong></div>`).join('')}</div><div class="freshness">Dernière mesure reçue : ${esc(c.measured_at||'aucune')} (UTC) · lecture Modbus FC03</div>`;
}
function renderScenarios(){
  const styles={normal:['↺','Valeurs de départ'],rush:['⚡','Toutes les charges ON'],night:['☾','Éclairage uniquement'],stop:['■','Toutes les charges OFF']};
  const panel=element('scenarios');
  if(panel.children.length!==model.scenarios.length){
    panel.innerHTML=model.scenarios.map(s=>`<button class="scenario-btn" data-scenario="${esc(s.id)}" type="button"><b>${styles[s.id][0]} ${esc(s.name)}</b><small>${styles[s.id][1]}</small></button>`).join('');
  }
  panel.querySelectorAll('button').forEach(button=>button.disabled=busy);
}
function renderEvents(){
  const data=lastAudit.filter(x=>x.action==='virtual_switch'||x.action==='virtual_scenario').slice(0,7);
  const markup=data.length?data.map(x=>`<div class="event"><span class="event-icon">${x.action==='virtual_switch'?'⏻':'⚡'}</span><span class="event-detail">${esc(x.detail)}</span><span class="event-time">${esc(x.ts.slice(11,19))}</span></div>`).join(''):'<div class="empty">Aucune commande effectuée. Active un équipement pour commencer.</div>';
  if(element('events').innerHTML!==markup)element('events').innerHTML=markup;
}
function drawTrend(){const p=selectedPost();if(!p)return;let current=p.controlled_kw;let data=chartPoints.get(p.name)||[];
  if(!data.length || Date.now()-data.at(-1).at>1000){data.push({at:Date.now(),value:current});data=data.slice(-45);chartPoints.set(p.name,data)}
  element('postTrendValue').textContent=`${number(current)} kW`;
  const canvas=element('trend');const w=Math.max(200,canvas.getBoundingClientRect().width);const h=Math.max(120,canvas.getBoundingClientRect().height);const scale=window.devicePixelRatio||1;canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.clearRect(0,0,w,h);const pad=13;const min=Math.max(0,Math.min(...data.map(d=>d.value))*0.7-8);const max=Math.max(min+25,...data.map(d=>d.value))*1.1;const span=Math.max(1,max-min);
  ctx.strokeStyle='#244457';ctx.lineWidth=1;for(let i=0;i<4;i++){let y=pad+(h-2*pad)*i/3;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
  if(data.length<2){data=[{at:0,value:current},{at:1,value:current}]}
  const points=data.map((d,i)=>({x:pad+i*(w-2*pad)/(data.length-1),y:h-pad-(d.value-min)/span*(h-2*pad)}));
  let gradient=ctx.createLinearGradient(0,0,0,h);gradient.addColorStop(0,'#35d9c030');gradient.addColorStop(1,'#35d9c000');ctx.beginPath();ctx.moveTo(points[0].x,h-pad);points.forEach(pt=>ctx.lineTo(pt.x,pt.y));ctx.lineTo(points.at(-1).x,h-pad);ctx.closePath();ctx.fillStyle=gradient;ctx.fill();
  ctx.beginPath();points.forEach((pt,i)=>i?ctx.lineTo(pt.x,pt.y):ctx.moveTo(pt.x,pt.y));ctx.strokeStyle='#42d5b7';ctx.lineWidth=2.5;ctx.stroke();let last=points.at(-1);ctx.beginPath();ctx.arc(last.x,last.y,4,0,Math.PI*2);ctx.fillStyle='#76ebc8';ctx.fill();
}
function paint(){if(!model)return;renderNav();renderMetrics();renderCabinet();renderScenarios();renderEvents();drawTrend()}
async function refresh(){if(busy||refreshing)return;refreshing=true;const epoch=mutationEpoch;try{const [plantData,overviewData,auditData]=await Promise.all([request('/api/plant'),request('/api/overview'),request('/api/audit')]);if(epoch!==mutationEpoch||busy)return;model=plantData;overview=overviewData;lastAudit=auditData;paint()}catch(error){showToast('Erreur de communication : '+error.message)}finally{refreshing=false}}
async function actSwitch(id,enabled){if(busy)return;busy=true;mutationEpoch++;paint();try{await postAction('/api/plant/switch',{circuit_id:id,enabled});await refreshForced();showToast(`${enabled?'Démarrage':'Arrêt'} simulé · Le compteur Modbus a été mis à jour.`)}catch(error){showToast(error.message)}finally{busy=false;paint()}}
async function actScenario(name){if(busy)return;busy=true;mutationEpoch++;paint();try{const result=await postAction('/api/plant/scenario',{scenario:name});await refreshForced();showToast(`Scénario appliqué : ${result.meters_updated} compteurs actualisés.`)}catch(error){showToast(error.message)}finally{busy=false;paint()}}
async function refreshForced(){const [plantData,overviewData,auditData]=await Promise.all([request('/api/plant'),request('/api/overview'),request('/api/audit')]);model=plantData;overview=overviewData;lastAudit=auditData}
document.addEventListener('click',e=>{const sw=e.target.closest('[data-switch]');if(sw){chosenCircuit=sw.dataset.switch;actSwitch(sw.dataset.switch,sw.dataset.enabled==='true');return}const sc=e.target.closest('[data-scenario]');if(sc){actScenario(sc.dataset.scenario);return}const post=e.target.closest('[data-post]');if(post){chosenPost=Number(post.dataset.post);chosenCircuit=null;paint();return}const circuit=e.target.closest('[data-select]');if(circuit){chosenCircuit=circuit.dataset.select;paint()}});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-select]')){e.preventDefault();chosenCircuit=e.target.dataset.select;paint()}});
window.addEventListener('resize',drawTrend);
function clock(){element('clock').textContent=new Date().toLocaleString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
clock();setInterval(clock,1000);refresh();setInterval(refresh,2000);
