"""Behavior tests for the virtual electrical cabinet and the Modbus linkage."""
import threading
import unittest
from app.plant import VirtualPlant, plant
from app.modbus import ThreadedServer, ModbusHandler, read_meter, set_fault


class VirtualPlantTests(unittest.TestCase):
    def setUp(self):
        self.sim = VirtualPlant()

    def test_24_switchable_circuits_across_six_posts(self):
        data = self.sim.snapshot()
        self.assertEqual(len(data['posts']), 6)
        self.assertEqual(data['circuits_total'], 24)
        self.assertEqual(sum(len(p['circuits']) for p in data['posts']), 24)
        self.assertEqual(data['posts'][0]['circuits'][0]['meter_id'], 'P01-M01')

    def test_switch_changes_measurement_and_current(self):
        before = self.sim.readings(0, 1)
        self.assertLess(before[2], 1)
        self.sim.switch('P01-C01', True)
        after = self.sim.readings(0, 1)
        self.assertGreater(after[2], before[2] + 70)
        self.assertGreater(after[1], before[1] + 90)
        self.sim.switch('P01-C01', False)
        off = self.sim.readings(0, 1)
        self.assertLess(off[2], 1)
        self.assertGreaterEqual(off[3], after[3])

    def test_scenarios(self):
        self.sim.scenario('rush')
        self.assertEqual(self.sim.snapshot()['circuits_enabled'], 24)
        self.sim.scenario('stop')
        self.assertEqual(self.sim.snapshot()['circuits_enabled'], 0)
        self.sim.scenario('normal')
        self.assertGreater(self.sim.snapshot()['circuits_enabled'], 0)
        self.assertLess(self.sim.snapshot()['circuits_enabled'], 24)
        self.sim.scenario('night')
        self.assertEqual(self.sim.snapshot()['circuits_enabled'], 6)

    def test_invalid_commands_are_rejected(self):
        with self.assertRaises(ValueError):
            self.sim.switch('P01-C99', True)
        with self.assertRaises(ValueError):
            self.sim.switch('P01-C01', 'on')
        with self.assertRaises(ValueError):
            self.sim.scenario('unknown')


class ModbusLinkedSwitchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadedServer(('127.0.0.1', 0), ModbusHandler)
        cls.server.post_idx = 0
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_real_modbus_read_reflects_virtual_switch(self):
        meter_port = self.server.server_address[1]
        set_fault('P01-M01', False)
        try:
            plant.switch('P01-C01', False)
            off = read_meter(meter_port, 1)
            plant.switch('P01-C01', True)
            on = read_meter(meter_port, 1)
            self.assertGreater(on['power_kw'], off['power_kw'] + 70)
            self.assertGreater(on['current_a'], off['current_a'])
        finally:
            plant.switch('P01-C01', False)

if __name__ == '__main__':
    unittest.main()
