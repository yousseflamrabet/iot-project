import unittest
from app.modbus import POSTS,FIELDS,readings,ThreadedServer,ModbusHandler,read_meter,set_fault
import threading

class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv=ThreadedServer(('127.0.0.1',0),ModbusHandler)
        cls.srv.post_idx=0
        cls.thread=threading.Thread(target=cls.srv.serve_forever,daemon=True)
        cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown();cls.srv.server_close()
    def test_inventory(self):
        self.assertEqual(sum(n for _,n,_ in POSTS),58)
        self.assertEqual(len(FIELDS),8)
    def test_read_fc03(self):
        m=read_meter(self.srv.server_address[1],1)
        self.assertEqual(len(m),8)
        self.assertGreater(m['voltage_v'],200)
        self.assertGreater(m['power_kw'],0)
    def test_simulate_comm_fault(self):
        set_fault('P01-M01',True)
        with self.assertRaises(Exception):read_meter(self.srv.server_address[1],1)
        set_fault('P01-M01',False)
        self.assertGreater(read_meter(self.srv.server_address[1],1)['power_kw'],0)

if __name__=='__main__':unittest.main()
