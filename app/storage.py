"""SQLite persistence for the isolated demonstration."""
import sqlite3, os, threading
from datetime import datetime, timezone
from .modbus import POSTS
DB_PATH=os.environ.get('SME_DB',os.path.join(os.path.dirname(__file__),'..','sme_demo.sqlite3'))
_lock=threading.RLock()

def connect():
    conn=sqlite3.connect(DB_PATH,timeout=20)
    conn.row_factory=sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA busy_timeout=5000')
    return conn

def init_db():
    with connect() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY,name TEXT UNIQUE,port INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS meters (id TEXT PRIMARY KEY,post_id INTEGER NOT NULL,unit_id INTEGER NOT NULL,origin TEXT NOT NULL,status TEXT DEFAULT 'online',last_seen TEXT, FOREIGN KEY(post_id) REFERENCES posts(id));
        CREATE TABLE IF NOT EXISTS measurements (id INTEGER PRIMARY KEY AUTOINCREMENT,meter_id TEXT NOT NULL, ts TEXT NOT NULL,voltage_v REAL,current_a REAL,power_kw REAL,energy_kwh REAL,power_factor REAL,frequency_hz REAL,thd_v_pct REAL,thd_i_pct REAL,quality TEXT NOT NULL DEFAULT 'good');
        CREATE INDEX IF NOT EXISTS idx_measurements_meter_ts ON measurements(meter_id,ts);
        CREATE INDEX IF NOT EXISTS idx_measurements_ts ON measurements(ts);
        CREATE TABLE IF NOT EXISTS alerts (id INTEGER PRIMARY KEY AUTOINCREMENT,meter_id TEXT NOT NULL,post TEXT NOT NULL,kind TEXT NOT NULL,severity TEXT NOT NULL,message TEXT NOT NULL,created_at TEXT NOT NULL,acknowledged_at TEXT, resolved_at TEXT, UNIQUE(meter_id,kind,acknowledged_at));
        CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT,ts TEXT NOT NULL,action TEXT NOT NULL,detail TEXT);
        ''')
        # Migration des bases V2 existantes : auparavant « acquitter » clôturait
        # implicitement l'alerte. Les nouvelles versions distinguent les deux états.
        alert_columns = {r[1] for r in db.execute('PRAGMA table_info(alerts)')}
        if 'resolved_at' not in alert_columns:
            db.execute('ALTER TABLE alerts ADD COLUMN resolved_at TEXT')
            db.execute('UPDATE alerts SET resolved_at=acknowledged_at WHERE acknowledged_at IS NOT NULL')
        for i,(name,count,port) in enumerate(POSTS,1):
            db.execute('INSERT OR IGNORE INTO posts(id,name,port) VALUES(?,?,?)',(i,name,port))
            for uid in range(1,count+1):
                ident=f'P{i:02d}-M{uid:02d}'
                db.execute('INSERT OR IGNORE INTO meters(id,post_id,unit_id,origin) VALUES(?,?,?,?)', (ident,i,uid,'existing' if name=='PT 1' else 'new'))

def utc_now(): return datetime.now(timezone.utc).isoformat(timespec='seconds')

def collect_one(meter_id,fields,error=None):
    now=utc_now()
    with _lock, connect() as db:
        if error:
            db.execute('UPDATE meters SET status=? WHERE id=?',('offline',meter_id))
            upsert_alert(db,meter_id,'communication','critical','Communication Modbus interrompue',now)
        else:
            db.execute('UPDATE meters SET status=?,last_seen=? WHERE id=?',('online',now,meter_id))
            db.execute('''INSERT INTO measurements(meter_id,ts,voltage_v,current_a,power_kw,energy_kwh,power_factor,frequency_hz,thd_v_pct,thd_i_pct)
                  VALUES(?,?,?,?,?,?,?,?,?,?)''',(meter_id,now,*[fields[k] for k in ('voltage_v','current_a','power_kw','energy_kwh','power_factor','frequency_hz','thd_v_pct','thd_i_pct')]))
            resolve_alert(db,meter_id,'communication',now)
            if fields['power_kw'] > 58:
                upsert_alert(db,meter_id,'high_power','warning',f"Puissance élevée : {fields['power_kw']:.1f} kW (seuil démo : 58 kW)",now)
            else:
                resolve_alert(db,meter_id,'high_power',now)

def resolve_alert(db,meter_id,kind,now):
    db.execute('UPDATE alerts SET resolved_at=? WHERE meter_id=? AND kind=? AND resolved_at IS NULL',
               (now,meter_id,kind))

def upsert_alert(db,meter_id,kind,severity,message,now):
    found=db.execute('SELECT id FROM alerts WHERE meter_id=? AND kind=? AND resolved_at IS NULL',
                     (meter_id,kind)).fetchone()
    if found:
        db.execute('UPDATE alerts SET message=? WHERE id=?',(message,found['id']))
    else:
        post=db.execute('SELECT posts.name FROM meters JOIN posts ON posts.id=meters.post_id WHERE meters.id=?',(meter_id,)).fetchone()['name']
        db.execute('INSERT INTO alerts(meter_id,post,kind,severity,message,created_at) VALUES (?,?,?,?,?,?)',(meter_id,post,kind,severity,message,now))

def rows(sql, params=()):
    with connect() as db:
        return [dict(x) for x in db.execute(sql,params).fetchall()]

def execute(sql,params=()):
    with _lock,connect() as db:
        db.execute(sql,params)
