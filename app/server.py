"""Local-only SME simulation HTTP service. Python standard library only."""
import csv, io, json, os, threading, time
from datetime import datetime, timezone, timedelta
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path
from .modbus import POSTS, read_meter, start_gateways, set_fault
from .plant import plant
from .storage import init_db,collect_one,rows,execute,utc_now

ROOT=Path(__file__).resolve().parents[1]
WEB=ROOT/'web'
HTTP_HOST='127.0.0.1'
HTTP_PORT=int(os.environ.get('SME_PORT','8088'))
COLLECTION_INTERVAL=int(os.environ.get('SME_INTERVAL','8'))
STARTED=time.time()


def acquisition_loop():
    while True:
        start=time.monotonic()
        for i,(_,count,port) in enumerate(POSTS,1):
            for uid in range(1,count+1):
                ident=f'P{i:02d}-M{uid:02d}'
                try: collect_one(ident,read_meter(port,uid))
                except (OSError,ValueError,TimeoutError) as exc: collect_one(ident,None,error=str(exc))
        time.sleep(max(1,COLLECTION_INTERVAL-(time.monotonic()-start)))


def capture_meters(meter_ids):
    """Immediately refresh the virtual meters changed by a control action."""
    for meter_id in dict.fromkeys(meter_ids):
        index, uid = (int(part) for part in meter_id[1:].split("-M"))
        port = POSTS[index - 1][2]
        try:
            collect_one(meter_id, read_meter(port, uid))
        except (OSError, ValueError, TimeoutError) as exc:
            collect_one(meter_id, None, error=str(exc))


def meter_records():
    return rows('''SELECT m.id,m.unit_id,m.origin,m.status,m.last_seen,p.name post,p.id post_id,
      x.ts,x.voltage_v,x.current_a,x.power_kw,x.energy_kwh,x.power_factor,x.frequency_hz,x.thd_v_pct,x.thd_i_pct
      FROM meters m JOIN posts p ON p.id=m.post_id
      LEFT JOIN measurements x ON x.id=(SELECT MAX(z.id) FROM measurements z WHERE z.meter_id=m.id)
      ORDER BY p.id,m.unit_id''')


def overview():
    meters=meter_records()
    posts=[]
    for name,_,_ in POSTS:
        group=[m for m in meters if m['post']==name]
        posts.append({'name':name,'meter_count':len(group),'online':sum(m['status']=='online' for m in group),
            'power_kw':round(sum(m['power_kw'] or 0 for m in group if m['status']=='online'),2),
            'energy_kwh':round(sum(m['energy_kwh'] or 0 for m in group),2),
            'origin':'existing' if name=='PT 1' else 'new'})
    online=sum(m['status']=='online' for m in meters)
    alerts=rows('SELECT COUNT(*) total FROM alerts WHERE resolved_at IS NULL')[0]['total']
    return {'as_of':utc_now(),'project':'SME — Marsa Maroc | DÉMONSTRATION',
            'meter_count':len(meters),'online':online,'offline':len(meters)-online,
            'power_kw':round(sum(m['power_kw'] or 0 for m in meters if m['status']=='online'),2),
            'active_alerts':alerts,'posts':posts,'collection_interval_seconds':COLLECTION_INTERVAL,
            'warning':'Données synthétiques : les équipements du port ne sont pas connectés.'}


def analytics():
    # Une seule lecture (la plus récente) par compteur et par minute.
    # L'ancienne moyenne de toutes les lectures ×58 surpondérait les compteurs
    # interrogés plusieurs fois et créait des pics artificiels.
    history=rows('''SELECT latest.period, ROUND(SUM(m.power_kw),2) total_power,
                  COUNT(*) meters_reporting
          FROM (SELECT substr(ts,1,16) period, meter_id, MAX(id) last_id
                FROM measurements WHERE ts >= ?
                GROUP BY substr(ts,1,16), meter_id) latest
          JOIN measurements m ON m.id=latest.last_id
          GROUP BY latest.period ORDER BY latest.period DESC LIMIT 120''',
          ((datetime.now(timezone.utc)-timedelta(hours=12)).isoformat(timespec='seconds'),))
    history.reverse()
    over=overview()
    baseline_kw=1800.0 # illustrative value, MUST be validated by energy manager
    current=over['power_kw']
    return {'series':[{'time':r['period'],'power_kw':r['total_power'],'meters_reporting':r['meters_reporting']} for r in history],
            'ipe':[{'name':'Puissance instantanée totale','value':current,'unit':'kW','note':'Somme des puissances instantanées'},
                   {'name':'Disponibilité des compteurs','value':round(over['online']/58*100,1),'unit':'%','note':'Compteurs joignables / 58'},
                   {'name':'Écart à la référence illustrative','value':round((current-baseline_kw)/baseline_kw*100,1),'unit':'%','note':'Référence fictive de 1 800 kW, non validée ISO 50001'}],
            'baseline_kw':baseline_kw,'baseline_disclaimer':'SER et IPE de démonstration uniquement. Méthodes officielles à valider avec DEPA.'}


class Handler(BaseHTTPRequestHandler):
    server_version='SME-Demo/1.0'
    def log_message(self,format,*args):
        if not self.path.startswith('/api/'): return
        super().log_message(format,*args)
    def send_bytes(self,data,mime='application/json; charset=utf-8',status=200,filename=None):
        self.send_response(status)
        self.send_header('Content-Type',mime)
        self.send_header('Content-Length',str(len(data)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Content-Security-Policy',"default-src 'self' 'unsafe-inline' data:; connect-src 'self'; img-src 'self' data:")
        if filename: self.send_header('Content-Disposition',f'attachment; filename="{filename}"')
        self.end_headers()
        try: self.wfile.write(data)
        except (ConnectionAbortedError, BrokenPipeError): pass
    def json(self,payload,status=200): self.send_bytes(json.dumps(payload,ensure_ascii=False).encode(),status=status)
    def do_GET(self):
        url=urlparse(self.path); path=url.path; query=parse_qs(url.query)
        try:
            if path=='/api/overview': return self.json(overview())
            if path=='/api/plant':
                snapshot = plant.snapshot()
                measured = {m['id']: m for m in meter_records()}
                for post in snapshot['posts']:
                    for circuit in post['circuits']:
                        meter = measured.get(circuit['meter_id'], {})
                        circuit['measured_kw'] = meter.get('power_kw')
                        circuit['measured_v'] = meter.get('voltage_v')
                        circuit['measured_a'] = meter.get('current_a')
                        circuit['measured_pf'] = meter.get('power_factor')
                        circuit['measured_energy_kwh'] = meter.get('energy_kwh')
                        circuit['measured_at'] = meter.get('ts')
                        circuit['meter_status'] = meter.get('status', 'offline')
                return self.json(snapshot)
            if path=='/api/meters':
                result=meter_records(); post=query.get('post',['all'])[0]
                if post!='all': result=[m for m in result if m['post']==post]
                return self.json(result)
            if path=='/api/alerts':
                state=query.get('state',['active'])[0]
                clause='WHERE resolved_at IS NULL' if state=='active' else ''
                return self.json(rows(f'SELECT * FROM alerts {clause} ORDER BY id DESC LIMIT 200'))
            if path=='/api/analytics': return self.json(analytics())
            if path=='/api/history':
                meter_id=query.get('meter',['P01-M01'])[0]
                if not any(meter_id==f'P{i:02d}-M{uid:02d}' for i,(_,n,_) in enumerate(POSTS,1) for uid in range(1,n+1)):
                    return self.json({'error':'Compteur inconnu'},404)
                limit=min(400,max(1,int(query.get('limit',['120'])[0])))
                return self.json(rows('SELECT * FROM measurements WHERE meter_id=? ORDER BY id DESC LIMIT ?', (meter_id,limit))[::-1])
            if path=='/api/audit': return self.json(rows('SELECT * FROM audit_log ORDER BY id DESC LIMIT 50'))
            if path=='/api/health': return self.json({'ok':True,'uptime_s':int(time.time()-STARTED),'simulation':True,'gateways':[p for _,_,p in POSTS]})
            if path=='/api/export.csv':
                data=rows('SELECT * FROM (SELECT * FROM measurements ORDER BY id DESC LIMIT 20000) ORDER BY id ASC')
                buff=io.StringIO(); cols=['meter_id','ts','voltage_v','current_a','power_kw','energy_kwh','power_factor','frequency_hz','thd_v_pct','thd_i_pct','quality']
                writer=csv.DictWriter(buff,fieldnames=cols,extrasaction='ignore');writer.writeheader();writer.writerows(data)
                return self.send_bytes(('\ufeff'+buff.getvalue()).encode('utf-8'),'text/csv; charset=utf-8',filename='sme_marsa_maroc_mesures_demo.csv')
            if path.startswith('/api/'): return self.json({'error':'Not found'},404)
            if path=='/':path='/index.html'
            file=(WEB/path.lstrip('/')).resolve()
            if WEB not in file.parents or not file.is_file(): return self.send_bytes(b'Not found','text/plain',404)
            mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml'}.get(file.suffix,'application/octet-stream')
            return self.send_bytes(file.read_bytes(),mime)
        except (ValueError,TypeError): self.json({'error':'Paramètre incorrect'},400)
        except Exception as exc: self.json({'error':'Internal error','detail':str(exc)},500)
    def do_POST(self):
        path=urlparse(self.path).path
        if path not in ('/api/demo/fault','/api/alerts/ack','/api/plant/switch','/api/plant/scenario'): return self.json({'error':'Not found'},404)
        try:
            origin=self.headers.get('Origin')
            if origin and origin not in (f'http://localhost:{HTTP_PORT}',f'http://127.0.0.1:{HTTP_PORT}'):
                return self.json({'error':'Origin non autorisée'},403)
            content_length=int(self.headers.get('Content-Length',0))
            if content_length>10000: return self.json({'error':'Taille excessive'},413)
            data=json.loads(self.rfile.read(content_length))
            if path=='/api/plant/switch':
                circuit_id = str(data.get('circuit_id', ''))
                enabled = data.get('enabled')
                result = plant.switch(circuit_id, enabled)
                capture_meters([result['meter_id']])
                execute('INSERT INTO audit_log(ts,action,detail) VALUES(?,?,?)',
                        (utc_now(),'virtual_switch',result['message']))
                return self.json({'ok':True, **result})
            if path=='/api/plant/scenario':
                scenario_id = str(data.get('scenario',''))
                updated = plant.scenario(scenario_id)
                capture_meters(updated)
                execute('INSERT INTO audit_log(ts,action,detail) VALUES(?,?,?)',
                        (utc_now(),'virtual_scenario',scenario_id))
                return self.json({'ok':True,'scenario':scenario_id,'meters_updated':len(updated)})
            if path=='/api/demo/fault':
                meter_id=str(data.get('meter_id',''))
                known=rows('SELECT id FROM meters WHERE id=?',(meter_id,))
                if not known:return self.json({'error':'Compteur inconnu'},404)
                enabled=bool(data.get('enabled',True));set_fault(meter_id,enabled)
                capture_meters([meter_id])  # Un test de panne est visible immédiatement.
                execute('INSERT INTO audit_log(ts,action,detail) VALUES(?,?,?)',(utc_now(),'simulation_fault',f'{meter_id} enabled={enabled}'))
                return self.json({'ok':True,'meter_id':meter_id,'fault_enabled':enabled})
            aid=int(data.get('id',0))
            active=rows('SELECT id,acknowledged_at FROM alerts WHERE id=? AND resolved_at IS NULL',(aid,))
            if not active: return self.json({'error':'Alerte active introuvable'},404)
            if active[0]['acknowledged_at']: return self.json({'ok':True,'already_acknowledged':True})
            execute('UPDATE alerts SET acknowledged_at=? WHERE id=? AND resolved_at IS NULL',(utc_now(),aid))
            execute('INSERT INTO audit_log(ts,action,detail) VALUES(?,?,?)',(utc_now(),'ack_alert',str(aid)))
            return self.json({'ok':True,'acknowledged':True})
        except (ValueError,TypeError,json.JSONDecodeError):return self.json({'error':'Requête invalide'},400)

def main():
    init_db()
    servers=start_gateways()
    print('✓ 6 passerelles Modbus TCP simulées :',', '.join(str(p) for _,_,p in POSTS),flush=True)
    threading.Thread(target=acquisition_loop,daemon=True,name='collector').start()
    http=ThreadingHTTPServer((HTTP_HOST,HTTP_PORT),Handler)
    print(f'✓ Tableau de bord : http://127.0.0.1:{HTTP_PORT}',flush=True)
    # Sous Windows, ouvrir le navigateur seulement APRES le démarrage du serveur.
    if os.environ.get('SME_OPEN_BROWSER')=='1':
        import webbrowser
        threading.Timer(0.6,lambda: webbrowser.open(f'http://127.0.0.1:{HTTP_PORT}')).start()
    print('✓ Démonstration uniquement — aucune connexion au réseau industriel.',flush=True)
    try:http.serve_forever()
    except KeyboardInterrupt:pass
    finally:
        http.server_close()
        for srv in servers:srv.shutdown()
