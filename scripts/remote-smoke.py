import base64, hashlib, json, os, socket, struct, subprocess, tempfile, time, urllib.request
from pathlib import Path

class CDP:
    def __init__(self, url):
        from urllib.parse import urlparse
        u=urlparse(url); self.s=socket.create_connection((u.hostname,u.port),timeout=15); self.s.settimeout(20); self.buffer=b''; self.serial=0; self.errors=[]
        key=base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f'GET {u.path} HTTP/1.1\r\nHost: {u.hostname}:{u.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        data=b''
        while b'\r\n\r\n' not in data:data+=self.s.recv(4096)
        head,self.buffer=data.split(b'\r\n\r\n',1)
        assert b'101' in head,head
    def read(self,n):
        while len(self.buffer)<n:self.buffer+=self.s.recv(max(4096,n-len(self.buffer)))
        out,self.buffer=self.buffer[:n],self.buffer[n:];return out
    def receive(self):
        a,b=self.read(2); n=b&127
        if n==126:n=struct.unpack('!H',self.read(2))[0]
        if n==127:n=struct.unpack('!Q',self.read(8))[0]
        mask=self.read(4) if b&128 else None
        data=self.read(n)
        if mask:data=bytes(v^mask[i%4] for i,v in enumerate(data))
        return json.loads(data)
    def call(self,method,params=None):
        self.serial+=1; ident=self.serial; data=json.dumps({'id':ident,'method':method,'params':params or {}}).encode(); n=len(data); mask=os.urandom(4)
        header=bytes([0x81,0x80|n]) if n<126 else bytes([0x81,0x80|126])+struct.pack('!H',n) if n<65536 else bytes([0x81,0x80|127])+struct.pack('!Q',n)
        self.s.sendall(header+mask+bytes(v^mask[i%4] for i,v in enumerate(data)))
        while True:
            result=self.receive()
            if result.get('method')=='Runtime.exceptionThrown':self.errors.append(result['params'])
            if result.get('id')==ident:
                if 'error' in result:raise RuntimeError(result['error'])
                return result.get('result',{})
    def js(self,expression):
        r=self.call('Runtime.evaluate',{'expression':expression,'returnByValue':True,'awaitPromise':True})
        if 'exceptionDetails' in r:raise RuntimeError(r['exceptionDetails'])
        return r.get('result',{}).get('value')
    def screenshot(self,path):
        r=self.call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':True});Path(path).write_bytes(base64.b64decode(r['data']))



profile=tempfile.mkdtemp(prefix='war-arena-chrome-',dir='/private/tmp')
log=open('/private/tmp/war-arena-chrome.log','w')
chrome=subprocess.Popen(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','--headless','--disable-gpu','--disable-background-timer-throttling','--disable-renderer-backgrounding','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],stdout=log,stderr=log)
try:
    portfile=Path(profile)/'DevToolsActivePort'
    for _ in range(200):
        if portfile.exists():break
        time.sleep(.1)
    port=int(portfile.read_text().splitlines()[0]);pages=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json'))
    c=CDP(next(p['webSocketDebuggerUrl'] for p in pages if p['type']=='page'));c.call('Runtime.enable');c.call('Page.enable')
    c.call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':1100,'deviceScaleFactor':1,'mobile':False})
    c.call('Page.addScriptToEvaluateOnNewDocument',{'source':'window.requestAnimationFrame=()=>0;'})
    c.call('Page.navigate',{'url':'http://127.0.0.1:8082/'})
    target=c.call('Target.createTarget',{'url':'about:blank'})['targetId']
    pages=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json'));d=CDP(next(p['webSocketDebuggerUrl'] for p in pages if p['id']==target));d.call('Runtime.enable');d.call('Page.enable')
    d.call('Page.addScriptToEvaluateOnNewDocument',{'source':'window.requestAnimationFrame=()=>0;'})
    d.call('Page.navigate',{'url':'http://127.0.0.1:8082/'})
    def until(client,expr,seconds=15):
        start=time.time()
        while time.time()-start<seconds:
            r=client.js(expr)
            if r:return r
            time.sleep(.1)
        raise Exception('Timed out '+expr+' '+str(client.js('document.getElementById("online-status")?.textContent')))
    for client in [c,d]:
        until(client,'Boolean(window.SpinArena)');client.js('SpinArena.setMode("online");setInterval(()=>RemoteRoom.tick(performance.now()),50)')
    c.js('document.getElementById("room-create").click()');until(c,'document.getElementById("online-status").textContent.includes("房間已建立")',30)
    code=c.js('RemoteRoom.code');print('ROOM CREATED',flush=True)
    d.js('document.getElementById("room-code").value='+json.dumps(code)+';document.getElementById("room-join").click()')
    until(c,'RemoteRoom.connected',30);until(d,'RemoteRoom.connected',30);time.sleep(.4);print('REAL WEBRTC CONNECTED',flush=True)
    c.js('SpinArena.select("liubei")');until(d,'SpinArena.game.actors[0].id==="liubei"')
    d.js('document.getElementById("enemy-select").value="zhaoyun";document.getElementById("enemy-select").dispatchEvent(new Event("change"))')
    until(c,'SpinArena.game.actors[1].id==="zhaoyun"');time.sleep(.2)
    assert d.js('SpinArena.game.actors[0].id')=='liubei'
    c.js('SpinArena.launch()');time.sleep(.2);c.js('SpinArena.game.charge=.81;SpinArena.launch()');time.sleep(.2)
    assert d.js('SpinArena.game.phase')=='charging'
    d.js('SpinArena.launch()');until(c,'SpinArena.game.phase==="countdown"')
    c.js('for(let i=0;i<181;i++)SpinArena.simulate(1/120)');until(d,'SpinArena.game.phase==="battle"')
    assert not c.js('SpinArena.game.aiEnabled')
    d.js('window.dispatchEvent(new KeyboardEvent("keydown",{code:"Digit5"}))');until(c,'SpinArena.game.has(SpinArena.game.actors[1],"wall")')
    assert not c.js('SpinArena.game.has(SpinArena.game.actors[0],"wall")');print('P2 INPUT ROUTED TO HOST',flush=True)
    c.js('for(let i=0;i<121;i++)SpinArena.simulate(1/120)');time.sleep(.2)
    d.js('window.dispatchEvent(new KeyboardEvent("keydown",{code:"KeyQ"}))');until(c,'SpinArena.game.has(SpinArena.game.actors[1],"evade")')
    time.sleep(.2);assert c.js('SpinArena.game.actors[1].mana')==d.js('SpinArena.game.actors[1].mana')
    d.js('document.getElementById("pause").click()');until(c,'SpinArena.game.phase==="paused"');until(d,'SpinArena.game.phase==="paused"')
    d.js('document.getElementById("pause").click()');until(c,'SpinArena.game.phase==="battle"');time.sleep(.2)
    c.js('SpinArena.draw()');d.js('SpinArena.draw()');c.screenshot('/private/tmp/remote-host.png');d.screenshot('/private/tmp/remote-guest.png')
    d.js('document.getElementById("room-leave").click()');until(c,'!RemoteRoom.connected');assert c.js('SpinArena.game.phase')=='paused'
    print('PASS: selection, two launch locks, P2 common/signature skills, matching mana, shared pause/resume, disconnect stop',flush=True)
    assert not c.errors,c.errors;assert not d.errors,d.errors
finally:
    print('HOST ERRORS',c.errors,flush=True)
    if 'd' in locals():print('GUEST ERRORS',d.errors,flush=True)
    chrome.terminate()
    try:chrome.wait(timeout=5)
    except subprocess.TimeoutExpired:chrome.kill()
    log.close()
