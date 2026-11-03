"""Alert/measurement regression tests, no external packages."""
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from app import storage

FIELDS = dict(voltage_v=230.0,current_a=90.0,power_kw=70.0,energy_kwh=800.0,
              power_factor=0.92,frequency_hz=50.0,thd_v_pct=2.2,thd_i_pct=2.5)


class AlertLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        self.old_path=storage.DB_PATH
        storage.DB_PATH=str(Path(self.folder.name)/'test.sqlite3')
        storage.init_db()

    def tearDown(self):
        storage.DB_PATH=self.old_path
        self.folder.cleanup()

    def test_acknowledgement_does_not_close_ongoing_incident(self):
        storage.collect_one('P01-M01',FIELDS)
        alerts=storage.rows("SELECT * FROM alerts WHERE resolved_at IS NULL AND kind='high_power'")
        self.assertEqual(len(alerts),1)
        aid=alerts[0]['id']
        storage.execute('UPDATE alerts SET acknowledged_at=? WHERE id=?',(storage.utc_now(),aid))
        storage.collect_one('P01-M01',dict(FIELDS,power_kw=72.0))
        still_open=storage.rows("SELECT * FROM alerts WHERE resolved_at IS NULL AND kind='high_power'")
        self.assertEqual(len(still_open),1)
        self.assertEqual(still_open[0]['id'],aid)
        self.assertIsNotNone(still_open[0]['acknowledged_at'])
        storage.collect_one('P01-M01',dict(FIELDS,power_kw=35.0))
        self.assertEqual(len(storage.rows('SELECT * FROM alerts WHERE resolved_at IS NULL')),0)
        self.assertIsNotNone(storage.rows('SELECT resolved_at FROM alerts WHERE id=?',(aid,))[0]['resolved_at'])

    def test_offline_and_return_resolves_communication_alert(self):
        storage.collect_one('P06-M01',None,error='Connexion refusée')
        alert=storage.rows("SELECT * FROM alerts WHERE kind='communication' AND resolved_at IS NULL")
        self.assertEqual(len(alert),1)
        self.assertEqual(storage.rows("SELECT status FROM meters WHERE id='P06-M01'")[0]['status'],'offline')
        storage.collect_one('P06-M01',dict(FIELDS,power_kw=25))
        self.assertEqual(storage.rows("SELECT status FROM meters WHERE id='P06-M01'")[0]['status'],'online')
        self.assertEqual(len(storage.rows("SELECT * FROM alerts WHERE kind='communication' AND resolved_at IS NULL")),0)

    def test_legacy_schema_migration_resolves_old_acknowledged_alerts(self):
        old=storage.DB_PATH
        legacy_db=str(Path(self.folder.name)/'legacy.sqlite3')
        conn=sqlite3.connect(legacy_db)
        conn.execute('CREATE TABLE alerts(id INTEGER PRIMARY KEY, meter_id TEXT, post TEXT,kind TEXT,severity TEXT,message TEXT,created_at TEXT,acknowledged_at TEXT,UNIQUE(meter_id,kind,acknowledged_at))')
        conn.execute("INSERT INTO alerts VALUES(1,'P01-M01','PT Y','high_power','warning','anc.','2026-11-03','2026-11-03')")
        conn.commit();conn.close()
        try:
            storage.DB_PATH=legacy_db
            storage.init_db()
            row=storage.rows('SELECT acknowledged_at,resolved_at FROM alerts')[0]
            self.assertEqual(row['resolved_at'],row['acknowledged_at'])
        finally:
            storage.DB_PATH=old


if __name__=='__main__':unittest.main()
