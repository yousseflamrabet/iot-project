"""Pure-Python Modbus TCP simulator and read-only client (function code 03).
NOT for control of real electrical installations.
"""
import socket, socketserver, struct, threading
from .modbus_config import POSTS
from .plant import plant
# 58 simulation meters = 46 newly supplied + 12 existing at PT 1.
# The CPS inventory lists 59 positions; this is a clearly documented assumption.
FIELDS = ('voltage_v','current_a','power_kw','energy_kwh','power_factor','frequency_hz','thd_v_pct','thd_i_pct')
FIELD_UNIT = ('V','A','kW','kWh','','Hz','%','%')
_faults = set()
_lock = threading.Lock()


def fault_active(meter_id):
    with _lock:
        return meter_id in _faults


def set_fault(meter_id, enabled):
    with _lock:
        if enabled: _faults.add(meter_id)
        else: _faults.discard(meter_id)


def readings(post_idx, unit_id):
    # Values are read from the physical-load simulator, not generated in the UI.
    return plant.readings(post_idx, unit_id)


class ThreadedServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


class ModbusHandler(socketserver.BaseRequestHandler):
    def handle(self):
        self.request.settimeout(3)
        post_idx = self.server.post_idx
        try:
            header = recv_exact(self.request, 7)
            transaction, protocol, length, uid = struct.unpack('>HHHB', header)
            if protocol != 0 or length < 2 or not 1 <= uid <= POSTS[post_idx][1]: return
            pdu = recv_exact(self.request, length-1)
            if len(pdu) != 5 or pdu[0] != 3: return
            _, start, count = struct.unpack('>BHH',pdu)
            if start+count > 16 or count <= 0: return
            meter_id = f'P{post_idx+1:02d}-M{uid:02d}'
            if fault_active(meter_id): return
            registers = b''.join(struct.pack('>f', v) for v in readings(post_idx, uid))
            portion = registers[start*2:(start+count)*2]
            response_pdu = bytes([3,len(portion)])+portion
            self.request.sendall(struct.pack('>HHHB',transaction,0,len(response_pdu)+1,uid)+response_pdu)
        except (OSError, struct.error):
            return


def recv_exact(conn, n):
    data=b''
    while len(data)<n:
        chunk=conn.recv(n-len(data))
        if not chunk: raise ConnectionError('Socket closed')
        data+=chunk
    return data


def start_gateways():
    servers=[]
    for i,(_,_,port) in enumerate(POSTS):
        srv=ThreadedServer(('127.0.0.1',port),ModbusHandler)
        srv.post_idx=i
        threading.Thread(target=srv.serve_forever, daemon=True, name=f'modbus-{port}').start()
        servers.append(srv)
    return servers


def read_meter(port, uid):
    request = struct.pack('>HHHBBHH',7,0,6,uid,3,0,16)
    with socket.create_connection(('127.0.0.1',port),timeout=1.5) as sock:
        sock.settimeout(1.5)
        sock.sendall(request)
        h=recv_exact(sock,7)
        tx,proto,length,unit=struct.unpack('>HHHB',h)
        if tx != 7 or proto!=0 or unit!=uid: raise ValueError('Invalid Modbus MBAP')
        pdu=recv_exact(sock,length-1)
        if len(pdu)!=34 or pdu[0]!=3 or pdu[1]!=32: raise ValueError('Invalid Modbus registers')
        floats=struct.unpack('>8f',pdu[2:])
        return dict(zip(FIELDS,[round(v,3) for v in floats]))
