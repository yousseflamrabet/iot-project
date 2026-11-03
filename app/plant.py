"""Isolated virtual electrical cabinet for the SME learning demonstrator.

All settings and values are INVENTED for teaching. No electrical control and no
connections to real-world equipment. Each circuit is mapped to an existing
simulated Modbus meter; a virtual switch changes its simulated register values.
"""
from __future__ import annotations

import math
import threading
import time
from datetime import datetime, timezone
from .modbus_config import POSTS

# circuit: (label, equipment type, nominal kW, power factor, defaults to ON)
# The 4 controllable devices on each substation are associated with units 1..4.
# Other virtual meters have autonomous simulated loads.
CIRCUIT_TYPES = [
    [('Grue portique', 'Levage de conteneurs', 94, .87, False),
     ('Éclairage du quai', 'Éclairage LED', 18, .97, True),
     ('Pompe hydraulique', 'Pompage', 43, .89, True),
     ('Ventilation locale', 'Ventilation', 15, .88, False)],
    [('Convoyeur à bandes', 'Convoyage', 63, .88, True),
     ('Projecteurs de zone', 'Éclairage LED', 22, .97, True),
     ('Compresseur', 'Air comprimé', 54, .85, False),
     ('Groupe de pompage', 'Pompage', 37, .88, False)],
    [('Portique secondaire', 'Levage de conteneurs', 86, .87, False),
     ('Éclairage de sécurité', 'Éclairage LED', 12, .97, True),
     ('Ventilation TGBT', 'Ventilation', 16, .9, True),
     ('Moteur de treuil', 'Motorisation', 55, .85, False)],
    [('Moteur de manutention', 'Motorisation', 73, .86, True),
     ('Éclairage atelier', 'Éclairage LED', 16, .96, True),
     ('Groupe froid', 'Réfrigération', 49, .9, False),
     ('Pompe incendie (test)', 'Pompage', 68, .84, False)],
    [('Charge industrielle A', 'Charge existante simulée', 57, .88, True),
     ('Éclairage ancien', 'Éclairage LED', 21, .95, True),
     ('Pompe de drainage', 'Pompage', 32, .88, False),
     ('Ventilation bâtiment', 'Ventilation', 14, .9, True)],
    [('Moteur de pompage', 'Pompage', 55, .87, True),
     ('Éclairage poste', 'Éclairage LED', 9, .96, True),
     ('Ventilation', 'Ventilation', 12, .9, False),
     ('Machine auxiliaire', 'Motorisation', 45, .85, False)],
]

SCENARIOS = {
    'normal': 'Activité normale',
    'rush': 'Pointe d’activité',
    'night': 'Mode nuit',
    'stop': 'Arrêt des charges pilotables',
}


class VirtualPlant:
    def __init__(self):
        self._lock = threading.RLock()
        self._circuits: dict[str, dict] = {}
        self._energy: dict[str, float] = {}
        self._last_ts: dict[str, float] = {}
        self._last_kw: dict[str, float] = {}
        self._last_action: str | None = None
        for i, (_name, count, _port) in enumerate(POSTS):
            for uid in range(1, count + 1):
                meter_id = f'P{i + 1:02d}-M{uid:02d}'
                self._energy[meter_id] = 9600.0 + (i + 1) * 211 + uid * 38
            for uid, (name, kind, rated_kw, pf, enabled) in enumerate(CIRCUIT_TYPES[i], 1):
                ident = f'P{i + 1:02d}-C{uid:02d}'
                self._circuits[ident] = {
                    'id': ident,
                    'meter_id': f'P{i + 1:02d}-M{uid:02d}',
                    'post_idx': i,
                    'post': POSTS[i][0],
                    'name': name,
                    'type': kind,
                    'rated_kw': rated_kw,
                    'power_factor': pf,
                    'enabled': enabled,
                    'switched_at': 0.0,
                }

    def _meter_kw(self, post_idx: int, unit_id: int, t: float) -> float:
        identifier = f'P{post_idx + 1:02d}-C{unit_id:02d}'
        c = self._circuits.get(identifier)
        seed = 101 * (post_idx + 1) + unit_id
        wave = 0.97 + 0.03 * math.sin(t / 16.0 + seed)
        if c is not None:
            if not c['enabled']:
                return 0.12 + 0.07 * (1 + math.sin(t / 23 + seed)) / 2  # meter idle
            # short start transient is visible in synthetic measurements only
            boost = 1.10 if 0 < t - c['switched_at'] < 5 else 1.0
            return c['rated_kw'] * wave * boost
        # Uncontrolled feeder: simulated base consumption that evolves gradually.
        return (7 + ((seed * 11) % 45)) * wave

    def _integrate_energy(self, post_idx: int, uid: int, t: float) -> str:
        meter_id = f'P{post_idx + 1:02d}-M{uid:02d}'
        previous = self._last_ts.get(meter_id, t)
        elapsed = max(0.0, min(t - previous, 86400.0))
        if elapsed:
            self._energy[meter_id] += self._last_kw.get(meter_id, 0.0) * elapsed / 3600
        self._last_ts[meter_id] = t
        self._last_kw[meter_id] = self._meter_kw(post_idx, uid, t)
        return meter_id

    def readings(self, post_idx: int, unit_id: int) -> list[float]:
        with self._lock:
            t = time.monotonic()
            meter_id = self._integrate_energy(post_idx, unit_id, t)
            power = self._last_kw[meter_id]
            seed = 101 * (post_idx + 1) + unit_id
            c = self._circuits.get(f'P{post_idx + 1:02d}-C{unit_id:02d}')
            power_factor = c['power_factor'] if c else 0.89 + 0.04 * math.sin(t / 36 + seed)
            voltage = 231 + 2.2 * math.sin(t / 28 + seed) - max(0.0, power - 40) * .038
            current = (power * 1000) / (3 * voltage * power_factor)
            freq = 50 + 0.035 * math.sin(t / 17 + seed)
            thd_v = 1.8 + 0.4 * abs(math.sin(t / 27 + seed))
            thd_i = 2.0 + 0.6 * abs(math.sin(t / 19 + seed)) + (0.45 if power > 60 else 0)
            return [round(voltage, 3), round(current, 3), round(power, 3),
                    round(self._energy[meter_id], 3), round(power_factor, 4),
                    round(freq, 4), round(thd_v, 3), round(thd_i, 3)]

    def switch(self, circuit_id: str, enabled: bool) -> dict:
        if type(enabled) is not bool:
            raise ValueError('enabled doit être un booléen')
        with self._lock:
            if circuit_id not in self._circuits:
                raise ValueError('Circuit inconnu')
            c = self._circuits[circuit_id]
            self._integrate_energy(c['post_idx'], int(c['meter_id'].split('-M')[1]), time.monotonic())
            c['enabled'] = enabled
            c['switched_at'] = time.monotonic() if enabled else 0.0
            self._last_action = f"{c['post']} · {c['name']} : {'ON' if enabled else 'OFF'}"
            return {'id': circuit_id, 'meter_id': c['meter_id'], 'enabled': enabled,
                    'message': self._last_action}

    def scenario(self, name: str) -> list[str]:
        if name not in SCENARIOS:
            raise ValueError('Scénario inconnu')
        modified = []
        with self._lock:
            t = time.monotonic()
            for c in self._circuits.values():
                if name == 'rush':
                    enabled = True
                elif name == 'stop':
                    enabled = False
                elif name == 'night':
                    enabled = 'Éclairage' in c['type'] or 'Éclairage' in c['name']
                else:
                    enabled = CIRCUIT_TYPES[c['post_idx']][int(c['meter_id'].split('-M')[1]) - 1][4]
                uid = int(c['meter_id'].split('-M')[1])
                if c['enabled'] != enabled:
                    self._integrate_energy(c['post_idx'], uid, t)
                    c['enabled'] = enabled
                    c['switched_at'] = t if enabled else 0.0
                    modified.append(c['meter_id'])
            self._last_action = f'Scénario : {SCENARIOS[name]}'
        return modified

    def snapshot(self) -> dict:
        with self._lock:
            now = time.monotonic()
            posts = []
            for i, (name, count, port) in enumerate(POSTS):
                circuits = []
                total_kw = 0.0
                for uid in range(1, len(CIRCUIT_TYPES[i]) + 1):
                    c = self._circuits[f'P{i + 1:02d}-C{uid:02d}']
                    inst_kw = self._meter_kw(i, uid, now)
                    total_kw += inst_kw
                    circuits.append({k: v for k, v in c.items() if k not in ('post_idx', 'switched_at')}
                                    | {'instant_kw': round(inst_kw, 2)})
                posts.append({'name': name, 'port': port, 'meter_count': count,
                              'circuits': circuits, 'controlled_kw': round(total_kw, 2),
                              'enabled_count': sum(c['enabled'] for c in circuits)})
            return {'simulation': True, 'as_of': datetime.now(timezone.utc).isoformat(timespec='seconds'),
                    'posts': posts, 'circuits_total': len(self._circuits),
                    'circuits_enabled': sum(c['enabled'] for c in self._circuits.values()),
                    'scenarios': [{'id': k, 'name': v} for k, v in SCENARIOS.items()],
                    'last_action': self._last_action}


plant = VirtualPlant()
